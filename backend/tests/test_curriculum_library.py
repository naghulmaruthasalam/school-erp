"""Std 1-12 textbook library: ingest any grade in either language, translate the missing language with automatic checks,
review and approve translations, and carry them into the syllabus chapters."""
import json

import pytest

from app.copilot import llm
from app.core.enums import Role
from app.models.academic import Class, Subject
from app.models.curriculum import CurriculumUnit
from app.models.syllabus import Chapter, ChapterText, Syllabus
from app.services import curriculum_library as lib
from tests.conftest import make_current_user, override_current_user

SCHOOL = "5c0000000000000000000001"
EN_TEXT = ("Plants need light, water and air to grow. A seed takes 7 days to sprout.\n\n" + "Roots take in water from the soil. " * 6 +
           "\n\nThe stem carries water to 3 leaves.")
AR_TEXT = "النباتات تحتاج إلى الضوء والماء والهواء لتنمو. تستغرق البذرة ٧ أيام لتنبت.\n\n" + "الجذور تمتص الماء من التربة. " * 6


def ndjson(*records):
    return "\n".join(json.dumps(r, ensure_ascii=False) for r in records).encode()


def unit_rec(grade, subject, n, text, lang=None, **kw):
    return {"class": grade, "subject": subject, "unit_number": n, "full_text": text, "language": lang, "unit_title_en": kw.get("en"), "unit_title_ar": kw.get("ar")}


@pytest.fixture
def fake_ai(monkeypatch):
    calls = {"text": [], "json": [], "mode": "good"}

    async def call_text(system, user, retries=2, temperature=0.5):
        calls["text"].append((system, user))
        if calls["mode"] == "drop_numbers":
            user = "".join(c for c in user if not c.isdigit())
        if "into Modern Standard Arabic" in system:
            return "".join("ب" if c.isalpha() else c for c in user)
        return "".join("a" if c.isalpha() and c >= "؀" else c for c in user)

    async def call_json(system, user, retries=2):
        calls["json"].append(user)
        if calls["mode"] == "drop_numbers":
            src = json.loads(user)["source"]
            return {"faithful": False, "issues": ["a number was lost"], "corrected": "".join("ب" if c.isalpha() else c for c in src)}
        if calls["mode"] == "cannot_fix":
            return {"faithful": False, "issues": ["wording is unnatural"], "corrected": None}
        return {"faithful": True, "issues": [], "corrected": None}

    monkeypatch.setattr(llm, "is_configured", lambda: True)
    monkeypatch.setattr(llm, "call_text", call_text)
    monkeypatch.setattr(llm, "call_json", call_json)
    return calls


def as_(role, uid="000000000000000000000a51", **kw):
    override_current_user(make_current_user(role, SCHOOL, user_id=uid, **kw))


def test_records_in_ndjson_or_json():
    recs, problems = lib.parse_records("x.ndjson", ndjson({"class": 1, "subject": "Maths", "unit_number": 1, "full_text": "a"}, {"class": 12}))
    assert len(recs) == 2 and not problems
    assert len(lib.parse_records("x.json", b'[{"a":1},{"b":2}]')[0]) == 2
    assert len(lib.parse_records("x.json", b'{"units":[{"a":1}]}')[0]) == 1
    assert lib.parse_records("x.ndjson", b'{"a":1}\nnot json')[1] and lib.parse_records("x", b"")[1]
    assert len(lib.split_chunks("para one\n\n" + "x " * 3000, limit=2200)) >= 3


@pytest.mark.asyncio
async def test_any_grade_1_to_12_and_the_text_decides_the_language():
    rep = await lib.ingest_records([
        unit_rec(1, "Maths", 1, EN_TEXT), unit_rec("Grade 6", "Science", 1, AR_TEXT, "en"),  # labelled English, written in Arabic
        unit_rec("الصف الثاني عشر", "Physics", 2, EN_TEXT), unit_rec(13, "Maths", 1, EN_TEXT), unit_rec(3, "", 1, EN_TEXT), unit_rec(4, "Maths", 1, ""),
    ], SCHOOL)
    assert rep["inserted"] == 3 and rep["grades"] == [1, 6, 12] and rep["languages"] == {"en": 2, "ar": 1}
    assert len(rep["problems"]) == 3 and "1 to 12" in rep["problems"][0]
    assert (await CurriculumUnit.find_one(CurriculumUnit.grade == 6)).language == "ar"
    again = await lib.ingest_records([unit_rec(1, "Maths", 1, EN_TEXT)], SCHOOL)
    assert again["unchanged"] == 1 and again["inserted"] == 0


@pytest.mark.asyncio
async def test_translation_is_checked_stored_and_flagged_for_review(fake_ai):
    await lib.ingest_records([unit_rec(3, "Science", 1, EN_TEXT, en="Plants")], SCHOOL)
    from app.services.curriculum_service import group_by_unit, load_units

    group = next(iter(group_by_unit(await load_units(SCHOOL, 3)).values()))
    res = await lib.translate_group(group, "ar", SCHOOL)
    assert res["action"] == "translated" and res["status"] == "ai_checked" and res["flags"] == []
    ar = await CurriculumUnit.get(res["unit_id"])
    assert ar.language == "ar" and ar.translated_from == "en" and ar.grade == 3 and ar.unit_title_en == "Plants" and ar.unit_title_ar
    assert [c for c in ar.full_text if c.isdigit()] == [c for c in EN_TEXT if c.isdigit()]  # numbers kept
    assert fake_ai["text"][0][0].count("grade 3") == 1 and "subject: Science" in fake_ai["text"][0][0]  # the prompt knows grade and subject
    # the same source is not translated again; a reviewed translation or an original is never overwritten
    group = next(iter(group_by_unit(await load_units(SCHOOL, 3)).values()))
    assert (await lib.translate_group(group, "ar", SCHOOL))["reason"] == "up to date"
    assert (await lib.translate_group(group, "en", SCHOOL))["reason"] == "an original edition already exists"
    ar.translation_status = "reviewed"
    await ar.save()
    assert (await lib.translate_group(group, "ar", SCHOOL, force=True))["action"] == "translated"  # force is the explicit override


@pytest.mark.asyncio
async def test_a_second_ai_pass_repairs_a_translation_that_lost_numbers(fake_ai):
    fake_ai["mode"] = "drop_numbers"
    await lib.ingest_records([unit_rec(3, "Science", 1, EN_TEXT)], SCHOOL)
    from app.services.curriculum_service import group_by_unit, load_units

    group = next(iter(group_by_unit(await load_units(SCHOOL, 3)).values()))
    res = await lib.translate_group(group, "ar", SCHOOL)
    assert res["status"] == "ai_checked" and "7" in (await CurriculumUnit.get(res["unit_id"])).full_text  # the corrected version won
    fake_ai["mode"] = "cannot_fix"  # the checker says it is not faithful but offers no correction: a person must look
    await lib.ingest_records([unit_rec(4, "Science", 1, EN_TEXT)], SCHOOL)
    group = next(iter(group_by_unit(await load_units(SCHOOL, 4)).values()))
    flagged = await lib.translate_group(group, "ar", SCHOOL)
    assert flagged["status"] == "needs_review" and any("wording is unnatural" in f for f in flagged["flags"])
    stored = await CurriculumUnit.get(flagged["unit_id"])
    assert stored.translation_status == "needs_review" and stored.translation_flags  # visible to the reviewer


@pytest.mark.asyncio
async def test_job_translates_a_grade_and_fills_the_syllabus_without_overwriting_edits(client, fake_ai):
    cls = Class(school_id=SCHOOL, academic_year_id="ay", name="Grade 3", order=3)
    await cls.insert()
    sci = Subject(school_id=SCHOOL, name="Science", code="SCI")
    await sci.insert()
    await Syllabus(school_id=SCHOOL, academic_year_id="ay", class_id=str(cls.id), subject_id=str(sci.id), title="Science 3", created_by="x", chapters=[
        Chapter(name="Plants", order=1, content=EN_TEXT), Chapter(name="Animals", order=2, content="Animals live in many places.",
                                                                  translations={"ar": ChapterText(name="الحيوانات", content="نص كتبه المعلم")})]).insert()
    await lib.ingest_records([unit_rec(3, "Science", 1, EN_TEXT, en="Plants"), unit_rec(3, "Science", 2, "Animals live in many places. They need food.", en="Animals"),
                              unit_rec(3, "Science", 3, AR_TEXT, "ar", ar="الماء")], SCHOOL)
    as_(Role.TEACHER, teacher_id="000000000000000000000f01")
    assert (await client.post("/api/v1/curriculum-library/translate", json={"grade": 3})).status_code == 403  # teachers review, they do not start jobs
    as_(Role.PRINCIPAL)
    r = await client.post("/api/v1/curriculum-library/translate", json={"grade": 3, "target": "both"})
    assert r.status_code == 202, r.text
    job = (await client.get(f"/api/v1/curriculum-library/jobs/{r.json()['job_id']}")).json()
    assert job["status"] == "done" and job["translated"] == 3 and job["failed"] == 0, job  # units 1+2 into Arabic, unit 3 into English
    syl = await Syllabus.find_one(Syllabus.school_id == SCHOOL)
    plants = next(c for c in syl.chapters if c.name == "Plants")
    animals = next(c for c in syl.chapters if c.name == "Animals")
    assert plants.translations["ar"].content and plants.content == EN_TEXT  # the Arabic edition arrived next to the English one
    assert animals.translations["ar"].content == "نص كتبه المعلم"  # the teacher's own Arabic text was left alone
    over = (await client.get("/api/v1/curriculum-library", params={"grade": 3})).json()
    assert [g["grade"] for g in over["grades"]] == list(range(1, 13)) and over["grades"][2]["units"] == 3
    row = next(u for u in over["units"] if u["unit_number"] == 1)
    assert row["languages"]["en"]["source"] == "original" and row["languages"]["ar"]["source"] == "translation"


@pytest.mark.asyncio
async def test_review_edit_approve_and_permissions(client, fake_ai):
    cls = Class(school_id=SCHOOL, academic_year_id="ay", name="Class 3", order=3)
    await cls.insert()
    sci = Subject(school_id=SCHOOL, name="Science", code="SCI")
    await sci.insert()
    await Syllabus(school_id=SCHOOL, academic_year_id="ay", class_id=str(cls.id), subject_id=str(sci.id), title="Science 3", created_by="x",
                   chapters=[Chapter(name="Plants", order=1, content=EN_TEXT)]).insert()
    await lib.ingest_records([unit_rec(3, "Science", 1, EN_TEXT, en="Plants")], SCHOOL)
    as_(Role.SCHOOL_ADMIN)
    jid = (await client.post("/api/v1/curriculum-library/translate", json={"grade": 3, "subject": "science", "unit_number": 1, "target": "ar"})).json()["job_id"]
    assert (await client.get(f"/api/v1/curriculum-library/jobs/{jid}")).json()["translated"] == 1
    as_(Role.TEACHER, teacher_id="000000000000000000000f01")
    both = (await client.get("/api/v1/curriculum-library/unit", params={"grade": 3, "subject": "Science", "unit_number": 1})).json()
    assert both["en"]["source"] == "original" and both["ar"]["source"] == "translation" and both["ar"]["status"] == "ai_checked"
    fixed = "النباتات تحتاج إلى الضوء والماء والهواء. تستغرق البذرة ٧ أيام."
    r = await client.put(f"/api/v1/curriculum-library/units/{both['ar']['id']}", json={"full_text": fixed, "title": "النباتات"})
    assert r.status_code == 200 and r.json()["status"] == "reviewed" and r.json()["syllabi_updated"] == 1
    syl = await Syllabus.find_one(Syllabus.school_id == SCHOOL)
    assert syl.chapters[0].translations["ar"].content == fixed  # the correction reached the chapter
    again = (await client.get("/api/v1/curriculum-library/unit", params={"grade": 3, "subject": "Science", "unit_number": 1})).json()
    assert again["ar"]["status"] == "reviewed" and again["ar"]["full_text"] == fixed
    assert (await client.put(f"/api/v1/curriculum-library/units/{both['en']['id']}", json={"approve": True})).json()["status"] == "original"  # originals have no review state
    as_(Role.STUDENT, student_id="000000000000000000000d01")
    assert (await client.get("/api/v1/curriculum-library")).status_code == 403
    as_(Role.PRINCIPAL)
    ing = await client.post("/api/v1/curriculum-library/ingest", files={"file": ("u.ndjson", ndjson(unit_rec(7, "Maths", 1, EN_TEXT)), "application/x-ndjson")})
    assert ing.status_code == 200 and ing.json()["inserted"] == 1 and ing.json()["grades"] == [7]
