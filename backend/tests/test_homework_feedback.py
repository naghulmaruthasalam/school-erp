"""When a student hands in homework the AI reads what was actually uploaded (photo, PDF, Word, text), marks it against the
homework and the chapter's textbook notes, and answers in the student's language. The LLM is faked."""
import datetime as dt
import io
import zipfile

import pytest
import pytest_asyncio
from PIL import Image

from app.copilot import llm
from app.core import s3
from app.core.enums import HomeworkSubmissionStatus, Role
from app.models.academic import Section
from app.models.document import Document
from app.models.homework import Homework, HomeworkSubmission
from app.models.homework_validation import HomeworkValidation
from app.models.syllabus import Syllabus
from tests.conftest import make_current_user, override_current_user
from tests.test_copilot import SCHOOL, STUDENT_ID, as_student, as_teacher, fake, school  # noqa: F401

MARKS = {
    "total_score": 8, "max_score": 10, "grade": "B", "overall_feedback": "Good effort.", "strengths": ["Clear definition"],
    "areas_to_improve": ["Name the gas"], "questions": [{"question_number": 1, "student_answer": "Plants make food", "is_correct": True,
    "score": 8, "max_score": 10, "feedback": "Mostly right.", "suggestions": ["Mention oxygen"]}],
}


@pytest.fixture(autouse=True)
def local_storage(monkeypatch, tmp_path):
    monkeypatch.setattr(s3, "LOCAL_UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(s3, "_use_local_storage", True)


@pytest_asyncio.fixture
async def work(school, fake):  # noqa: F811
    fake.json_by_hint["marking a school student's homework"] = MARKS
    section = await Section.find_one(Section.school_id == SCHOOL)
    syl = await Syllabus.find_one(Syllabus.school_id == SCHOOL, Syllabus.status == "PUBLISHED")
    syl.chapters[0].content = "Photosynthesis: plants use chlorophyll, light, water and carbon dioxide to make glucose and release oxygen."
    await syl.save()
    hw = Homework(school_id=SCHOOL, section_id=str(section.id), subject_id=school["science"], teacher_id="t1", title="Photosynthesis questions",
                  description="1. Define photosynthesis.", chapter="Photosynthesis", assigned_date=dt.date.today(), due_date=dt.date.today())
    await hw.insert()
    sub = HomeworkSubmission(school_id=SCHOOL, homework_id=str(hw.id), student_id=STUDENT_ID)
    await sub.insert()
    return {"hw": hw, "sub": sub}


async def upload(name: str, ctype: str, data: bytes) -> str:
    key = f"{SCHOOL}/HOMEWORK_SUBMISSION/{name}"
    s3.upload_bytes(key, data, ctype)
    doc = Document(school_id=SCHOOL, module="HOMEWORK_SUBMISSION", s3_key=key, content_type=ctype, size_bytes=len(data), original_filename=name, uploaded_by="u")
    await doc.insert()
    return str(doc.id)


def docx(text: str) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("word/document.xml", f"<w:document><w:body><w:p><w:r><w:t>{text}</w:t></w:r></w:p></w:body></w:document>")
    return buf.getvalue()


def png() -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (40, 40), "white").save(buf, format="PNG")
    return buf.getvalue()


def marking_calls(fake):
    return [c for c in fake.calls if "marking a school student's homework" in c[1]]


@pytest.mark.asyncio
async def test_feedback_reads_the_uploaded_word_file_and_the_chapter_notes(client, work, fake):
    work["sub"].attachment_document_ids = [await upload("answers.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                                                        docx("Photosynthesis is how plants make food from light."))]
    work["sub"].status = HomeworkSubmissionStatus.SUBMITTED
    await work["sub"].save()
    as_student()
    r = await client.get(f"/api/v1/homework/submissions/{work['sub'].id}/feedback")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["status"] == "ready" and body["percentage"] == 80.0 and body["grade"] == "B" and body["files_checked"] == ["answers.docx"]
    (_, system, user), = marking_calls(fake)
    assert "plants make food from light" in user and "1. Define photosynthesis." in user and "chlorophyll" in user  # answer + task + textbook
    assert "English" in system
    assert (await client.get(f"/api/v1/homework/submissions/{work['sub'].id}/feedback")).json()["status"] == "ready"
    assert len(marking_calls(fake)) == 1  # stored, not re-marked on every look


@pytest.mark.asyncio
async def test_feedback_is_written_in_the_selected_language_and_remarked_when_the_work_changes(client, work, fake):
    work["sub"].attachment_document_ids = [await upload("a.txt", "text/plain", b"first answer")]
    await work["sub"].save()
    as_student()
    url = f"/api/v1/homework/submissions/{work['sub'].id}/feedback"
    await client.get(url, headers={"Accept-Language": "en"})
    ar = (await client.get(url, headers={"Accept-Language": "ar"})).json()
    assert ar["language"] == "ar" and "Arabic" in marking_calls(fake)[-1][1] and len(marking_calls(fake)) == 2  # one record per language
    work["sub"].attachment_document_ids.append(await upload("b.txt", "text/plain", b"a better second answer"))
    await work["sub"].save()
    await client.get(url, headers={"Accept-Language": "en"})
    assert len(marking_calls(fake)) == 3 and "a better second answer" in marking_calls(fake)[-1][2]  # new upload -> marked again
    assert await HomeworkValidation.find({"submission_id": str(work["sub"].id)}).count() == 2


@pytest.mark.asyncio
async def test_a_photo_of_handwriting_goes_to_the_vision_model(client, work, fake, monkeypatch):
    seen = {}

    async def vision(system, user, images, **kw):
        seen["pages"], seen["user"] = images, user
        return MARKS

    monkeypatch.setattr(llm, "call_vision_json", vision)
    work["sub"].attachment_document_ids = [await upload("page1.png", "image/png", png())]
    await work["sub"].save()
    as_student()
    r = (await client.get(f"/api/v1/homework/submissions/{work['sub'].id}/feedback")).json()
    assert r["status"] == "ready" and len(seen["pages"]) == 1 and seen["pages"][0][:2] == b"\xff\xd8"  # a JPEG page
    assert "chlorophyll" in seen["user"]


@pytest.mark.asyncio
async def test_unreadable_or_empty_work_is_explained_without_calling_the_ai(client, work, fake):
    as_student()
    url = f"/api/v1/homework/submissions/{work['sub'].id}/feedback"
    assert (await client.get(url)).json()["status"] == "not_submitted"
    work["sub"].attachment_document_ids = [await upload("old.doc", "application/msword", b"\xd0\xcf\x11\xe0 binary")]
    await work["sub"].save()
    r = (await client.get(url)).json()
    assert r["status"] == "unreadable" and "Word (.docx)" in r["message"] and not marking_calls(fake)


@pytest.mark.asyncio
async def test_only_the_student_and_staff_can_see_it_and_handing_in_triggers_marking(client, work, fake):
    as_student()
    r = await client.patch(f"/api/v1/homework/submissions/{work['sub'].id}", json={"remarks": "My answer: plants make food using sunlight."})
    assert r.status_code == 200, r.text
    assert len(marking_calls(fake)) == 1  # started by the hand-in itself
    assert await HomeworkValidation.find({"submission_id": str(work["sub"].id)}).count() == 1
    override_current_user(make_current_user(Role.STUDENT, SCHOOL, user_id="000000000000000000000a55", student_id="000000000000000000000d02"))
    assert (await client.get(f"/api/v1/homework/submissions/{work['sub'].id}/feedback")).status_code == 403  # a classmate
    as_teacher()
    assert (await client.post(f"/api/v1/homework/submissions/{work['sub'].id}/ai-validate")).json()["status"] == "ready"
    assert len(marking_calls(fake)) == 2  # the teacher's button marks again
