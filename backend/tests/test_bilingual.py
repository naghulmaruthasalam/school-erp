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


@pytest.mark.asyncio
async def test_a_student_opening_a_chapter_gets_the_library_text_without_anyone_importing_it(client, library, textbook):
    """Nothing was imported or synced by hand: the first student to look finds the Class 6 textbook, in their language."""
    from app.services import curriculum_service

    curriculum_service._last_checked.clear()
    sid = "000000000000000000000d79"
    await Student(id=PydanticObjectId(sid), school_id=SCHOOL, admission_no="S7", first_name="Mona", last_name="H",
                  academic_year_id=library["year"], class_id=library["c6"], section_id="s1").insert()
    override_current_user(make_current_user(Role.STUDENT, SCHOOL, user_id="000000000000000000000d7a", student_id=sid))
    tree = (await client.get("/api/v1/syllabus/tree", params={"lang": "ar"})).json()
    cls = next(c for c in tree["classes"] if c["subjects"])
    ss = next(s for s in cls["subjects"] if s["name"] == "Social Science")
    chapter = ss["chapters"][0]
    assert chapter["name"] == "عمان في عصر الخلافة الراشدة" and chapter["has_content"] and chapter["key"] == "Oman in the Rashidun Caliphate Era"
    detail = (await client.get(f"/api/v1/syllabus/{ss['syllabus_id']}", params={"lang": "ar"})).json()
    ch = next(c for c in detail["chapters"] if c["id"] == chapter["id"])
    assert "الخلفاء" in ch["content"] and ch["content_language"] == "ar"
    en = (await client.get(f"/api/v1/syllabus/{ss['syllabus_id']}", params={"lang": "en"})).json()["chapters"][0]
    assert "accepted Islam" in en["content"]


@pytest.mark.asyncio
async def test_a_mislabelled_record_is_served_by_the_language_its_text_is_in(client, school):
    """Arabic text tagged "en" (and English tagged "ar") must not be served for the wrong language."""
    from app.models.curriculum import CurriculumUnit

    await CurriculumUnit(school_id=None, grade=6, subject="Social Studies", language="en", unit_number=1, unit_title_en="Maps",
                         full_text="الخريطة هي رسم لسطح الأرض على الورق. تستخدم الرموز لتمثيل المعالم الجغرافية على الخريطة.").insert()
    await CurriculumUnit(school_id=None, grade=6, subject="Social Studies", language="ar", unit_number=1, unit_title_en="Maps",
                         full_text="A map is a drawing of the Earth's surface on paper. Symbols represent geographic features on a map.").insert()
    as_teacher()
    q = {"grade": 6, "subject": "Social Studies", "unit_number": 1}
    en = (await client.get("/api/v1/curriculum/content", params={**q, "lang": "en"})).json()
    ar = (await client.get("/api/v1/curriculum/content", params={**q, "lang": "ar"})).json()
    assert en["language"] == "en" and en["full_text"].startswith("A map")
    assert ar["language"] == "ar" and ar["full_text"].startswith("الخريطة")


@pytest.mark.asyncio
async def test_teacher_copilot_generators_write_in_the_language_asked_for(client, school, monkeypatch):
    from app.services.ai import lesson_plan_generator, question_paper_generator

    seen = []

    async def fake_generate(system_prompt, user_prompt, **kw):
        seen.append(system_prompt)
        return '{"topics": ["a", "b"]}'

    monkeypatch.setattr(lesson_plan_generator, "generate", fake_generate)
    as_teacher()
    for language, word in (("arabic", "Arabic"), ("english", "English")):
        r = await client.post("/api/v1/teacher-copilot/lesson-plan/extract-topics",
                              json={"chapter_name": "Maps", "chapter_content": "x", "subject": "SS", "grade": "6", "language": language})
        assert r.status_code == 200, r.text
        assert f"write every sentence of your answer in {word}" in seen[-1]


# ------------------------------------------------------------------ one video per language

@pytest.mark.asyncio
async def test_each_language_plays_its_own_video_with_fallback(client, library, tmp_path, monkeypatch):
    from app.core import s3

    import app.api.v1.uploads as uploads_api

    monkeypatch.setattr(s3, "LOCAL_UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(uploads_api, "LOCAL_UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(s3, "_use_local_storage", True)
    await run_import(client)
    syl = next(s for s in await Syllabus.find(Syllabus.school_id == SCHOOL).to_list() if s.subject_id == library["ss"])
    en_bytes, ar_bytes = b"E" * 5000, b"A" * 7000
    for lang, data in (("en", en_bytes), ("ar", ar_bytes)):
        r = await client.post(f"/api/v1/syllabus/{syl.id}/chapters/0/video", data={"language": lang},
                              files={"file": (f"{lang}.mp4", data, "video/mp4")})
        assert r.status_code == 200, r.text
        assert r.json()["language"] == lang

    async def video(lang):
        ch = (await client.get(f"/api/v1/syllabus/{syl.id}", params={"lang": lang})).json()["chapters"][0]
        return ch["video_url"], ch["video_language"], ch["video_languages"]

    en_url, en_lang, langs = await video("en")
    ar_url, ar_lang, _ = await video("ar")
    assert en_lang == "en" and ar_lang == "ar" and sorted(langs) == ["ar", "en"] and en_url != ar_url
    # the links really serve different files, with Range support for seeking
    path = lambda u: u.split("://", 1)[1].split("/", 1)[1].join(["/", ""])  # noqa: E731  (the link without its host)
    assert (await client.get(path(en_url))).content == en_bytes
    assert (await client.get(path(ar_url))).content == ar_bytes
    part = await client.get(path(ar_url), headers={"Range": "bytes=100-199"})
    assert part.status_code == 206 and part.content == ar_bytes[100:200] and part.headers["content-range"] == "bytes 100-199/7000"
    tail = await client.get(path(ar_url), headers={"Range": "bytes=-50"})
    assert tail.status_code == 206 and tail.content == ar_bytes[-50:]
    # tree says which chapters have a video
    tree = (await client.get("/api/v1/syllabus/tree", params={"lang": "ar"})).json()
    chapters = [ch for c in tree["classes"] for s in c["subjects"] for ch in s["chapters"] if s["syllabus_id"] == str(syl.id)]
    assert chapters[0]["has_video"] and chapters[0]["video_language"] == "ar"

    # saving the chapter from the editor (which echoes the link it was shown) must not move a video into the other language
    shown = (await client.get(f"/api/v1/syllabus/{syl.id}", params={"lang": "ar"})).json()["chapters"]
    r = await client.patch(f"/api/v1/syllabus/{syl.id}", params={"lang": "ar"}, json={"chapters": shown})
    assert r.status_code == 200
    again = await Syllabus.get(syl.id)
    assert again.chapters[0].video_s3_key and again.chapters[0].translations["ar"].video_s3_key
    assert again.chapters[0].video_s3_key != again.chapters[0].translations["ar"].video_s3_key and again.chapters[0].video_url is None

    # only an Arabic video exists -> English readers get it (and are told its language)
    again.chapters[0].video_s3_key = None
    await again.save()
    _, lang_en_fallback, _ = await video("en")
    assert lang_en_fallback == "ar"


@pytest.mark.asyncio
async def test_school_with_only_skeleton_maths_gets_the_library_notes_and_the_missing_subject(client, school, textbook):
    """A school that has Class 6 with a Mathematics list of chapter NAMES (no notes) and no Social Studies subject at all:
    the first student to open the syllabus finds Social Studies with the textbook, and Maths with the textbook notes added."""
    from app.models.syllabus import Chapter
    from app.services import curriculum_service

    curriculum_service._last_checked.clear()
    year = AcademicYear(school_id=SCHOOL, name="2026-27", start_date=dt.date(2026, 6, 1), end_date=dt.date(2027, 3, 31), is_current=True)
    await year.insert()
    c6 = Class(school_id=SCHOOL, academic_year_id=str(year.id), name="Class 6", order=6)
    await c6.insert()
    maths = Subject(school_id=SCHOOL, name="Mathematics", code="MATH")
    await maths.insert()
    await Syllabus(school_id=SCHOOL, academic_year_id=str(year.id), class_id=str(c6.id), subject_id=str(maths.id), title="Mathematics - Class 6",
                   status="PUBLISHED", created_by="seed",
                   chapters=[Chapter(name="Knowing Our Numbers", order=1, video_url="https://www.youtube.com/watch?v=abc"), Chapter(name="Whole Numbers", order=2)]).insert()
    sid = "000000000000000000000d90"
    await Student(id=PydanticObjectId(sid), school_id=SCHOOL, admission_no="S9", first_name="Priya", last_name="S",
                  academic_year_id=str(year.id), class_id=str(c6.id), section_id="s1").insert()
    override_current_user(make_current_user(Role.STUDENT, SCHOOL, user_id="000000000000000000000d91", student_id=sid))
    tree = (await client.get("/api/v1/syllabus/tree", params={"lang": "en"})).json()
    cls = next(c for c in tree["classes"] if c["name"] == "Class 6")
    subjects = {s["name"]: s for s in cls["subjects"]}
    assert set(subjects) == {"Mathematics", "Social Studies"}  # the missing subject was created from the library
    ss = subjects["Social Studies"]["chapters"]
    assert ss and all(ch["has_content"] for ch in ss)
    maths_chapters = {ch["key"]: ch for ch in subjects["Mathematics"]["chapters"]}
    assert "Knowing Our Numbers" in maths_chapters and not maths_chapters["Knowing Our Numbers"]["has_content"]  # the school's own chapters are kept
    assert any(ch["has_content"] for ch in maths_chapters.values())  # ... and the textbook's chapters (with notes) were added
    assert maths_chapters["Knowing Our Numbers"]["has_video"]  # the existing external video link survives
    assert await Class.find(Class.school_id == SCHOOL).count() == 3  # the fixture's Class 8 and 9 plus Class 6: no class was invented


@pytest.mark.asyncio
async def test_textbooks_stamped_with_an_unknown_school_id_are_still_found(client, school):
    """ingest_curriculum --school-id demo-school (an id that is no school) must not hide the library from every school."""
    from app.models.curriculum import CurriculumUnit

    await CurriculumUnit(school_id="demo-school", grade=6, subject="Social Studies", language="en", unit_number=1, unit_title_en="Maps",
                         full_text="A map is a drawing of the Earth's surface on paper.").insert()
    await CurriculumUnit(school_id="5c0000000000000000000002", grade=6, subject="Social Studies", language="en", unit_number=9, unit_title_en="Other school",
                         full_text="This unit belongs to a different school and must stay hidden.").insert()
    as_teacher()
    chapters = (await client.get("/api/v1/curriculum/chapters", params={"grade": 6, "subject": "Social Studies"})).json()["chapters"]
    assert [c["title"] for c in chapters] == ["Maps"]


# ------------------------------------------------------------------ chapter notes as a PDF

@pytest.mark.asyncio
async def test_chapter_notes_download_as_a_pdf_in_each_language(client, library):
    await run_import(client)
    syl = next(s for s in await Syllabus.find(Syllabus.school_id == SCHOOL).to_list() if s.subject_id == library["ss"])
    texts = {}
    for lang in ("en", "ar"):
        r = await client.get(f"/api/v1/syllabus/{syl.id}/chapters/0/pdf", params={"lang": lang})
        assert r.status_code == 200, r.text
        assert r.headers["content-type"] == "application/pdf" and r.content.startswith(b"%PDF")
        assert r.headers["content-disposition"].startswith("inline")
        from io import BytesIO
        from pypdf import PdfReader
        texts[lang] = " ".join(p.extract_text() or "" for p in PdfReader(BytesIO(r.content)).pages)
    assert texts["en"] != texts["ar"]
    r = await client.get(f"/api/v1/syllabus/{syl.id}/chapters/0/pdf", params={"download": "true"})
    assert r.headers["content-disposition"].startswith("attachment")
    assert (await client.get(f"/api/v1/syllabus/{syl.id}/chapters/99/pdf")).status_code == 404


def test_pdf_builder_handles_arabic_and_long_notes():
    from app.services.chapter_pdf import build_chapter_pdf

    pdf = build_chapter_pdf(title="الخريطة", subtitle="Class 6 · Social Studies", description="وصف", topics=["الرموز", "الأسماء"],
                            notes="## عنوان\n" + "نص طويل عن الخريطة والرموز. " * 400 + "\n- نقطة\n| a | b |\n|---|---|\n| 1 | 2 |", topics_label="المواضيع")
    assert pdf.startswith(b"%PDF") and len(pdf) > 5000


@pytest.mark.asyncio
async def test_teacher_assigned_to_a_grade_can_assign_homework_to_its_duplicate_record(client, library):
    """The teacher is assigned to "Class 6"; the school also has a duplicate "Grade 6" record with the real section."""
    from app.models.academic import Section
    from app.models.teacher import Teacher
    from tests.test_copilot import TEACHER_ID

    section = Section(school_id=SCHOOL, class_id=library["dup"], name="A")
    await section.insert()
    teacher = await Teacher.get(PydanticObjectId(TEACHER_ID))
    teacher.assigned_class_ids = [library["c6"]]
    await teacher.save()
    as_teacher()
    today = dt.date.today()
    body = {"section_id": str(section.id), "subject_id": library["ss"], "title": "Maps", "assigned_date": today.isoformat(),
            "due_date": (today + dt.timedelta(days=2)).isoformat()}
    r = await client.post("/api/v1/homework", json=body)
    assert r.status_code == 201, r.text
    other = Section(school_id=SCHOOL, class_id="ffffffffffffffffffffffff", name="B")
    await other.insert()
    assert (await client.post("/api/v1/homework", json={**body, "section_id": str(other.id)})).status_code in (403, 404)


# ------------------------------------------------------------------ video views (counted when a student finishes a video)

@pytest.mark.asyncio
async def test_video_views_counted_per_language_with_unique_students_and_roles(client, library, tmp_path, monkeypatch):
    from app.core import s3

    import app.api.v1.uploads as uploads_api
    from app.models.teacher import Teacher
    from tests.test_copilot import TEACHER_ID

    monkeypatch.setattr(s3, "LOCAL_UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(uploads_api, "LOCAL_UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(s3, "_use_local_storage", True)
    await run_import(client)  # admin
    syl = next(s for s in await Syllabus.find(Syllabus.school_id == SCHOOL).to_list() if s.subject_id == library["ss"])
    for lang in ("en", "ar"):  # a video in both languages on chapter 0
        r = await client.post(f"/api/v1/syllabus/{syl.id}/chapters/0/video", data={"language": lang}, files={"file": (f"{lang}.mp4", b"V" * 3000, "video/mp4")})
        assert r.status_code == 200, r.text
    url = f"/api/v1/syllabus/{syl.id}/chapters/0"

    ids = ["000000000000000000000d81", "000000000000000000000d82", "000000000000000000000d83"]
    for n, sid in enumerate(ids):  # three students in Class 6
        await Student(id=PydanticObjectId(sid), school_id=SCHOOL, admission_no=f"V{n}", first_name=f"Stu{n}", last_name="X",
                      academic_year_id=library["year"], class_id=library["c6"], section_id="s1").insert()

    def as_stu(sid):
        override_current_user(make_current_user(Role.STUDENT, SCHOOL, user_id="000000000000000000000d9" + sid[-1], student_id=sid))

    # Arabic video: student 1 finishes it twice, student 2 once. English video: student 1 once. Student 3 watches nothing.
    as_stu(ids[0])
    assert (await client.post(f"{url}/video-view", json={"language": "ar"})).json() == {"recorded": True, "views": 1}
    dup = (await client.post(f"{url}/video-view", json={"language": "ar"})).json()  # an immediate second report is a duplicate
    assert dup["recorded"] is False and dup["views"] == 1
    from app.models.video_watch import VideoWatch
    d = await VideoWatch.find_one(VideoWatch.student_id == ids[0], VideoWatch.language == "ar")
    d.last_at = d.last_at - dt.timedelta(minutes=5)
    await d.save()
    assert (await client.post(f"{url}/video-view", json={"language": "ar"})).json()["views"] == 2  # a real second watch
    assert (await client.post(f"{url}/video-view", json={"language": "en"})).json()["recorded"] is True
    as_stu(ids[1])
    assert (await client.post(f"{url}/video-view", json={"language": "ar"})).json()["recorded"] is True

    # the student sees a Watched flag on the chapter (for the language of the video shown)
    as_stu(ids[0])
    ch = next(c for cl in (await client.get("/api/v1/syllabus/tree", params={"lang": "ar"})).json()["classes"] for s in cl["subjects"]
              if s["syllabus_id"] == str(syl.id) for c in s["chapters"] if c["id"].endswith("-0"))
    assert ch["watched"] is True
    as_stu(ids[2])
    ch = next(c for cl in (await client.get("/api/v1/syllabus/tree")).json()["classes"] for s in cl["subjects"]
              if s["syllabus_id"] == str(syl.id) for c in s["chapters"] if c["id"].endswith("-0"))
    assert ch["watched"] is False
    assert (await client.get(f"{url}/video-stats")).status_code == 403  # a student cannot read the counts

    # the teacher of the class sees counts per language and who has / hasn't watched
    teacher = await Teacher.get(PydanticObjectId(TEACHER_ID))
    teacher.assigned_class_ids = [library["c6"]]
    await teacher.save()
    as_teacher()
    stats = (await client.get(f"{url}/video-stats")).json()
    assert stats["languages"]["ar"] == {"has_video": True, "views": 3, "students": 2}
    assert stats["languages"]["en"] == {"has_video": True, "views": 1, "students": 1}
    assert [r["name"] for r in stats["watched"]] == ["Stu0 X", "Stu1 X"] and [r["name"] for r in stats["not_watched"]] == ["Stu2 X"]
    assert stats["class_size"] == 3
    # a teacher cannot read another class's counts, and teachers' own views are never counted
    teacher.assigned_class_ids = ["ffffffffffffffffffffffff"]
    await teacher.save()
    assert (await client.get(f"{url}/video-stats")).status_code == 403
    assert (await client.post(f"{url}/video-view", json={"language": "ar"})).json()["recorded"] is False

    # the principal gets the school-wide report; a teacher does not
    assert (await client.get("/api/v1/syllabus/video-report")).status_code == 403
    override_current_user(make_current_user(Role.PRINCIPAL, SCHOOL, user_id="000000000000000000000a14"))
    report = (await client.get("/api/v1/syllabus/video-report")).json()
    rows = {r["language"]: r for r in report["rows"] if r["subject"] == "Social Science"}
    assert rows["ar"]["views"] == 3 and rows["ar"]["students"] == 2 and rows["ar"]["class_size"] == 3 and rows["ar"]["percent"] == 67
    assert rows["en"]["views"] == 1 and report["total_views"] == 4

    # a video that does not exist in that language cannot be "watched"
    again = await Syllabus.get(syl.id)
    again.chapters[0].translations["ar"].video_s3_key = None
    again.chapters[0].translations["ar"].video_url = None
    await again.save()
    as_stu(ids[0])
    assert (await client.post(f"{url}/video-view", json={"language": "ar"})).status_code == 422
    assert (await client.post(f"{url}/video-view", json={"language": "fr"})).status_code == 422
    assert (await client.post(f"/api/v1/syllabus/{syl.id}/chapters/9/video-view", json={"language": "en"})).status_code == 404


def test_only_countable_videos_are_tracked():
    from app.models.syllabus import Chapter, ChapterText
    from app.services.video_stats_service import _has_video

    uploaded = Chapter(name="a", order=1, video_s3_key="k/en.mp4")
    youtube = Chapter(name="b", order=2, video_url="https://www.youtube.com/watch?v=abcdefghijk")
    direct = Chapter(name="c", order=3, video_url="https://cdn.example.com/lesson.mp4", translations={"ar": ChapterText(name="ج", video_s3_key="k/ar.mp4")})
    assert _has_video(uploaded, "en") and not _has_video(youtube, "en") and _has_video(direct, "en") and _has_video(direct, "ar")
    assert not _has_video(uploaded, "ar")
