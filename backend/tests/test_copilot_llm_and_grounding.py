import io

import pytest

from app.copilot import grounding, llm
from app.core import s3
from app.core.config import get_settings
from app.core.enums import DocumentModule, Role
from app.models.academic import Class, Subject
from app.models.document import Document
from app.models.syllabus import Chapter, Syllabus
from tests.conftest import make_current_user

SCHOOL = "5c0000000000000000000001"


def test_provider_selection_and_configuration(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "copilot_llm_provider", "gemini")
    monkeypatch.setattr(settings, "gemini_api_key", None)
    assert llm.provider() == "gemini" and not llm.is_configured()
    monkeypatch.setattr(settings, "gemini_api_key", "k")
    assert llm.is_configured()
    monkeypatch.setattr(settings, "copilot_llm_provider", "openai")
    monkeypatch.setattr(settings, "openai_api_key", None)
    assert llm.provider() == "openai" and not llm.is_configured()


@pytest.mark.asyncio
async def test_calls_without_a_key_raise_a_clear_not_configured_error(monkeypatch):
    monkeypatch.setattr(get_settings(), "gemini_api_key", None)
    monkeypatch.setattr(get_settings(), "copilot_llm_provider", "gemini")
    with pytest.raises(llm.LLMNotConfigured, match="GEMINI_API_KEY"):
        await llm.call_text("s", "u")


def test_gemini_history_conversion():
    system, history, last = llm._gemini_history([
        {"role": "system", "content": "SYS"},
        {"role": "assistant", "content": "welcome"},
        {"role": "user", "content": "q1"},
        {"role": "assistant", "content": "a1"},
        {"role": "user", "content": "q2"},
    ])
    assert system == "SYS" and last == "q2"
    assert history == [{"role": "model", "parts": ["welcome"]}, {"role": "user", "parts": ["q1"]}, {"role": "model", "parts": ["a1"]}]
    with pytest.raises(llm.LLMError):
        llm._gemini_history([{"role": "assistant", "content": "x"}])


@pytest.mark.asyncio
async def test_call_json_rejects_non_json_and_non_objects(monkeypatch):
    monkeypatch.setattr(get_settings(), "gemini_api_key", "k")
    monkeypatch.setattr(get_settings(), "copilot_llm_provider", "gemini")

    async def bad(*a, **k):
        return "not json"

    monkeypatch.setattr(llm, "_gemini_generate", bad)
    with pytest.raises(llm.LLMError, match="invalid JSON"):
        await llm.call_json("s", "u")

    async def listy(*a, **k):
        return "[1, 2]"

    monkeypatch.setattr(llm, "_gemini_generate", listy)
    with pytest.raises(llm.LLMError, match="not an object"):
        await llm.call_json("s", "u")


@pytest.mark.asyncio
async def test_text_of_attached_pdf_and_text_files_reaches_the_study_context(monkeypatch, tmp_path):
    from reportlab.pdfgen import canvas

    monkeypatch.setattr(s3, "LOCAL_UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(s3, "_use_local_storage", True)

    buf = io.BytesIO()
    pdf = canvas.Canvas(buf)
    pdf.drawString(72, 720, "Chlorophyll absorbs sunlight in the leaf.")
    pdf.save()

    docs = []
    for name, data in (("notes.pdf", buf.getvalue()), ("extra.txt", b"Stomata let gases in and out."), ("virus.exe", b"MZ...")):
        key = s3.build_object_key(SCHOOL, DocumentModule.SYLLABUS_DOCUMENT, name)
        s3.upload_bytes(key, data, "application/octet-stream")
        doc = Document(school_id=SCHOOL, module=DocumentModule.SYLLABUS_DOCUMENT, s3_key=key, content_type="x",
                       size_bytes=len(data), original_filename=name, uploaded_by="u")
        await doc.insert()
        docs.append(str(doc.id))

    klass = Class(school_id=SCHOOL, academic_year_id="ay", name="Class 8", order=8)
    await klass.insert()
    subject = Subject(school_id=SCHOOL, name="Science", code="SCI")
    await subject.insert()
    await Syllabus(school_id=SCHOOL, academic_year_id="ay", class_id=str(klass.id), subject_id=str(subject.id), title="Sci",
                   chapters=[Chapter(name="Plants", order=1)], document_ids=docs, created_by="x").insert()

    teacher_like = make_current_user(Role.SCHOOL_ADMIN, SCHOOL)
    ctx = await grounding.build_study_context(teacher_like, str(klass.id), str(subject.id), "Plants")
    assert "Chlorophyll absorbs sunlight" in ctx.text and "Stomata let gases" in ctx.text
    assert "MZ" not in ctx.text  # unsupported file types are ignored
    assert ctx.has_material and ctx.chapters == ["Plants"]

    monkeypatch.setattr(get_settings(), "copilot_max_context_chars", 50)
    short = await grounding.build_study_context(teacher_like, str(klass.id), str(subject.id), "Plants")
    assert len(short.text) <= 50
