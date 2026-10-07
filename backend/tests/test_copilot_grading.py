"""Answer-sheet grading: page images -> transcription -> marks, batches, adjustments, report, ownership. The model is faked."""
import asyncio
import io
import json

import pytest
from PIL import Image

from app.copilot import llm
from app.copilot.grading.evaluator import evaluate_question, normalize, resolve_mcq_answer
from app.core import s3
from app.core.enums import Role
from tests.conftest import make_current_user, override_current_user
from tests.test_copilot import SCHOOL, TEACHER_ID, as_student, as_teacher, fake, school  # noqa: F401

QPG = "/api/v1/copilot/qpg"
API = "/api/v1/copilot/grading"
OPTIONS = ["Chlorophyll", "Keratin", "Insulin", "Haemoglobin"]


@pytest.fixture(autouse=True)
def local_storage(monkeypatch, tmp_path):
    monkeypatch.setattr(s3, "LOCAL_UPLOADS_DIR", tmp_path)
    monkeypatch.setattr(s3, "_use_local_storage", True)


def jpeg(color=(255, 255, 255)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (60, 80), color).save(buf, format="JPEG")
    return buf.getvalue()


def pdf(pages=2) -> bytes:
    buf = io.BytesIO()
    imgs = [Image.new("RGB", (100, 140), "white") for _ in range(pages)]
    imgs[0].save(buf, format="PDF", save_all=True, append_images=imgs[1:])
    return buf.getvalue()


class Grader:
    """Fakes the vision transcription and the marking calls; what the student 'wrote' is set per test."""

    def __init__(self):
        self.answers: dict[int, dict] = {}  # question_number -> vision item
        self.score = 1.5
        self.mcq_equivalent = False
        self.fail_for: set[str] = set()
        self.vision_calls = 0
        self.vision_reply = None  # override the whole reply

    async def vision(self, system, user, images, retries=2, temperature=0.2):
        self.vision_calls += 1
        if any(name in user for name in self.fail_for):
            raise llm.LLMError("vision failed")
        if self.vision_reply is not None:
            return self.vision_reply
        return {"answers": [{"question_number": n, "extracted_text": "", "unanswered": True, "needs_review": False, **a} for n, a in self.answers.items()]}

    async def call_json(self, system, user, retries=2):
        if "Decide ONLY whether" in user:
            return {"is_correct": self.mcq_equivalent}
        if "examiner marking" in user:
            if self.score is None:
                raise llm.LLMError("boom")
            return {"score": self.score, "rationale": "Covers the main point.", "needs_review": False}
        if "safe" in system and "on_topic" in system:
            return {"safe": True, "on_topic": True}
        return {"questions": []}


@pytest.fixture
def grader(monkeypatch, fake):
    g = Grader()
    monkeypatch.setattr(llm, "call_vision_json", g.vision)
    monkeypatch.setattr(llm, "call_json", g.call_json)
    return g


async def make_paper(client, school, mcq=2, short=1):
    """A paper built only from teacher-written bank questions (no AI): 2 MCQs and 1 short answer by default."""
    base = {"class_id": school["class8"], "subject_id": school["science"], "chapter": "Photosynthesis"}
    for i in range(mcq):
        r = await client.post(f"{QPG}/bank", json={**base, "question_type": "mcq", "text": f"MCQ {i}: which pigment captures sunlight?", "options": OPTIONS, "answer": "Chlorophyll"})
        assert r.status_code == 201, r.text
    for i in range(short):
        await client.post(f"{QPG}/bank", json={**base, "question_type": "short", "text": f"Short {i}: why are leaves green?", "answer": "Chlorophyll reflects green light.", "keywords": "chlorophyll, green"})
    counts = {k: v for k, v in (("mcq", mcq), ("short", short)) if v}
    r = await client.post(f"{QPG}/generate", json={"class_id": school["class8"], "subject_id": school["science"], "chapters": [{"chapter": "Photosynthesis", "counts": counts}]})
    assert r.status_code == 200, r.text
    return r.json()


async def evaluate(client, paper_id, name="Asha", files=None, **extra):
    files = files if files is not None else [("files", ("p1.jpg", jpeg(), "image/jpeg"))]
    return await client.post(f"{API}/evaluate", data={"paper_id": paper_id, "student_name": name, **extra}, files=files)


# ------------------------------------------------------------------ pure parts

def test_normalise_maps_latex_and_unicode_notation_to_one_form():
    assert normalize("$\\frac{1}{2}$") == normalize("1/2") == "1/2"
    assert normalize("H₂O") == normalize("H2O")
    assert normalize("$b^2 - 4ac$") == normalize("b2 - 4ac")
    assert normalize("2H2 + O2 -> 2H2O") == normalize("2H₂ + O₂ → 2H₂O")
    assert normalize("180°") == normalize("180") and normalize("Rs.1,000") == normalize("Rs.1000")
    assert normalize("$\\pi r^2$") == normalize("πr2")
    assert normalize("5") != normalize("6") and normalize("H2O") != normalize("H2O2")


def test_mcq_answers_resolve_from_a_letter_or_the_option_text():
    assert resolve_mcq_answer("b", OPTIONS) == normalize("Keratin")
    assert resolve_mcq_answer("(C)", OPTIONS) == normalize("Insulin")
    assert resolve_mcq_answer("a) Chlorophyll", OPTIONS) == normalize("Chlorophyll")
    assert resolve_mcq_answer("chlorophyll", OPTIONS) == normalize("Chlorophyll")
    assert resolve_mcq_answer("e", OPTIONS) == "e"  # not a valid letter: compared as text


@pytest.mark.asyncio
async def test_marks_are_in_half_steps_within_the_question_and_failures_go_to_a_teacher(grader):
    q = {"question_type": "short", "marks": 2, "text": "Why?", "answer": "Because."}
    grader.score = 9.7
    assert (await evaluate_question(q, "x"))[0] == 2.0  # never above the question's marks
    grader.score = 1.26
    assert (await evaluate_question(q, "x"))[0] == 1.5
    grader.score = -3
    assert (await evaluate_question(q, "x"))[0] == 0.0
    grader.score = None  # the model call fails
    marks, feedback, review = await evaluate_question(q, "x")
    assert marks == 0.0 and review and "by hand" in feedback
    assert await evaluate_question(q, "   ") == (0.0, "No answer given.", False)


# ------------------------------------------------------------------ one sheet

@pytest.mark.asyncio
async def test_a_sheet_is_transcribed_marked_and_saved(client, school, grader):
    as_teacher()
    paper = await make_paper(client, school)
    qs = paper["questions"]
    assert [q["question_type"] for q in qs] == ["mcq", "mcq", "short"]
    grader.answers = {1: {"extracted_text": "a", "unanswered": False},  # letter a = Chlorophyll: correct
                      2: {"extracted_text": "Keratin", "unanswered": False},  # wrong option
                      3: {"extracted_text": "Because of chlorophyll", "unanswered": False, "needs_review": True}}
    r = await evaluate(client, paper["id"], student_id=None)
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["total_marks_possible"] == 4 and out["total_marks_awarded"] == 1 + 0 + 1.5
    marks = [q["marks_awarded"] for q in out["questions"]]
    assert marks == [1.0, 0.0, 1.5]
    assert out["questions"][0]["feedback"] == "Correct." and "expected 'Chlorophyll'" in out["questions"][1]["feedback"]
    assert out["questions"][2]["needs_review"] is True and out["needs_review"] == 1

    listed = (await client.get(f"{API}/results", params={"paper_id": paper["id"]})).json()
    assert [s["student_name"] for s in listed] == ["Asha"] and "questions" not in listed[0]
    assert (await client.get(f"{API}/results/{out['id']}")).json()["questions"][2]["student_answer"] == "Because of chlorophyll"


@pytest.mark.asyncio
async def test_unanswered_malformed_and_ai_assisted_mcq_cases(client, school, grader):
    as_teacher()
    paper = await make_paper(client, school)
    r = (await evaluate(client, paper["id"])).json()  # nothing recognised on the page
    assert r["total_marks_awarded"] == 0 and {q["feedback"] for q in r["questions"]} == {"No answer given."}
    grader.vision_reply = {"answers": "not a list"}  # a reply in the wrong shape leaves everything unanswered, no crash
    assert (await evaluate(client, paper["id"])).json()["total_marks_awarded"] == 0
    grader.vision_reply = {"answers": [
        {"question_number": 1, "extracted_text": "Chloro-phyll pigment", "unanswered": False, "needs_review": False},
        {"question_number": 1, "extracted_text": "(second block)", "unanswered": False, "needs_review": False},  # same question twice: merged + flagged
        {"question_number": 99, "extracted_text": "x", "unanswered": False}, "junk"]}
    grader.mcq_equivalent = True  # the narrow AI fallback accepts it as the same choice
    r = (await evaluate(client, paper["id"])).json()
    q1 = r["questions"][0]
    assert q1["marks_awarded"] == 1.0 and q1["needs_review"] is True and "(second block)" in q1["student_answer"]


@pytest.mark.asyncio
async def test_bad_uploads_missing_ai_and_other_teachers_papers(client, school, grader, monkeypatch):
    as_teacher()
    paper = await make_paper(client, school)
    assert (await evaluate(client, paper["id"], files=[("files", ("a.txt", b"hello", "text/plain"))])).status_code == 422
    assert (await evaluate(client, paper["id"], files=[("files", ("a.jpg", b"", "image/jpeg"))])).status_code == 422
    assert (await evaluate(client, paper["id"], files=[("files", ("a.jpg", b"not an image", "image/jpeg"))])).status_code == 422
    assert (await evaluate(client, paper["id"], files=[("files", ("a.pdf", b"not a pdf", "application/pdf"))])).status_code == 422
    too_many = [("files", (f"{i}.jpg", jpeg(), "image/jpeg")) for i in range(21)]
    assert (await evaluate(client, paper["id"], files=too_many)).status_code == 422
    assert (await evaluate(client, paper["id"], name="  ")).status_code == 422
    assert (await evaluate(client, paper["id"], student_id="000000000000000000000dff")).status_code == 422  # not in this school
    assert (await evaluate(client, "0" * 24)).status_code == 404
    # PDFs are split into pages
    ok = await evaluate(client, paper["id"], files=[("files", ("sheet.pdf", pdf(3), "application/pdf"))])
    assert ok.status_code == 200

    override_current_user(make_current_user(Role.TEACHER, SCHOOL, user_id="000000000000000000000a99", teacher_id=TEACHER_ID))
    assert (await evaluate(client, paper["id"])).status_code == 404  # someone else's paper
    as_student()
    assert (await evaluate(client, paper["id"])).status_code == 403

    as_teacher()
    monkeypatch.setattr(llm, "is_configured", lambda: False)
    assert (await evaluate(client, paper["id"])).status_code == 503


# ------------------------------------------------------------------ batch

async def wait_for(client, job_id):
    for _ in range(100):
        job = (await client.get(f"{API}/batch/{job_id}")).json()
        if job["finished"]:
            return job
        await asyncio.sleep(0.05)
    raise AssertionError("batch did not finish")


def batch_files(*pages):
    return [("files", (f"p{i}.jpg", jpeg(), "image/jpeg")) for i in range(pages[0])]


@pytest.mark.asyncio
async def test_a_batch_grades_several_students_and_one_failure_does_not_stop_the_rest(client, school, grader):
    as_teacher()
    paper = await make_paper(client, school)
    grader.answers = {1: {"extracted_text": "a", "unanswered": False}, 2: {"extracted_text": "a", "unanswered": False}}
    students = json.dumps([{"student_name": "Asha", "page_count": 2}, {"student_name": "Broken", "page_count": 1}, {"student_name": "Ravi", "page_count": 1}])
    grader.fail_for = {"nothing"}  # filled in below once we know the question text, vision fails for every call of 'Broken'
    # (the fake can't tell students apart from the images, so make the second vision call fail)
    calls = {"n": 0}
    original = grader.vision

    async def flaky(system, user, images, retries=2, temperature=0.2):
        calls["n"] += 1
        if len(images) == 1 and calls["n"] == 2:
            raise llm.LLMError("scan unreadable")
        return await original(system, user, images, retries, temperature)

    llm.call_vision_json = flaky
    start = await client.post(f"{API}/batch", data={"paper_id": paper["id"], "students": students}, files=batch_files(4))
    assert start.status_code == 202, start.text
    job = start.json()
    assert [s["status"] for s in job["students"]] == ["queued"] * 3 and job["students"][0]["total_questions"] == 3
    done = await wait_for(client, job["id"])
    statuses = {s["student_name"]: s["status"] for s in done["students"]}
    assert sorted(statuses.values()) == ["done", "done", "failed"]
    failed = next(s for s in done["students"] if s["status"] == "failed")
    assert failed["error"] and "scan unreadable" not in failed["error"]  # no raw model errors shown to the teacher
    results = (await client.get(f"{API}/results", params={"paper_id": paper["id"]})).json()
    assert len(results) == 2 and all(r["total_marks_awarded"] == 2.0 for r in results)
    # a finished batch no longer blocks a new one
    assert (await client.post(f"{API}/batch", data={"paper_id": paper["id"], "students": json.dumps([{"student_name": "Meera", "page_count": 1}])}, files=batch_files(1))).status_code == 202


@pytest.mark.asyncio
async def test_batch_requests_are_validated(client, school, grader):
    as_teacher()
    paper = await make_paper(client, school)

    async def post(students, n_files):
        return await client.post(f"{API}/batch", data={"paper_id": paper["id"], "students": students}, files=batch_files(n_files))

    assert (await post("not json", 1)).status_code == 422
    assert (await post("[]", 1)).status_code == 422
    assert (await post(json.dumps([{"student_name": "A", "page_count": 0}]), 1)).status_code == 422
    assert (await post(json.dumps([{"student_name": "A", "page_count": 2}]), 3)).status_code == 422  # pages don't add up
    assert (await post(json.dumps([{"student_name": "", "page_count": 1}]), 1)).status_code == 422
    assert (await post(json.dumps([{"student_name": f"S{i}", "page_count": 1} for i in range(81)]), 81)).status_code == 422
    assert (await client.get(f"{API}/batch/{'0' * 24}")).status_code == 404


@pytest.mark.asyncio
async def test_a_second_batch_while_one_is_running_is_refused_and_jobs_are_private(client, school, grader):
    as_teacher()
    paper = await make_paper(client, school)
    gate = asyncio.Event()
    original = grader.vision

    async def slow(*a, **k):
        await gate.wait()
        return await original(*a, **k)

    llm.call_vision_json = slow
    one = json.dumps([{"student_name": "Asha", "page_count": 1}])
    first = (await client.post(f"{API}/batch", data={"paper_id": paper["id"], "students": one}, files=batch_files(1))).json()
    second = await client.post(f"{API}/batch", data={"paper_id": paper["id"], "students": one}, files=batch_files(1))
    assert second.status_code == 409

    override_current_user(make_current_user(Role.TEACHER, SCHOOL, user_id="000000000000000000000a99", teacher_id=TEACHER_ID))
    assert (await client.get(f"{API}/batch/{first['id']}")).status_code == 404
    as_teacher()
    gate.set()
    assert (await wait_for(client, first["id"]))["students"][0]["status"] == "done"


# ------------------------------------------------------------------ adjusting, report

@pytest.mark.asyncio
async def test_teachers_adjust_marks_and_the_total_follows(client, school, grader):
    as_teacher()
    paper = await make_paper(client, school)
    grader.answers = {3: {"extracted_text": "Because", "unanswered": False, "needs_review": True}}
    sheet = (await evaluate(client, paper["id"])).json()
    assert sheet["needs_review"] == 1
    bad = lambda **c: client.patch(f"{API}/results/{sheet['id']}", json={"changes": [{"question_number": 3, **c}]})  # noqa: E731
    assert (await bad(marks_awarded=2.5)).status_code == 422  # above the question's marks
    assert (await bad(marks_awarded=1.3)).status_code == 422  # not a half-mark step
    assert (await bad(marks_awarded=-1)).status_code == 422
    assert (await client.patch(f"{API}/results/{sheet['id']}", json={"changes": [{"question_number": 9, "marks_awarded": 1}]})).status_code == 422
    ok = (await bad(marks_awarded=2, feedback="Full marks after reading the scan.")).json()
    assert ok["total_marks_awarded"] == 2.0 and ok["needs_review"] == 0
    q3 = ok["questions"][2]
    assert q3["adjusted"] is True and q3["feedback"] == "Full marks after reading the scan."
    assert (await client.get(f"{API}/results/{sheet['id']}")).json()["total_marks_awarded"] == 2.0  # saved
    assert (await client.delete(f"{API}/results/{sheet['id']}")).status_code == 204
    assert (await client.get(f"{API}/results/{sheet['id']}")).status_code == 404


@pytest.mark.asyncio
async def test_report_has_a_class_summary_and_a_section_per_student(client, school, grader):
    as_teacher()
    paper = await make_paper(client, school)
    other = await make_paper(client, school, mcq=0, short=1)
    grader.answers = {1: {"extracted_text": "a", "unanswered": False}}
    a = (await evaluate(client, paper["id"], name="Asha")).json()
    grader.answers = {}
    b = (await evaluate(client, paper["id"], name="Ravi | with a pipe")).json()
    assert (await client.post(f"{API}/report", json={"paper_id": "0" * 24})).status_code == 404

    r = await client.post(f"{API}/report", json={"paper_id": paper["id"], "format": "text"})
    assert r.status_code == 200, r.text
    info = r.json()["file"]
    assert info["kind"] == "grading_report"
    text = (await client.get(f"/api/v1/copilot/files/{info['id']}/download")).text
    assert "Class summary" in text and "Asha" in text and "Ravi" in text and text.index("Asha") < text.index("Ravi")  # best first
    assert "Maximum marks: 4" in text and "1 / 4" in text and "Ravi \\| with a pipe" in text
    only = await client.post(f"{API}/report", json={"paper_id": paper["id"], "result_ids": [b["id"]], "format": "text"})
    assert "Asha" not in (await client.get(f"/api/v1/copilot/files/{only.json()['file']['id']}/download")).text
    assert (await client.post(f"{API}/report", json={"paper_id": other["id"], "result_ids": [a["id"]], "format": "text"})).status_code == 422
    assert (await client.post(f"{API}/report", json={"paper_id": other["id"], "format": "text"})).status_code == 422  # none graded yet
    assert (await client.post(f"{API}/report", json={"paper_id": paper["id"], "format": "docx"})).status_code == 422
