"""One textbook unit in two languages: imported once as one chapter, read in the language the user selected, and found by
a student whatever the school's class/subject records happen to be called (duplicates, Arabic names)."""
import datetime as dt
import json

import pytest
import pytest_asyncio
from beanie import PydanticObjectId

from app.copilot.grounding import build_study_context
from app.core.enums import Role
from app.models.academic import AcademicYear, Class, Subject
from app.models.student import Student
from app.models.syllabus import Syllabus
from app.services.academic_keys import class_key, subject_key
from tests.conftest import make_current_user, override_current_user
from tests.test_copilot import SCHOOL, as_teacher, school  # noqa: F401

UNITS = [
    {"class": 6, "subject": "Social Studies", "language": "ar", "unit_number": 2, "unit_title_en": "Oman in the Rashidun Caliphate Era",
     "unit_title_ar": "Unit2_عمان_في_عصر_الخلافة_الراشدة", "full_text": "عمان في عهد الخلفاء الراشدين: دخل أهل عمان في الإسلام طوعاً."},
    {"class": 6, "subject": "Social Studies", "language": "en", "unit_number": 2, "unit_title_en": "Oman in the Rashidun Caliphate Era",
     "unit_title_ar": "Unit2_عمان_في_عصر_الخلافة_الراشدة", "full_text": "Oman in the Rashidun era: the people of Oman accepted Islam peacefully."},
    {"class": 6, "subject": "Mathematics", "language": "ar", "unit_number": 3, "unit_title_en": "Area & Perimeter",
     "unit_title_ar": "Unit3_المساحة_والمحيط", "full_text": "المساحة هي عدد المربعات التي تغطي الشكل."},
]
NDJSON = "\n".join(json.dumps(u, ensure_ascii=False) for u in UNITS).encode()


@pytest_asyncio.fixture
async def library(school):
    year = AcademicYear(school_id=SCHOOL, name="2026-27", start_date=dt.date(2026, 6, 1), end_date=dt.date(2027, 3, 31), is_current=True)
    await year.insert()
    # the school's own records: a Class 6 and a duplicate "Grade 6", subjects named differently from the textbook export
    c6 = Class(school_id=SCHOOL, academic_year_id=str(year.id), name="Class 6", order=6)
    dup = Class(school_id=SCHOOL, academic_year_id=str(year.id), name="Grade 6", order=6)
    await c6.insert()
    await dup.insert()
    ss = Subject(school_id=SCHOOL, name="Social Science", code="SS")
    maths = Subject(school_id=SCHOOL, name="Maths", code="MATH")
    await ss.insert()
    await maths.insert()
    return {"c6": str(c6.id), "dup": str(dup.id), "ss": str(ss.id), "maths": str(maths.id), "year": str(year.id)}


async def run_import(client):
    override_current_user(make_current_user(Role.SCHOOL_ADMIN, SCHOOL, user_id="000000000000000000000a10"))
    r = await client.post("/api/v1/syllabus/import", files={"file": ("units.ndjson", NDJSON, "application/x-ndjson")}, data={"dry_run": "false"})
    assert r.status_code == 200, r.text
    return r.json()


def test_keys_treat_equivalent_names_as_one():
    assert {class_key(n) for n in ("Class 6", "Grade 6 - A", "6", "VI", "الصف السادس", "الصف ٦")} == {"6"}
    assert subject_key("Social Studies") == subject_key("Social Science") == subject_key("الدراسات الاجتماعية") == "social_studies"
    assert subject_key("Maths") == subject_key("الرياضيات") == "mathematics"


@pytest.mark.asyncio
async def test_a_unit_in_two_languages_becomes_one_chapter_with_both_texts(client, library):
    report = await run_import(client)
    assert report["problems"] == [] and report["totals"]["chapters_added"] == 2  # Social Studies unit 2 (en+ar) and Maths unit 3 (ar only)
    syllabi = await Syllabus.find(Syllabus.school_id == SCHOOL).to_list()
    ss = next(s for s in syllabi if s.subject_id == library["ss"])  # matched to "Social Science" through the canonical subject
    assert len(ss.chapters) == 1
    ch = ss.chapters[0]
    assert ch.name == "Oman in the Rashidun Caliphate Era" and "accepted Islam" in ch.content
    assert ch.translations["ar"].name == "عمان في عصر الخلافة الراشدة" and "الخلفاء" in ch.translations["ar"].content


@pytest.mark.asyncio
async def test_content_follows_the_selected_language_with_fallback(client, library):
    await run_import(client)  # leaves the admin signed in
    tree_en = (await client.get("/api/v1/syllabus/tree", headers={"Accept-Language": "en"})).json()
    tree_ar = (await client.get("/api/v1/syllabus/tree", params={"lang": "ar"})).json()
    pick = lambda tree, _cls: next(c for c in tree["classes"] if c["subjects"] and c["name"] in ("Class 6", "Grade 6"))  # noqa: E731  (the import lands on one of the duplicate records)
    ss_en = next(s for s in pick(tree_en, "Class 6")["subjects"] if s["name"] == "Social Science")["chapters"][0]
    ss_ar = next(s for s in pick(tree_ar, "Class 6")["subjects"] if s["name"] == "Social Science")["chapters"][0]
    assert ss_en["name"] == "Oman in the Rashidun Caliphate Era" and ss_en["content_language"] == "en"
    assert ss_ar["name"] == "عمان في عصر الخلافة الراشدة" and ss_ar["content_language"] == "ar" and ss_ar["languages"] == ["en", "ar"]
    maths_en = next(s for s in pick(tree_en, "Class 6")["subjects"] if s["name"] == "Maths")["chapters"][0]
    assert maths_en["content_language"] == "ar" and maths_en["has_content"]  # only an Arabic edition exists: shown, and labelled


@pytest.mark.asyncio
async def test_student_in_a_duplicate_class_record_still_gets_the_material(client, library):
    await run_import(client)
    sid = "000000000000000000000d77"
    await Student(id=PydanticObjectId(sid), school_id=SCHOOL, admission_no="S6", first_name="Omar", last_name="H",
                  academic_year_id=library["year"], class_id=library["dup"], section_id="s1").insert()  # in "Grade 6", syllabus is on "Class 6"
    override_current_user(make_current_user(Role.STUDENT, SCHOOL, user_id="000000000000000000000d78", student_id=sid))
    tree = (await client.get("/api/v1/syllabus/tree", params={"lang": "ar"})).json()
    classes = [c for c in tree["classes"] if c["subjects"]]
    assert [c["name"] for c in classes] == ["Grade 6"]
    assert {x["name"]: x["chapters"][0]["name"] for x in classes[0]["subjects"]}["Social Science"] == "عمان في عصر الخلافة الراشدة"
    listed = (await client.get("/api/v1/syllabus")).json()
    assert listed["total"] == 2


@pytest.mark.asyncio
async def test_grounding_uses_the_chosen_language_and_accepts_a_chapter_picked_in_either(client, library):
    await run_import(client)  # leaves the admin signed in
    cur = make_current_user(Role.SCHOOL_ADMIN, SCHOOL, user_id="000000000000000000000a10")
    ar = await build_study_context(cur, library["dup"], library["ss"], "عمان في عصر الخلافة الراشدة", lang="ar")
    assert ar.chapter == "Oman in the Rashidun Caliphate Era" and "الخلفاء" in ar.text and ar.content_language == "ar"
    en = await build_study_context(cur, library["c6"], library["ss"], "Oman in the Rashidun Caliphate Era", lang="en")
    assert "accepted Islam" in en.text and "الخلفاء" not in en.text.split("Chapter notes")[-1]


@pytest.mark.asyncio
async def test_editing_in_arabic_never_overwrites_the_english_text(client, library):
    await run_import(client)
    override_current_user(make_current_user(Role.SCHOOL_ADMIN, SCHOOL, user_id="000000000000000000000a10"))
    syl = next(s for s in await Syllabus.find(Syllabus.school_id == SCHOOL).to_list() if s.subject_id == library["ss"])
    shown = (await client.get(f"/api/v1/syllabus/{syl.id}", params={"lang": "ar"})).json()
    chapters = shown["chapters"]
    chapters[0]["description"] = "وصف جديد"  # the editor echoes everything back, with one change
    r = await client.patch(f"/api/v1/syllabus/{syl.id}", params={"lang": "ar"}, json={"chapters": chapters})
    assert r.status_code == 200, r.text
    again = await Syllabus.get(syl.id)
    ch = again.chapters[0]
    assert ch.name == "Oman in the Rashidun Caliphate Era" and "accepted Islam" in ch.content and ch.description is None
    assert ch.translations["ar"].description == "وصف جديد" and "الخلفاء" in ch.translations["ar"].content


# ------------------------------------------------------------------ the textbook library (curriculum API)

@pytest_asyncio.fixture
async def textbook(school):
    from app.models.curriculum import CurriculumUnit

    for u in UNITS:
        await CurriculumUnit(school_id=None, grade=u["class"], subject=u["subject"], language=u["language"], unit_number=u["unit_number"],
                             unit_title_en=u["unit_title_en"], unit_title_ar=u["unit_title_ar"], full_text=u["full_text"]).insert()


@pytest.mark.asyncio
async def test_curriculum_api_returns_one_entry_per_unit_in_the_selected_language(client, textbook):
    as_teacher()
    en = (await client.get("/api/v1/curriculum/chapters", params={"grade": 6, "subject": "Social Studies"}, headers={"Accept-Language": "en"})).json()
    ar = (await client.get("/api/v1/curriculum/chapters", params={"grade": 6, "subject": "Social Studies", "lang": "ar"})).json()
    assert en["total"] == ar["total"] == 1  # the two editions of unit 2 are one chapter
    assert en["chapters"][0]["title"] == "Oman in the Rashidun Caliphate Era" and en["chapters"][0]["language"] == "en"
    assert ar["chapters"][0]["title"] == "عمان في عصر الخلافة الراشدة" and ar["chapters"][0]["language"] == "ar"
    assert ar["chapters"][0]["available_languages"] == ["ar", "en"]
    assert (await client.get("/api/v1/curriculum/subjects", params={"grade": 6})).json()["subjects"] == ["Mathematics", "Social Studies"]


@pytest.mark.asyncio
async def test_curriculum_content_is_the_exact_unit_in_the_right_language(client, textbook):
    as_teacher()
    q = {"grade": 6, "subject": "Social Science", "unit_number": 2}  # the school's name for it still finds the textbook subject
    en = (await client.get("/api/v1/curriculum/content", params=q)).json()
    ar = (await client.get("/api/v1/curriculum/content", params={**q, "lang": "ar"})).json()
    assert "accepted Islam" in en["full_text"] and en["language"] == "en"
    assert "الخلفاء" in ar["full_text"] and ar["language"] == "ar"
    only_ar = (await client.get("/api/v1/curriculum/content", params={"grade": 6, "subject": "Mathematics", "unit_number": 3, "lang": "en"})).json()
    assert only_ar["language"] == "ar" and only_ar["requested_language"] == "en" and "المساحة" in only_ar["full_text"]  # fallback is labelled
    assert (await client.get("/api/v1/curriculum/content", params={"grade": 6, "subject": "Mathematics", "unit_number": 9})).json()["content"] is None


@pytest.mark.asyncio
async def test_teacher_copilot_options_list_each_chapter_once(client, textbook):
    as_teacher()
    opts = (await client.get("/api/v1/teacher-copilot/curriculum-options", params={"lang": "ar"})).json()
    ss = opts["chapters_by_grade_subject"]["6_Social Studies"]
    assert len(ss) == 1 and ss[0]["title"] == "عمان في عصر الخلافة الراشدة"
    detail = (await client.get(f"/api/v1/teacher-copilot/curriculum-content/{ss[0]['id']}", params={"lang": "en"})).json()
    assert detail["language"] == "en" and "accepted Islam" in detail["full_text"]  # asked for English on the Arabic record's id


@pytest.mark.asyncio
async def test_textbook_library_syncs_into_the_syllabus_for_the_right_class_and_subject(client, library, textbook):
    override_current_user(make_current_user(Role.SCHOOL_ADMIN, SCHOOL, user_id="000000000000000000000a10"))
    preview = (await client.post("/api/v1/syllabus/sync-curriculum", params={"dry_run": "true"})).json()
    assert preview["dry_run"] and preview["totals"]["syllabi_created"] == 2 and await Syllabus.find(Syllabus.subject_id == library["ss"]).count() == 0
    done = (await client.post("/api/v1/syllabus/sync-curriculum", params={"dry_run": "false"})).json()
    assert done["problems"] == []
    syl = next(s for s in await Syllabus.find(Syllabus.school_id == SCHOOL).to_list() if s.subject_id == library["ss"])
    assert syl.chapters[0].name == "Oman in the Rashidun Caliphate Era" and "الخلفاء" in syl.chapters[0].translations["ar"].content
    again = (await client.post("/api/v1/syllabus/sync-curriculum", params={"dry_run": "false"})).json()
    assert again["totals"]["syllabi_created"] == 0 and len(syl.chapters) == 1  # re-running updates, never duplicates
    as_teacher()
    assert (await client.post("/api/v1/syllabus/sync-curriculum")).status_code == 200
