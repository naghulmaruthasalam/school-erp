"""Copilot: role gating, session ownership, grounding access rules, the safety gate, the two chat modes and
every tool. The LLM is replaced by fakes - no network, no API key."""
import json

import pytest
import pytest_asyncio
from beanie import PydanticObjectId

from app.copilot import llm, safety
from app.core.config import get_settings
from app.core.enums import Role
from app.models.academic import Class, Section, Subject
from app.models.guardian import Guardian
from app.models.student import Student
from app.models.syllabus import Chapter, Syllabus
from app.models.teacher import Teacher
from tests.conftest import make_current_user, override_current_user

SCHOOL = "5c0000000000000000000001"
OTHER_SCHOOL = "5c0000000000000000000002"
STUDENT_ID = "000000000000000000000d01"
CHILD_ID = "000000000000000000000d02"
GUARDIAN_ID = "000000000000000000000e01"
TEACHER_ID = "000000000000000000000f01"


@pytest_asyncio.fixture
async def school(monkeypatch):
    """Class 8 (+ Class 9) with a Science syllabus, a student, a parent with one child, and a teacher."""
    class8 = Class(school_id=SCHOOL, academic_year_id="ay1", name="Class 8", order=8)
    class9 = Class(school_id=SCHOOL, academic_year_id="ay1", name="Class 9", order=9)
    await class8.insert()
    await class9.insert()
    section = Section(school_id=SCHOOL, class_id=str(class8.id), name="A")
    await section.insert()
    science = Subject(school_id=SCHOOL, name="Science", code="SCI")
    await science.insert()
    await Syllabus(
        school_id=SCHOOL, academic_year_id="ay1", class_id=str(class8.id), subject_id=str(science.id),
        title="Science 8", description="Class 8 science",
        chapters=[Chapter(name="Photosynthesis", description="How plants make food", order=1), Chapter(name="Force", order=2)],
        created_by="x",
    ).insert()
    await Syllabus(  # a draft: students/parents must not see it
        school_id=SCHOOL, academic_year_id="ay1", class_id=str(class8.id), subject_id=str(science.id),
        title="Draft", chapters=[Chapter(name="Secret chapter", order=1)], status="DRAFT", created_by="x",
    ).insert()
    await Student(id=PydanticObjectId(STUDENT_ID), school_id=SCHOOL, admission_no="S1", first_name="Asha", last_name="K",
                  academic_year_id="ay1", class_id=str(class8.id), section_id=str(section.id)).insert()
    await Student(id=PydanticObjectId(CHILD_ID), school_id=SCHOOL, admission_no="S2", first_name="Ravi", last_name="M",
                  academic_year_id="ay1", class_id=str(class8.id), section_id=str(section.id)).insert()
    await Guardian(id=PydanticObjectId(GUARDIAN_ID), school_id=SCHOOL, full_name="Parent", phone="9000000001", student_ids=[CHILD_ID]).insert()
    await Teacher(id=PydanticObjectId(TEACHER_ID), school_id=SCHOOL, employee_no="T1", first_name="Meera", last_name="S",
                  phone="9000000002", assigned_class_ids=[str(class8.id)]).insert()
    return {"class8": str(class8.id), "class9": str(class9.id), "science": str(science.id)}


class FakeLLM:
    """Stands in for app.copilot.llm: records calls, returns canned output."""

    def __init__(self):
        self.calls: list[tuple[str, str, str]] = []
        self.json_by_hint: dict[str, dict] = {}
        self.fail = False

    def install(self, monkeypatch):
        monkeypatch.setattr(llm, "is_configured", lambda: True)
        monkeypatch.setattr(llm, "call_json", self.call_json)
        monkeypatch.setattr(llm, "call_text", self.call_text)
        monkeypatch.setattr(llm, "call_chat", self.call_chat)
        monkeypatch.setattr(llm, "call_chat_stream", self.call_chat_stream)

    async def call_json(self, system, user, retries=2):
        self.calls.append(("json", system, user))
        if self.fail:
            raise llm.LLMError("boom")
        if "safe" in system and "on_topic" in system:  # the safety gate
            text = user.lower()
            return {"safe": "badword" not in text, "on_topic": "football" not in text}
        for hint, value in self.json_by_hint.items():
            if hint in system:
                return value
        return {}

    async def call_text(self, system, user, retries=2, temperature=0.5):
        self.calls.append(("text", system, user))
        if self.fail:
            raise llm.LLMError("boom")
        return "GENERATED TEXT"

    async def call_chat(self, messages, retries=2):
        self.calls.append(("chat", messages[0]["content"], messages[-1]["content"]))
        if self.fail:
            raise llm.LLMError("boom")
        return "CHAT REPLY"

    async def call_chat_stream(self, messages):
        self.calls.append(("stream", messages[0]["content"], messages[-1]["content"]))
        if self.fail:
            raise llm.LLMError("boom")
        for piece in ("Hel", "lo ", "there"):
            yield piece


@pytest.fixture
def fake(monkeypatch):
    f = FakeLLM()
    f.install(monkeypatch)
    return f


def as_student():
    override_current_user(make_current_user(Role.STUDENT, SCHOOL, user_id="000000000000000000000a11", student_id=STUDENT_ID))


def as_parent():
    override_current_user(make_current_user(Role.PARENT, SCHOOL, user_id="000000000000000000000a12", guardian_id=GUARDIAN_ID))


def as_teacher():
    override_current_user(make_current_user(Role.TEACHER, SCHOOL, user_id="000000000000000000000a13", teacher_id=TEACHER_ID))


# ------------------------------------------------------------------ role gating + profile

@pytest.mark.asyncio
async def test_profile_differs_per_role_and_lists_that_roles_tools(client, school, fake):
    expected = {"STUDENT": {"explain", "quiz", "study_plan"}, "PARENT": {"explain", "child_report"}, "TEACHER": {"homework_ideas", "worksheet", "lesson_plan", "question_paper", "grading", "quiz", "explain", "parent_note"}}
    for role_name, setup in (("STUDENT", as_student), ("PARENT", as_parent), ("TEACHER", as_teacher)):
        setup()
        r = await client.get("/api/v1/copilot/profile")
        assert r.status_code == 200
        body = r.json()
        assert {t["key"] for t in body["tools"]} == expected[role_name]
        assert body["modes"] == ["school", "study"] and body["quick_actions"]["study"] and body["quick_actions"]["school"]


@pytest.mark.asyncio
async def test_roles_not_enabled_are_refused_until_configured(client, school, monkeypatch):
    override_current_user(make_current_user(Role.PRINCIPAL, SCHOOL))
    assert (await client.get("/api/v1/copilot/profile")).json() == {"enabled": False, "role": "PRINCIPAL"}
    assert (await client.get("/api/v1/copilot/context")).status_code == 403
    assert (await client.post("/api/v1/copilot/sessions", json={"mode": "school"})).status_code == 403
    monkeypatch.setattr(get_settings(), "copilot_enabled_roles", "STUDENT,PARENT,TEACHER,PRINCIPAL")
    r = await client.get("/api/v1/copilot/profile")
    assert r.status_code == 200 and r.json()["enabled"] is True and r.json()["title"] == "School Insights"
    assert [t["key"] for t in r.json()["tools"]] == ["announcement"]


@pytest.mark.asyncio
async def test_super_admin_has_no_copilot_without_a_school(client, school):
    override_current_user(make_current_user(Role.SUPER_ADMIN, None))
    assert (await client.get("/api/v1/copilot/profile")).json()["enabled"] is False
    assert (await client.get("/api/v1/copilot/context")).status_code == 403


# ------------------------------------------------------------------ context options + access rules

@pytest.mark.asyncio
async def test_context_options_are_scoped_per_role(client, school):
    as_student()
    body = (await client.get("/api/v1/copilot/context")).json()
    assert [c["name"] for c in body["classes"]] == ["Class 8"]
    chapters = body["classes"][0]["subjects"][0]["chapters"]
    assert chapters == ["Photosynthesis", "Force"] and "Secret chapter" not in chapters  # draft hidden

    as_parent()
    body = (await client.get("/api/v1/copilot/context")).json()
    assert [c["name"] for c in body["children"]] == ["Ravi M"]
    assert [c["name"] for c in body["classes"]] == ["Class 8"]

    as_teacher()
    body = (await client.get("/api/v1/copilot/context")).json()
    assert [c["name"] for c in body["classes"]] == ["Class 8"]
    assert "Secret chapter" in body["classes"][0]["subjects"][0]["chapters"]  # teachers see drafts


@pytest.mark.asyncio
async def test_a_user_cannot_start_a_session_for_a_class_they_have_no_access_to(client, school, fake):
    as_student()
    r = await client.post("/api/v1/copilot/sessions", json={"mode": "study", "class_id": school["class9"]})
    assert r.status_code == 403
    as_teacher()
    assert (await client.post("/api/v1/copilot/sessions", json={"mode": "study", "class_id": school["class9"]})).status_code == 403
    as_parent()
    r = await client.post("/api/v1/copilot/sessions", json={"mode": "study", "class_id": school["class8"], "student_id": "000000000000000000000dff"})
    assert r.status_code == 403  # not their child


@pytest.mark.asyncio
async def test_student_study_session_defaults_to_own_class(client, school, fake):
    as_student()
    r = await client.post("/api/v1/copilot/sessions", json={"mode": "study", "subject_id": school["science"], "chapter": "Photosynthesis"})
    assert r.status_code == 201
    body = r.json()
    assert body["label"] == "Class 8 · Science · Photosynthesis" and body["messages"][0]["role"] == "assistant"
    bad = await client.post("/api/v1/copilot/sessions", json={"mode": "study", "subject_id": school["science"], "chapter": "Nonexistent"})
    assert bad.status_code == 404


# ------------------------------------------------------------------ sessions: ownership

@pytest.mark.asyncio
async def test_sessions_belong_to_their_owner(client, school, fake):
    as_student()
    sid = (await client.post("/api/v1/copilot/sessions", json={"mode": "school"})).json()["id"]
    as_parent()
    assert (await client.get(f"/api/v1/copilot/sessions/{sid}")).status_code == 403
    assert (await client.post(f"/api/v1/copilot/sessions/{sid}/messages", json={"message": "hi"})).status_code == 403
    assert (await client.delete(f"/api/v1/copilot/sessions/{sid}")).status_code == 403
    assert (await client.get("/api/v1/copilot/sessions")).json() == []
    as_student()
    assert len((await client.get("/api/v1/copilot/sessions")).json()) == 1
    assert (await client.delete(f"/api/v1/copilot/sessions/{sid}")).status_code == 204
    assert (await client.get(f"/api/v1/copilot/sessions/{sid}")).status_code == 404


@pytest.mark.asyncio
async def test_session_from_another_school_is_not_found(client, school, fake):
    as_student()
    sid = (await client.post("/api/v1/copilot/sessions", json={"mode": "school"})).json()["id"]
    override_current_user(make_current_user(Role.STUDENT, OTHER_SCHOOL, user_id="000000000000000000000a11", student_id=STUDENT_ID))
    assert (await client.get(f"/api/v1/copilot/sessions/{sid}")).status_code == 404


# ------------------------------------------------------------------ study chat

@pytest.mark.asyncio
async def test_study_chat_is_grounded_in_the_syllabus_and_persona(client, school, fake):
    as_student()
    sid = (await client.post("/api/v1/copilot/sessions", json={"mode": "study", "subject_id": school["science"], "chapter": "Photosynthesis", "language": "Hindi"})).json()["id"]
    r = await client.post(f"/api/v1/copilot/sessions/{sid}/messages", json={"message": "What is photosynthesis?"})
    assert r.status_code == 200 and r.json()["reply"] == "CHAT REPLY"
    kind, system, last = [c for c in fake.calls if c[0] == "chat"][0]
    assert "Study Buddy" in system and "Photosynthesis" in system and "How plants make food" in system
    assert "Secret chapter" not in system  # draft syllabus never reaches a student's prompt
    assert "Reply in Hindi" in system and last == "What is photosynthesis?"
    saved = (await client.get(f"/api/v1/copilot/sessions/{sid}")).json()
    assert [m["role"] for m in saved["messages"]] == ["assistant", "user", "assistant"] and saved["title"] == "What is photosynthesis?"


@pytest.mark.asyncio
async def test_each_role_gets_its_own_persona(client, school, fake):
    for setup, persona in ((as_student, "Study Buddy"), (as_parent, "Parent Companion"), (as_teacher, "Teaching Copilot")):
        setup()
        body = {"mode": "study", "subject_id": school["science"]}
        if setup is as_teacher:
            body["class_id"] = school["class8"]
        sid = (await client.post("/api/v1/copilot/sessions", json=body)).json()["id"]
        await client.post(f"/api/v1/copilot/sessions/{sid}/messages", json={"message": "explain force"})
        assert persona in fake.calls[-1][1]


@pytest.mark.asyncio
async def test_study_stream_sends_chunks_then_done_and_saves_the_reply(client, school, fake):
    as_student()
    sid = (await client.post("/api/v1/copilot/sessions", json={"mode": "study", "subject_id": school["science"]})).json()["id"]
    r = await client.post(f"/api/v1/copilot/sessions/{sid}/messages/stream", json={"message": "hello"})
    events = [json.loads(line[6:]) for line in r.text.split("\n\n") if line.startswith("data: ")]
    assert [e["type"] for e in events] == ["chunk", "chunk", "chunk", "done"]
    assert "".join(e["text"] for e in events if e["type"] == "chunk") == "Hello there"
    saved = (await client.get(f"/api/v1/copilot/sessions/{sid}")).json()
    assert saved["messages"][-1]["content"] == "Hello there"


@pytest.mark.asyncio
async def test_model_failure_becomes_a_friendly_reply_not_an_error(client, school, fake):
    as_student()
    sid = (await client.post("/api/v1/copilot/sessions", json={"mode": "study", "subject_id": school["science"]})).json()["id"]
    fake.fail = False
    fake.fail = True
    r = await client.post(f"/api/v1/copilot/sessions/{sid}/messages", json={"message": "hello"})
    assert r.status_code == 200 and "trouble answering" in r.json()["reply"]


@pytest.mark.asyncio
async def test_without_an_ai_key_study_chat_says_so_and_school_mode_still_works(client, school, monkeypatch):
    monkeypatch.setattr(llm, "is_configured", lambda: False)
    monkeypatch.setattr(get_settings(), "gemini_api_key", None)
    as_student()
    sid = (await client.post("/api/v1/copilot/sessions", json={"mode": "study", "subject_id": school["science"]})).json()["id"]
    r = await client.post(f"/api/v1/copilot/sessions/{sid}/messages", json={"message": "hello"})
    assert "isn't set up" in r.json()["reply"]
    school_sid = (await client.post("/api/v1/copilot/sessions", json={"mode": "school"})).json()["id"]
    r = await client.post(f"/api/v1/copilot/sessions/{school_sid}/messages", json={"message": "hello"})
    assert r.status_code == 200 and r.json()["reply"]  # the built-in assistant answers without any key


# ------------------------------------------------------------------ safety gate

@pytest.mark.asyncio
async def test_unsafe_and_off_topic_messages_never_reach_the_chat_model(client, school, fake):
    as_student()
    sid = (await client.post("/api/v1/copilot/sessions", json={"mode": "study", "subject_id": school["science"], "language": "Arabic"})).json()["id"]
    r1 = await client.post(f"/api/v1/copilot/sessions/{sid}/messages", json={"message": "say a badword"})
    r2 = await client.post(f"/api/v1/copilot/sessions/{sid}/messages", json={"message": "who won the football match"})
    assert "لا أستطيع" in r1.json()["reply"]  # localised refusal
    assert r2.json()["reply"] and r2.json()["reply"] != "CHAT REPLY"
    assert not [c for c in fake.calls if c[0] in ("chat", "stream")]


@pytest.mark.asyncio
async def test_gate_fails_open_when_the_classifier_errors(monkeypatch):
    async def boom(*a, **k):
        raise llm.LLMError("down")

    monkeypatch.setattr(llm, "is_configured", lambda: True)
    monkeypatch.setattr(llm, "call_json", boom)
    assert await safety.check("anything", "school") == safety.GateResult(flagged=False, on_topic=True)


@pytest.mark.asyncio
async def test_message_length_and_rate_limit(client, school, fake, monkeypatch):
    as_student()
    sid = (await client.post("/api/v1/copilot/sessions", json={"mode": "school"})).json()["id"]
    assert (await client.post(f"/api/v1/copilot/sessions/{sid}/messages", json={"message": "x" * 2001})).status_code == 422
    monkeypatch.setattr(get_settings(), "copilot_messages_per_minute", 2)
    for _ in range(2):
        assert (await client.post(f"/api/v1/copilot/sessions/{sid}/messages", json={"message": "hi"})).status_code == 200
    assert (await client.post(f"/api/v1/copilot/sessions/{sid}/messages", json={"message": "hi"})).status_code == 429


# ------------------------------------------------------------------ tools

@pytest.mark.asyncio
async def test_a_role_can_only_run_its_own_tools(client, school, fake):
    as_student()
    assert (await client.post("/api/v1/copilot/tools/worksheet", json={})).status_code == 404
    assert (await client.post("/api/v1/copilot/tools/nope", json={})).status_code == 404
    as_parent()
    assert (await client.post("/api/v1/copilot/tools/quiz", json={})).status_code == 404
    assert (await client.post("/api/v1/copilot/tools/homework_ideas", json={})).status_code == 404


@pytest.mark.asyncio
async def test_quiz_validates_and_cleans_model_output(client, school, fake):
    fake.json_by_hint["Write 5"] = {"questions": [
        {"type": "mcq", "question": "Q1", "options": ["a", "b", "c", "d"], "answer": "B", "explanation": "e"},   # letter answer -> option text
        {"type": "mcq", "question": "Q2", "options": ["a", "b"], "answer": "a"},                                  # wrong option count: dropped
        {"type": "mcq", "question": "Q3", "options": ["a", "b", "c", "d"], "answer": "zzz"},                     # answer not an option: dropped
        {"type": "short", "question": "Q4", "answer": "an answer", "explanation": "why"},
        {"question": "", "answer": "x"},                                                                         # blank: dropped
    ]}
    as_student()
    r = await client.post("/api/v1/copilot/tools/quiz", json={"context": {"class_id": school["class8"], "subject_id": school["science"], "chapter": "Photosynthesis"}, "params": {"count": 5}})
    assert r.status_code == 200
    qs = r.json()["questions"]
    assert [q["question"] for q in qs] == ["Q1", "Q4"] and qs[0]["answer"] == "b" and qs[1]["options"] is None


@pytest.mark.asyncio
async def test_quiz_needs_a_subject_and_a_permitted_class(client, school, fake):
    as_student()
    assert (await client.post("/api/v1/copilot/tools/quiz", json={"context": {"class_id": school["class8"]}})).status_code == 422
    assert (await client.post("/api/v1/copilot/tools/quiz", json={"context": {"class_id": school["class9"], "subject_id": school["science"]}})).status_code == 403
    assert (await client.post("/api/v1/copilot/tools/quiz", json={"params": {}})).status_code == 422  # no class


@pytest.mark.asyncio
async def test_quiz_with_an_empty_model_answer_is_a_502(client, school, fake):
    as_student()
    r = await client.post("/api/v1/copilot/tools/quiz", json={"context": {"class_id": school["class8"], "subject_id": school["science"]}})
    assert r.status_code == 502


@pytest.mark.asyncio
async def test_worksheet_two_step_flow(client, school, fake):
    fake.json_by_hint["key teachable topics"] = {"topics": [{"topic": "Light reaction", "description": "d", "suggested_activities": ["Fill in the Blanks"]}]}
    as_teacher()
    ctx = {"class_id": school["class8"], "subject_id": school["science"], "chapter": "Photosynthesis"}
    r = await client.post("/api/v1/copilot/tools/worksheet", json={"context": ctx, "params": {"step": "topics"}})
    assert r.status_code == 200 and r.json()["topics"][0]["topic"] == "Light reaction"
    r = await client.post("/api/v1/copilot/tools/worksheet", json={"context": ctx, "params": {"step": "generate", "selected_topics": [{"topic": "Light reaction", "activities": ["Fill in the Blanks"]}]}})
    assert r.json()["content"] == "GENERATED TEXT"
    none = await client.post("/api/v1/copilot/tools/worksheet", json={"context": ctx, "params": {"step": "generate", "selected_topics": []}})
    assert none.status_code == 422
    assert (await client.post("/api/v1/copilot/tools/worksheet", json={"context": {**ctx, "chapter": None}, "params": {}})).status_code == 422  # chapter required


@pytest.mark.asyncio
async def test_lesson_plan_schedule_validation_and_notices(client, school, fake):
    fake.json_by_hint["lesson-scheduling"] = {
        "slots": [
            {"date": "2026-10-12", "topic": "T1", "minutes_allocated": 40, "session_type": "Introduction",
             "sequence": [{"label": "Hook", "minutes": 40, "description": "Do this — then that"}], "teacher_note": "note -- here"},
            {"date": "bad-date", "topic": "T2", "minutes_allocated": 40, "session_type": "x", "sequence": [], "teacher_note": ""},  # malformed: dropped
        ],
        "uncovered_topics": [{"topic": "T3", "estimated_minutes_needed": 30}],
    }
    as_teacher()
    ctx = {"class_id": school["class8"], "subject_id": school["science"], "chapter": "Force"}
    params = {"step": "schedule", "topics": ["T1", "T2", "T3"], "start_date": "2026-10-12", "target_completion": "2026-10-16",
              "teaching_dates": [{"date": "2026-10-12", "minutes": 40}]}
    r = await client.post("/api/v1/copilot/tools/lesson_plan", json={"context": ctx, "params": params})
    assert r.status_code == 200
    body = r.json()
    assert len(body["slots"]) == 1 and "→" in body["slots"][0]["teacher_note"] and "—" not in body["slots"][0]["sequence"][0]["description"]
    assert body["all_topics_covered"] is False and "T3" in body["buffer_notice"] and "30 minutes" in body["buffer_notice"]
    bad = {**params, "teaching_dates": [{"date": "2026-11-30", "minutes": 40}]}
    assert (await client.post("/api/v1/copilot/tools/lesson_plan", json={"context": ctx, "params": bad})).status_code == 422


@pytest.mark.asyncio
async def test_parent_note_and_unconfigured_ai_is_a_503(client, school, fake, monkeypatch):
    as_teacher()
    r = await client.post("/api/v1/copilot/tools/parent_note", json={"params": {"purpose": "appreciation", "details": "great effort"}})
    assert r.status_code == 200 and r.json()["content"] == "GENERATED TEXT"

    async def not_configured(*a, **k):
        raise llm.LLMNotConfigured("The AI model is not configured. Set GEMINI_API_KEY on the server.")

    monkeypatch.setattr(llm, "call_text", not_configured)
    r = await client.post("/api/v1/copilot/tools/parent_note", json={"params": {"details": "x"}})
    assert r.status_code == 503 and "GEMINI_API_KEY" in r.json()["detail"]


@pytest.mark.asyncio
async def test_child_report_only_for_own_children(client, school, fake):
    as_parent()
    r = await client.post("/api/v1/copilot/tools/child_report", json={"params": {}})
    assert r.status_code == 200 and r.json()["facts"]["child"] == "Ravi M" and r.json()["content"] == "GENERATED TEXT"
    other = await client.post("/api/v1/copilot/tools/child_report", json={"params": {"student_id": STUDENT_ID}})
    assert other.status_code == 422  # a student who is not this parent's child


@pytest.mark.asyncio
async def test_study_plan_for_a_student(client, school, fake):
    as_student()
    r = await client.post("/api/v1/copilot/tools/study_plan", json={"params": {"days": 5}})
    assert r.status_code == 200 and r.json()["title"] == "5-day study plan"
