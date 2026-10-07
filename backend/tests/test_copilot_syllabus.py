"""The Copilot reads the syllabus DB: chapter topics and notes ground the chat, 'Explain it' re-explains in the
asked style, and homework ideas avoid what the chapter already has."""
import datetime as dt

import pytest

from app.models.homework import Homework
from app.models.syllabus import Chapter, Syllabus
from tests.test_copilot import SCHOOL, as_parent, as_student, as_teacher, fake, school  # noqa: F401


async def add_notes(school):
    syl = next(s for s in await Syllabus.find(Syllabus.school_id == SCHOOL).to_list() if s.title == "Science 8")
    syl.chapters = [
        Chapter(name="Photosynthesis", order=1, topics=["Chlorophyll", "Light reaction"], content="Plants trap sunlight in chlorophyll to make glucose."),
        Chapter(name="Force", order=2, content="A force is a push or a pull."),
    ]
    await syl.save()


def ctx(school, chapter="Photosynthesis"):
    return {"class_id": school["class8"], "subject_id": school["science"], "chapter": chapter}


@pytest.mark.asyncio
async def test_chat_is_grounded_in_the_chapter_notes_and_may_go_beyond_them(client, school, fake):
    await add_notes(school)
    as_student()
    sid = (await client.post("/api/v1/copilot/sessions", json={"mode": "study", **ctx(school)})).json()["id"]
    r = await client.post(f"/api/v1/copilot/sessions/{sid}/messages", json={"message": "Explain it as a story"})
    assert r.status_code == 200
    system = next(c for c in fake.calls if c[0] == "chat")[1]
    assert "Plants trap sunlight in chlorophyll" in system and "Light reaction" in system
    assert "Chapter notes" in system and "general knowledge" in system  # free explanation is allowed
    assert "A force is a push" not in system  # only the selected chapter's notes in full


@pytest.mark.asyncio
async def test_without_a_chapter_every_chapters_notes_are_included(client, school, fake):
    await add_notes(school)
    as_student()
    sid = (await client.post("/api/v1/copilot/sessions", json={"mode": "study", **ctx(school, None)})).json()["id"]
    await client.post(f"/api/v1/copilot/sessions/{sid}/messages", json={"message": "hello"})
    system = next(c for c in fake.calls if c[0] == "chat")[1]
    assert "A force is a push" in system and "Plants trap sunlight" in system


@pytest.mark.asyncio
async def test_explain_uses_the_style_the_user_asked_for_and_is_open_to_students_parents_and_teachers(client, school, fake):
    await add_notes(school)
    for who in (as_student, as_parent, as_teacher):
        who()
        r = await client.post("/api/v1/copilot/tools/explain", json={"context": ctx(school), "params": {"style": "story", "concept": "chlorophyll"}})
        assert r.status_code == 200, r.text
        assert r.json()["content"] == "GENERATED TEXT" and "story" in r.json()["title"].lower()
    text_calls = [c for c in fake.calls if c[0] == "text"]
    assert all("short, vivid story" in c[1] and "chlorophyll" in c[2] and "Plants trap sunlight" in c[2] for c in text_calls)
    assert any("parent" in c[1] for c in text_calls) and any("teacher" in c[1] for c in text_calls)
    as_student()
    assert (await client.post("/api/v1/copilot/tools/explain", json={"context": ctx(school), "params": {"style": "poem"}})).status_code == 422


@pytest.mark.asyncio
async def test_a_student_cannot_explain_a_class_that_isnt_theirs(client, school, fake):
    as_student()
    r = await client.post("/api/v1/copilot/tools/explain", json={"context": {"class_id": school["class9"], "subject_id": school["science"]}})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_homework_ideas_are_teacher_only_need_a_chapter_and_skip_what_is_already_assigned(client, school, fake):
    await add_notes(school)
    await Homework(school_id=SCHOOL, section_id="s1", subject_id=school["science"], teacher_id="t1", title="Label a leaf",
                   chapter="Photosynthesis", assigned_date=dt.date.today(), due_date=dt.date.today()).insert()
    fake.json_by_hint["designs homework"] = {"ideas": [
        {"title": "Grow a bean", "kind": "practical", "minutes": 20, "instructions": "Plant a bean in a cup.", "what_to_check": "Photo of the plant"},
        {"title": "", "instructions": "no title: dropped"},
    ]}
    as_student()
    assert (await client.post("/api/v1/copilot/tools/homework_ideas", json={"context": ctx(school)})).status_code == 404
    as_teacher()
    assert (await client.post("/api/v1/copilot/tools/homework_ideas", json={"context": ctx(school, None)})).status_code == 422
    r = await client.post("/api/v1/copilot/tools/homework_ideas", json={"context": ctx(school)})
    assert r.status_code == 200, r.text
    body = r.json()
    assert [i["title"] for i in body["ideas"]] == ["Grow a bean"] and body["context"]["chapter"] == "Photosynthesis"
    assert "Grow a bean" in body["content"]
    user_msg = next(c for c in fake.calls if c[0] == "json" and "designs homework" in c[1])[2]
    assert "Label a leaf" in user_msg  # the chapter's existing homework is passed so ideas don't repeat it
