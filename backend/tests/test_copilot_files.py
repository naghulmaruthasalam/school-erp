"""PDF/text export of worksheets and lesson plans, and the per-user history of generated files."""
import os
import shutil

import pytest

from app.copilot.pdf import render
from app.core import s3
from tests.test_copilot import (  # noqa: F401  (fixtures and helpers shared with the main Copilot tests)
    FakeLLM, STUDENT_ID, as_parent, as_student, as_teacher, fake, school,
)

CHAPTER_CTX = lambda school: {"class_id": school["class8"], "subject_id": school["science"], "chapter": "Photosynthesis"}  # noqa: E731


@pytest.fixture(autouse=True)
def local_storage(monkeypatch, tmp_path):
    monkeypatch.setattr(s3, "LOCAL_UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(s3, "_use_local_storage", True)


@pytest.fixture
def fake_pdf(monkeypatch):
    async def fake_render(html, *, footer=True):
        assert "<html" in html
        return b"%PDF-1.4 fake"

    monkeypatch.setattr(render, "html_to_pdf_bytes", fake_render)


@pytest.mark.asyncio
async def test_worksheet_export_pdf_and_text_land_in_the_history(client, school, fake, fake_pdf):
    as_teacher()
    base = {"context": CHAPTER_CTX(school)}
    pdf = await client.post("/api/v1/copilot/tools/worksheet", json={**base, "params": {"step": "finalize", "content": "## Topic\n1. Q", "header": {"school_name": "ABC School"}, "export_format": "pdf"}})
    assert pdf.status_code == 200
    info = pdf.json()["file"]
    assert info["kind"] == "worksheet" and info["filename"].endswith(".pdf") and info["content_type"] == "application/pdf"
    txt = await client.post("/api/v1/copilot/tools/worksheet", json={**base, "params": {"step": "finalize", "content": "## Topic\n1. Q", "export_format": "text"}})
    assert txt.json()["file"]["filename"].endswith(".txt")

    listed = (await client.get("/api/v1/copilot/files")).json()
    assert [f["id"] for f in listed][0] == txt.json()["file"]["id"] and len(listed) == 2  # newest first
    assert len((await client.get("/api/v1/copilot/files?kind=lesson_plan")).json()) == 0

    dl = await client.get(f"/api/v1/copilot/files/{info['id']}/download")
    assert dl.status_code == 200 and dl.content == b"%PDF-1.4 fake" and "attachment" in dl.headers["content-disposition"]
    dl_txt = await client.get(f"/api/v1/copilot/files/{txt.json()['file']['id']}/download")
    assert "Photosynthesis" in dl_txt.text and "HOMEWORK WORKSHEET" in dl_txt.text and "1. Q" in dl_txt.text

    assert (await client.delete(f"/api/v1/copilot/files/{info['id']}")).status_code == 204
    assert (await client.get(f"/api/v1/copilot/files/{info['id']}/download")).status_code == 404


@pytest.mark.asyncio
async def test_lesson_plan_export_renders_every_session(client, school, fake, fake_pdf):
    as_teacher()
    slot = {"date": "2026-10-12", "topic": "Light reaction", "minutes_allocated": 40, "session_type": "Introduction",
            "sequence": [{"label": "Hook", "minutes": 40, "description": "Ask a question"}], "teacher_note": "Note", "pacing_flag": None}
    r = await client.post("/api/v1/copilot/tools/lesson_plan", json={"context": CHAPTER_CTX(school), "params": {"step": "finalize", "slots": [slot], "buffer_notice": "Needs more time", "export_format": "text"}})
    assert r.status_code == 200
    body = (await client.get(f"/api/v1/copilot/files/{r.json()['file']['id']}/download")).text
    assert "Light reaction" in body and "Ask a question" in body and "Needs more time" in body and "LESSON PLAN" in body
    empty = await client.post("/api/v1/copilot/tools/lesson_plan", json={"context": CHAPTER_CTX(school), "params": {"step": "finalize", "slots": []}})
    assert empty.status_code == 422


@pytest.mark.asyncio
async def test_files_are_private_to_their_owner(client, school, fake):
    as_teacher()
    r = await client.post("/api/v1/copilot/tools/worksheet", json={"context": CHAPTER_CTX(school), "params": {"step": "finalize", "content": "x", "export_format": "text"}})
    fid = r.json()["file"]["id"]
    from tests.conftest import make_current_user, override_current_user
    from app.core.enums import Role

    other = make_current_user(Role.TEACHER, "5c0000000000000000000001", user_id="000000000000000000000a99", teacher_id="000000000000000000000f01")
    override_current_user(other)
    assert (await client.get(f"/api/v1/copilot/files/{fid}/download")).status_code == 403
    assert (await client.delete(f"/api/v1/copilot/files/{fid}")).status_code == 403
    assert (await client.get("/api/v1/copilot/files")).json() == []


@pytest.mark.asyncio
async def test_history_keeps_only_the_most_recent_files_per_kind(client, school, fake, monkeypatch):
    from app.copilot import files

    monkeypatch.setattr(files, "KEEP_PER_KIND", 3)
    as_teacher()
    for _ in range(5):
        await client.post("/api/v1/copilot/tools/worksheet", json={"context": CHAPTER_CTX(school), "params": {"step": "finalize", "content": "x", "export_format": "text"}})
    assert len((await client.get("/api/v1/copilot/files")).json()) == 3


@pytest.mark.asyncio
async def test_pdf_export_without_chromium_is_a_clear_503_and_text_still_works(client, school, fake, monkeypatch):
    monkeypatch.setattr(render, "is_available", lambda: False)
    as_teacher()
    body = {"context": CHAPTER_CTX(school), "params": {"step": "finalize", "content": "x"}}
    r = await client.post("/api/v1/copilot/tools/worksheet", json=body)
    assert r.status_code == 503 and "Print" in r.json()["detail"]
    body["params"]["export_format"] = "text"
    assert (await client.post("/api/v1/copilot/tools/worksheet", json=body)).status_code == 200


@pytest.mark.skipif(not os.environ.get("COPILOT_CHROMIUM_PATH") and not shutil.which("chromium"), reason="needs Chromium (set COPILOT_CHROMIUM_PATH)")
@pytest.mark.asyncio
async def test_real_chromium_renders_markdown_with_maths_to_a_pdf():
    from app.copilot.pdf.markdown_doc import markdown_to_pdf

    pdf = await markdown_to_pdf("Worksheet", ["Name: ____"], "## Topic\n1. Solve $x^2 = 4$\n2. Fill: ________\n")
    assert pdf.startswith(b"%PDF-") and len(pdf) > 5000
