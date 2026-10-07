"""Curriculum import (CSV/JSON, preview then apply), the class -> subject -> chapter tree and what the editor keeps."""
import datetime as dt
import json

import pytest
import pytest_asyncio

from app.core.enums import Role
from app.models.academic import AcademicYear, Class, Subject
from app.models.syllabus import Syllabus
from tests.conftest import make_current_user, override_current_user
from tests.test_copilot import SCHOOL, as_student, as_teacher, school  # noqa: F401 - reuse the seeded school

CSV = (
    "class,subject,chapter,topics,description,content,order\n"
    'Grade 8,Science,Photosynthesis,"Chlorophyll; Light reaction",How plants eat,Plants make food using light,1\n'
    "VIII,Science,Force,Push and pull,,,2\n"
    "Class 9,Science,Atoms,,,,1\n"
)


@pytest_asyncio.fixture
async def year():
    y = AcademicYear(school_id=SCHOOL, name="2026-27", start_date=dt.date(2026, 6, 1), end_date=dt.date(2027, 3, 31), is_current=True)
    await y.insert()
    return y


def as_admin():
    override_current_user(make_current_user(Role.SCHOOL_ADMIN, SCHOOL, user_id="000000000000000000000a10"))


async def move_to_year(year):
    """The seeded school uses a made-up year id; point its classes and syllabi at the real one."""
    for doc in [*await Class.find(Class.school_id == SCHOOL).to_list(), *await Syllabus.find(Syllabus.school_id == SCHOOL).to_list()]:
        doc.academic_year_id = str(year.id)
        await doc.save()


async def post(client, text, name="c.csv", **form):
    data = {"dry_run": "true", **{k: str(v).lower() for k, v in form.items()}}
    return await client.post("/api/v1/syllabus/import", files={"file": (name, text.encode(), "text/csv")}, data=data)


@pytest.mark.asyncio
async def test_preview_writes_nothing_and_apply_merges_by_chapter_name(client, school, year):
    as_admin()
    await move_to_year(year)
    before = await Syllabus.find(Syllabus.school_id == SCHOOL).count()

    r = await post(client, CSV)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["dry_run"] is True and body["problems"] == []
    assert body["totals"]["chapters_added"] + body["totals"]["chapters_updated"] == 3
    assert await Syllabus.find(Syllabus.school_id == SCHOOL).count() == before  # preview only

    r = await post(client, CSV, dry_run=False)
    assert r.status_code == 200, r.text
    syl = next(s for s in await Syllabus.find(Syllabus.school_id == SCHOOL).to_list() if s.title == "Science 8")
    photo = next(c for c in syl.chapters if c.name == "Photosynthesis")
    assert photo.topics == ["Chlorophyll", "Light reaction"] and photo.content == "Plants make food using light"
    assert photo.description == "How plants eat"
    assert {c.name for c in syl.chapters} == {"Photosynthesis", "Force"}  # merged into the existing syllabus, no duplicates
    assert await Syllabus.find(Syllabus.school_id == SCHOOL, Syllabus.title == "Science - Class 9").count() == 1

    again = (await post(client, CSV, dry_run=False)).json()
    assert again["totals"]["chapters_added"] == 0  # idempotent
    assert await Syllabus.find(Syllabus.school_id == SCHOOL).count() == before + 1


@pytest.mark.asyncio
async def test_unknown_class_or_subject_is_reported_unless_create_missing(client, school, year):
    as_admin()
    text = "class,subject,chapter\nClass 5,Art,Colours\n"
    r = (await post(client, text)).json()
    assert r["totals"]["skipped_groups"] == 1 and "Class 5" in r["problems"][0]
    r = (await post(client, text, dry_run=False, create_missing=True)).json()
    assert r["created_classes"] == ["Class 5"] and r["created_subjects"] == ["Art"]
    assert await Class.find(Class.school_id == SCHOOL, Class.name == "Class 5").count() == 1
    assert await Subject.find(Subject.school_id == SCHOOL, Subject.name == "Art").count() == 1


@pytest.mark.asyncio
async def test_nested_json_and_bad_input(client, school, year):
    as_admin()
    doc = {"classes": [{"name": "Class 5", "subjects": [{"name": "EVS", "chapters": [{"name": "Water", "topics": ["Rain", "Rivers"]}]}]}]}
    r = await client.post("/api/v1/syllabus/import", files={"file": ("c.json", json.dumps(doc).encode(), "application/json")},
                          data={"dry_run": "true", "create_missing": "true"})
    assert r.status_code == 200 and r.json()["syllabi"][0]["chapters"] == ["Water"]
    assert (await post(client, "{not json", name="x.json")).status_code == 422
    r = await post(client, "class,subject,chapter\nClass 8,,Oops\n")
    assert r.status_code == 422 or r.json()["problems"]  # a row missing its subject is reported, not silently dropped


@pytest.mark.asyncio
async def test_only_staff_can_import(client, school, year):
    as_student()
    assert (await post(client, CSV)).status_code == 403


@pytest.mark.asyncio
async def test_tree_is_scoped_by_role_and_hides_drafts_from_students(client, school):
    as_student()
    tree = (await client.get("/api/v1/syllabus/tree")).json()
    assert [c["name"] for c in tree["classes"]] == ["Class 8"]  # not Class 9
    chapters = [ch["name"] for s in tree["classes"][0]["subjects"] for ch in s["chapters"]]
    assert chapters == ["Photosynthesis", "Force"] and "Secret chapter" not in chapters
    as_teacher()
    tree = (await client.get("/api/v1/syllabus/tree")).json()
    names = [ch["name"] for s in tree["classes"][0]["subjects"] for ch in s["chapters"]]
    assert "Secret chapter" in names


@pytest.mark.asyncio
async def test_editor_update_keeps_topics_and_notes(client, school, year):
    as_admin()
    await move_to_year(year)
    await post(client, CSV, dry_run=False)
    syl = next(s for s in await Syllabus.find(Syllabus.school_id == SCHOOL).to_list() if s.title == "Science 8")
    # what the existing editor sends: name/description/order only
    r = await client.patch(f"/api/v1/syllabus/{syl.id}", json={"chapters": [{"name": "Photosynthesis", "description": "edited", "order": 1}]})
    assert r.status_code == 200
    ch = r.json()["chapters"][0]
    assert ch["description"] == "edited" and ch["topics"] == ["Chlorophyll", "Light reaction"] and ch["content"]


@pytest.mark.asyncio
async def test_check_content_script_finds_matching_chapters_and_files(school):
    from app.models.document import Document
    from scripts.check_content import check

    await Document(school_id=SCHOOL, module="SYLLABUS_DOCUMENT", s3_key="k", content_type="application/pdf", size_bytes=10,
                   original_filename="Unit1 Geography Map and names.pdf", uploaded_by="u").insert()
    r = await check(SCHOOL, ["photosynthesis", "geography"])
    assert any(c["chapter"] == "Photosynthesis" for c in r["matching_chapters"])
    assert [f["file"] for f in r["pdf_json_or_matching_files"]] == ["Unit1 Geography Map and names.pdf"]
    assert r["totals"]["syllabi"] >= 1
    empty = await check(SCHOOL, ["caliphate"])
    assert empty["matching_chapters"] == []
