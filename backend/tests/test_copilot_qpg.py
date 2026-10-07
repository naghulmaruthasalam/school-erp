"""Question paper generator: bank + AI top-up, shuffle-bag rotation, limits, export, ownership. The LLM is faked."""
import pytest

from app.copilot import llm
from app.copilot.qpg.rotation import advance_rotation
from app.core import s3
from app.core.enums import Role
from app.models.copilot_qpg import QuestionBankItem
from tests.conftest import make_current_user, override_current_user
from tests.test_copilot import SCHOOL, TEACHER_ID, as_student, as_teacher, fake, school  # noqa: F401

API = "/api/v1/copilot/qpg"


@pytest.fixture(autouse=True)
def local_storage(monkeypatch, tmp_path):
    monkeypatch.setattr(s3, "LOCAL_UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(s3, "_use_local_storage", True)


def mcqs(n, start=1):
    return [{"question_type": "mcq", "text": f"Question {i}: which pigment captures sunlight?", "options": ["Chlorophyll", "Keratin", "Insulin", "Haemoglobin"],
             "answer": "A" if i % 2 else "Chlorophyll", "keywords": "chlorophyll"} for i in range(start, start + n)]


def body(school, **counts):
    return {"class_id": school["class8"], "subject_id": school["science"], "chapters": [{"chapter": "Photosynthesis", "counts": counts or {"mcq": 2}}]}


def ai_calls(fake):
    return [c for c in fake.calls if c[0] == "json" and "You write exam questions" in c[1]]


# ------------------------------------------------------------------ rotation (pure)

def test_rotation_uses_every_question_before_repeating_and_never_repeats_inside_a_paper():
    ids = [f"q{i}" for i in range(6)]
    order, cursor, cycle, seen = None, 0, 0, []
    for _ in range(3):  # three papers of 2 = the whole bank of 6, no repeats
        drawn, order, cursor, cycle = advance_rotation(order, cursor, cycle, ids, 2)
        assert len(set(drawn)) == 2
        seen += drawn
    assert sorted(seen) == sorted(ids) and cycle == 0
    drawn, order, cursor, cycle = advance_rotation(order, cursor, cycle, ids, 4)  # next paper starts a new pass
    assert len(set(drawn)) == 4 and cycle >= 1
    # a bank smaller than the request never returns more than it has, and growth joins the current cycle
    assert len(advance_rotation(None, 0, 0, ["a", "b"], 5)[0]) == 2
    grown, *_ = advance_rotation(order, cursor, cycle, ids + ["new"], 7)
    assert "new" in grown and len(set(grown)) == 7


# ------------------------------------------------------------------ options + access

@pytest.mark.asyncio
async def test_options_are_for_teachers_and_list_types_by_class(client, school, fake):
    as_student()
    assert (await client.get(f"{API}/options")).status_code == 403
    as_teacher()
    r = await client.get(f"{API}/options")
    assert r.status_code == 200
    klass = r.json()["classes"][0]
    assert klass["name"] == "Class 8" and [t["key"] for t in klass["types"]] == ["mcq", "short", "long"]
    assert klass["subjects"][0]["chapters"] == ["Photosynthesis", "Force", "Secret chapter"]  # teachers also see drafts
    assert r.json()["limits"] == {"paper_marks": 100, "chapter_marks": 25}


# ------------------------------------------------------------------ generation

@pytest.mark.asyncio
async def test_bank_is_topped_up_by_the_ai_then_reused_without_repeats(client, school, fake):
    fake.json_by_hint["You write exam questions"] = {"questions": mcqs(6)}
    as_teacher()
    first = await client.post(f"{API}/generate", json=body(school, mcq=2))
    assert first.status_code == 200, first.text
    p1 = first.json()
    assert len(ai_calls(fake)) == 1 and p1["new_questions_written"] == 6
    assert p1["total_marks"] == 2 and len(p1["questions"]) == 2 and p1["class_name"] == "Class 8" and p1["suggested_duration"]
    assert all(q["answer"] == "Chlorophyll" for q in p1["questions"])  # a letter answer was turned into the option text
    assert await QuestionBankItem.find(QuestionBankItem.school_id == SCHOOL).count() == 6

    second = (await client.post(f"{API}/generate", json=body(school, mcq=2))).json()
    third = (await client.post(f"{API}/generate", json=body(school, mcq=2))).json()
    assert len(ai_calls(fake)) == 1  # the bank was enough: no second AI call
    ids = [q["id"] for p in (p1, second, third) for q in p["questions"]]
    assert len(ids) == len(set(ids)) == 6  # the whole bank used once before anything repeats


@pytest.mark.asyncio
async def test_a_paper_mixes_types_sections_and_totals_marks(client, school, fake):
    fake.json_by_hint["You write exam questions"] = {"questions": mcqs(4) + [
        {"question_type": "short", "text": "Define photosynthesis.", "answer": "Making food using light.", "keywords": "light, food"},
        {"question_type": "short", "text": "Why are leaves green?", "answer": "Chlorophyll."},
        {"question_type": "short", "text": "Name the gas released.", "answer": "Oxygen."},
        {"question_type": "long", "text": "Explain the light reaction.", "answer": "Light is absorbed by chlorophyll ..."},
        {"question_type": "mcq", "text": "Bad one: only two options", "options": ["a", "b"], "answer": "a"},  # dropped
        {"question_type": "essay", "text": "Unknown type", "answer": "x"},  # dropped
    ]}
    as_teacher()
    r = await client.post(f"{API}/generate", json=body(school, mcq=2, short=2, long=1))
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["total_marks"] == 2 * 1 + 2 * 2 + 5 and [q["question_type"] for q in p["questions"]] == ["mcq", "mcq", "short", "short", "long"]
    assert p["chapters"] == ["Photosynthesis"] and p["question_count"] == 5


@pytest.mark.asyncio
async def test_limits_and_bad_requests_are_refused(client, school, fake):
    as_teacher()
    assert (await client.post(f"{API}/generate", json=body(school, mcq=0))).status_code == 422  # nothing asked for
    assert (await client.post(f"{API}/generate", json=body(school, state_precisely=1))).status_code == 422  # not for Class 8
    assert (await client.post(f"{API}/generate", json=body(school, long=6))).status_code == 422  # too many longs
    assert (await client.post(f"{API}/generate", json=body(school, long=5, short=1))).status_code == 422  # 27 marks > 25
    bad = body(school, mcq=1)
    bad["chapters"][0]["chapter"] = "Nonexistent"
    assert (await client.post(f"{API}/generate", json=bad)).status_code == 422
    dup = body(school, mcq=1)
    dup["chapters"].append({"chapter": "Photosynthesis", "counts": {"mcq": 1}})
    assert (await client.post(f"{API}/generate", json=dup)).status_code == 422
    other = body(school, mcq=1)
    other["class_id"] = school["class9"]  # not one of this teacher's classes
    assert (await client.post(f"{API}/generate", json=other)).status_code == 403
    assert not ai_calls(fake)


@pytest.mark.asyncio
async def test_ai_problems_are_reported_but_a_stocked_bank_still_works(client, school, fake, monkeypatch):
    as_teacher()
    fake.fail = True
    assert (await client.post(f"{API}/generate", json=body(school, mcq=1))).status_code == 502  # empty bank + AI down
    monkeypatch.setattr(llm, "call_json", _not_configured)
    assert (await client.post(f"{API}/generate", json=body(school, mcq=1))).status_code == 503
    # a teacher adds one question; AI down for the shortfall -> the paper is still made from what the bank has
    monkeypatch.undo()
    fake.install(monkeypatch)
    fake.fail = False
    one = {**body(school)["chapters"][0], "class_id": school["class8"], "subject_id": school["science"], "question_type": "short",
           "text": "State Newton's first law.", "answer": "A body stays at rest or in uniform motion unless a force acts."}
    r = await client.post(f"{API}/bank", json={k: one[k] for k in ("class_id", "subject_id", "chapter", "question_type", "text", "answer")})
    assert r.status_code == 201, r.text
    fake.fail = True
    ok = await client.post(f"{API}/generate", json=body(school, short=2))
    assert ok.status_code == 200 and ok.json()["question_count"] == 1  # asked for 2, the bank had 1


async def _not_configured(*a, **k):
    raise llm.LLMNotConfigured("The AI model is not configured. Set GEMINI_API_KEY on the server.")


# ------------------------------------------------------------------ bank

@pytest.mark.asyncio
async def test_teachers_manage_the_bank_and_its_questions_are_drawn_first(client, school, fake):
    as_teacher()
    base = {"class_id": school["class8"], "subject_id": school["science"], "chapter": "Photosynthesis"}
    mcq = {**base, "question_type": "mcq", "text": "Which gas do plants take in?", "options": ["Oxygen", "Carbon dioxide", "Helium", "Neon"], "answer": "Carbon dioxide"}
    assert (await client.post(f"{API}/bank", json={**mcq, "answer": "Argon"})).status_code == 422  # answer not an option
    assert (await client.post(f"{API}/bank", json={**mcq, "options": ["a"]})).status_code == 422
    added = await client.post(f"{API}/bank", json=mcq)
    assert added.status_code == 201 and added.json()["source"] == "teacher"
    assert (await client.post(f"{API}/bank", json=mcq)).status_code == 422  # duplicate
    assert (await client.post(f"{API}/bank", json={**base, "chapter": "Nope", "question_type": "short", "text": "xyz?", "answer": "a"})).status_code == 404
    listed = (await client.get(f"{API}/bank", params={"class_id": school["class8"], "chapter": "Photosynthesis"})).json()
    assert [q["text"] for q in listed] == ["Which gas do plants take in?"]
    p = (await client.post(f"{API}/generate", json=body(school, mcq=1))).json()  # one needed, one in the bank: no AI
    assert p["questions"][0]["text"] == "Which gas do plants take in?" and not ai_calls(fake)
    assert (await client.delete(f"{API}/bank/{added.json()['id']}")).status_code == 204
    assert (await client.get(f"{API}/bank")).json() == []
    as_student()
    assert (await client.get(f"{API}/bank")).status_code == 403


# ------------------------------------------------------------------ papers, export, ownership

@pytest.mark.asyncio
async def test_papers_are_private_to_their_teacher_and_can_be_exported(client, school, fake):
    fake.json_by_hint["You write exam questions"] = {"questions": mcqs(4)}
    as_teacher()
    paper = (await client.post(f"{API}/generate", json=body(school, mcq=2))).json()
    assert [p["id"] for p in (await client.get(f"{API}/papers")).json()] == [paper["id"]]
    assert "questions" not in (await client.get(f"{API}/papers")).json()[0]

    key = await client.post(f"{API}/papers/{paper['id']}/export", json={"include_answers": True, "format": "text", "header": {"school_name": "Demo School", "exam_title": "Unit test"}})
    assert key.status_code == 200, key.text
    info = key.json()["file"]
    assert info["kind"] == "answer_key" and info["filename"].endswith(".txt")
    files = (await client.get("/api/v1/copilot/files", params={"kind": "answer_key"})).json()
    assert [f["id"] for f in files] == [info["id"]]
    text = (await client.get(f"/api/v1/copilot/files/{info['id']}/download")).text
    assert "Demo School" in text and "Unit test (Answer key)" in text and "Answer:** Chlorophyll" in text and "Section A: Multiple choice" in text
    plain = (await client.post(f"{API}/papers/{paper['id']}/export", json={"format": "text"})).json()["file"]
    assert plain["kind"] == "question_paper"
    assert "Answer:**" not in (await client.get(f"/api/v1/copilot/files/{plain['id']}/download")).text
    assert (await client.post(f"{API}/papers/{paper['id']}/export", json={"format": "docx"})).status_code == 422

    override_current_user(make_current_user(Role.TEACHER, SCHOOL, user_id="000000000000000000000a99", teacher_id=TEACHER_ID))
    assert (await client.get(f"{API}/papers/{paper['id']}")).status_code == 404  # someone else's paper
    assert (await client.get(f"{API}/papers")).json() == []
    assert (await client.delete(f"{API}/papers/{paper['id']}")).status_code == 404
    as_teacher()
    assert (await client.delete(f"{API}/papers/{paper['id']}")).status_code == 204
    assert (await client.get(f"{API}/papers/{paper['id']}")).status_code == 404
