"""Grade scanned answer sheets against a question paper generated here. One sheet is graded in the request; a class set runs
in the background (a few students at a time) and the teacher polls its progress. Marks can be adjusted afterwards, and a
report (one section per student) is saved as PDF to the teacher's file history."""
import asyncio
import json
import logging
from datetime import timedelta

from fastapi import UploadFile

from app.copilot import llm
from app.copilot.features.export import export_markdown
from app.copilot.grading import images
from app.copilot.grading.evaluator import evaluate_question
from app.copilot.grading.extraction import extract_answers
from app.copilot.qpg import service as qpg
from app.core.deps import CurrentUser
from app.core.exceptions import AppError, NotFoundError, ValidationAppError
from app.models.base import utcnow
from app.models.copilot_grading import GradedSheet, GradingJob
from app.models.copilot_qpg import GeneratedPaper
from app.models.student import Student

logger = logging.getLogger("copilot.grading")

BATCH_CONCURRENCY = 4
MAX_STUDENTS_PER_BATCH = 80
STALE_JOB_MINUTES = 45
_tasks: set[asyncio.Task] = set()  # keep references so a running batch isn't garbage-collected


def sheet_out(s: GradedSheet, *, summary: bool = False) -> dict:
    out = {"id": str(s.id), "paper_id": s.paper_id, "student_name": s.student_name, "student_id": s.student_id,
           "total_marks_possible": s.total_marks_possible, "total_marks_awarded": s.total_marks_awarded,
           "needs_review": sum(1 for q in s.questions if q.get("needs_review") and not q.get("adjusted")), "created_at": s.created_at}
    if not summary:
        out["questions"] = s.questions
    return out


async def _check_student(current: CurrentUser, student_id: str | None) -> str | None:
    if not student_id:
        return None
    student = await Student.get(student_id) if len(student_id) == 24 else None
    if student is None or student.school_id != current.school_id:
        raise ValidationAppError("That student isn't in your school")
    return student_id


async def grade_pages(current: CurrentUser, paper: GeneratedPaper, student_name: str, student_id: str | None,
                      pages: list[bytes], on_progress=None) -> GradedSheet:
    questions = paper.questions
    extracted = await extract_answers(questions, pages)
    graded = []
    for n, q in enumerate(questions, 1):
        if on_progress:
            await on_progress(n, len(questions))
        found = extracted.get(n)
        answer = "" if found is None or found["unanswered"] else found["extracted_text"]
        marks, feedback, review = await evaluate_question(q, answer, paper.subject_name)
        graded.append({"question_number": n, "question_type": q["question_type"], "marks_possible": q["marks"], "marks_awarded": marks,
                       "student_answer": answer, "feedback": feedback, "needs_review": review or bool(found and found["needs_review"]),
                       "adjusted": False})
    sheet = GradedSheet(school_id=current.school_id, user_id=current.id, paper_id=str(paper.id), student_name=student_name,
                        student_id=student_id, total_marks_possible=paper.total_marks,
                        total_marks_awarded=sum(g["marks_awarded"] for g in graded), questions=graded)
    await sheet.insert()
    return sheet


def _name(value: str) -> str:
    value = (value or "").strip()
    if not value or len(value) > 200:
        raise ValidationAppError("Enter the student's name (up to 200 characters)")
    return value


async def evaluate(current: CurrentUser, paper_id: str, student_name: str, student_id: str | None, files: list[UploadFile]) -> dict:
    paper = await qpg.get_owned(current, paper_id)
    if not files:
        raise ValidationAppError("Upload the answer sheet pages")
    if not llm.is_configured():
        raise llm.LLMNotConfigured("The AI model is not configured. Set GEMINI_API_KEY on the server.")
    name, sid = _name(student_name), await _check_student(current, student_id)
    try:
        pages = await asyncio.to_thread(images.pages_from_bytes, await images.read_uploads(files))
    except images.UnsupportedUpload as exc:
        raise ValidationAppError(str(exc)) from exc
    return sheet_out(await grade_pages(current, paper, name, sid, pages))


# ------------------------------------------------------------------ batches

def job_out(job: GradingJob) -> dict:
    students = [dict(s) for s in job.students]
    if any(s["status"] in ("queued", "grading") for s in students) and utcnow() - _aware(job.updated_at) > timedelta(minutes=STALE_JOB_MINUTES):
        for s in students:  # the server restarted or the task died: don't leave the teacher waiting forever
            if s["status"] in ("queued", "grading"):
                s["status"], s["error"] = "failed", "Grading was interrupted. Please grade this student again."
    return {"id": str(job.id), "paper_id": job.paper_id, "students": students,
            "finished": all(s["status"] in ("done", "failed") for s in students)}


def _aware(dt):
    return dt if dt.tzinfo else dt.replace(tzinfo=utcnow().tzinfo)


async def _set(job_id, index: int, **fields) -> None:
    job = await GradingJob.get(job_id)
    if job is None:
        return
    job.students[index].update(fields)
    job.updated_at = utcnow()
    await job.save()


async def _run_batch(current: CurrentUser, job_id, paper: GeneratedPaper, work: list[tuple[int, str, str | None, list[bytes]]]) -> None:
    sem = asyncio.Semaphore(BATCH_CONCURRENCY)

    async def one(index: int, name: str, sid: str | None, pages: list[bytes]) -> None:
        async with sem:
            await _set(job_id, index, status="grading")

            async def progress(n: int, total: int) -> None:
                await _set(job_id, index, current_question=n, total_questions=total)

            try:
                sheet = await grade_pages(current, paper, name, sid, pages, progress)
                await _set(job_id, index, status="done", result_id=str(sheet.id), current_question=None)
            except Exception as exc:  # noqa: BLE001 - one bad sheet must not stop the batch
                logger.warning("Batch grading failed for %s: %s", name, type(exc).__name__)
                msg = str(exc) if isinstance(exc, llm.LLMNotConfigured) else "Grading failed for this student. Please try again."
                await _set(job_id, index, status="failed", error=msg, current_question=None)

    await asyncio.gather(*(one(*w) for w in work), return_exceptions=True)


async def start_batch(current: CurrentUser, paper_id: str, students_json: str, files: list[UploadFile]) -> dict:
    paper = await qpg.get_owned(current, paper_id)
    if not llm.is_configured():
        raise llm.LLMNotConfigured("The AI model is not configured. Set GEMINI_API_KEY on the server.")
    try:
        entries = json.loads(students_json)
        assert isinstance(entries, list) and entries
    except (ValueError, AssertionError):
        raise ValidationAppError("students must be a JSON list of {student_name, page_count}") from None
    if len(entries) > MAX_STUDENTS_PER_BATCH:
        raise ValidationAppError(f"At most {MAX_STUDENTS_PER_BATCH} students per batch")
    running = await GradingJob.find(GradingJob.school_id == current.school_id, GradingJob.user_id == current.id).sort(-GradingJob.created_at).limit(1).to_list()
    if running and not job_out(running[0])["finished"]:
        raise AppError(409, "A batch is still being graded. Wait for it to finish first.")

    counts = []
    for e in entries:
        if not isinstance(e, dict) or not isinstance(e.get("page_count"), int) or not 1 <= e["page_count"] <= images.MAX_PAGES_PER_SHEET:
            raise ValidationAppError("Each student needs a page_count between 1 and 20")
        counts.append(e["page_count"])
    if sum(counts) != len(files):
        raise ValidationAppError(f"The students' page counts add up to {sum(counts)} but {len(files)} files were uploaded")
    try:
        raw = await images.read_uploads(files)
        work, start = [], 0
        for i, (e, n) in enumerate(zip(entries, counts)):
            pages = await asyncio.to_thread(images.pages_from_bytes, raw[start:start + n])
            start += n
            work.append((i, _name(e.get("student_name", "")), await _check_student(current, e.get("student_id")), pages))
    except images.UnsupportedUpload as exc:
        raise ValidationAppError(str(exc)) from exc

    job = GradingJob(school_id=current.school_id, user_id=current.id, paper_id=str(paper.id),
                     students=[{"student_name": w[1], "student_id": w[2], "status": "queued", "current_question": None,
                                "total_questions": len(paper.questions), "result_id": None, "error": None} for w in work])
    await job.insert()
    task = asyncio.create_task(_run_batch(current, job.id, paper, work))
    _tasks.add(task)
    task.add_done_callback(_tasks.discard)
    return job_out(job)


async def get_job(current: CurrentUser, job_id: str) -> dict:
    job = await GradingJob.get(job_id) if len(job_id) == 24 else None
    if job is None or job.school_id != current.school_id or job.user_id != current.id:
        raise NotFoundError("Batch not found")
    return job_out(job)


# ------------------------------------------------------------------ results

async def get_sheet(current: CurrentUser, sheet_id: str) -> GradedSheet:
    sheet = await GradedSheet.get(sheet_id) if len(sheet_id) == 24 else None
    if sheet is None or sheet.school_id != current.school_id or sheet.user_id != current.id:
        raise NotFoundError("Graded sheet not found")
    return sheet


async def list_sheets(current: CurrentUser, paper_id: str | None) -> list[dict]:
    q = [GradedSheet.school_id == current.school_id, GradedSheet.user_id == current.id]
    if paper_id:
        q.append(GradedSheet.paper_id == paper_id)
    return [sheet_out(s, summary=True) for s in await GradedSheet.find(*q).sort(-GradedSheet.created_at).limit(200).to_list()]


async def adjust(current: CurrentUser, sheet_id: str, changes: list[dict]) -> dict:
    """Teacher overrides: [{question_number, marks_awarded, feedback?}]. Marks stay within 0..marks_possible, in half-mark steps."""
    sheet = await get_sheet(current, sheet_id)
    by_number = {q["question_number"]: q for q in sheet.questions}
    for c in changes:
        q = by_number.get(c.get("question_number"))
        if q is None:
            raise ValidationAppError(f"There is no question {c.get('question_number')}")
        marks = c.get("marks_awarded")
        if not isinstance(marks, (int, float)) or marks < 0 or marks > q["marks_possible"] or (marks * 2) % 1:
            raise ValidationAppError(f"Question {q['question_number']}: marks must be 0 to {q['marks_possible']} in half-mark steps")
        q["marks_awarded"], q["adjusted"] = float(marks), True
        if c.get("feedback") is not None:
            q["feedback"] = str(c["feedback"])[:2000]
    sheet.questions = list(by_number.values())
    sheet.total_marks_awarded = sum(q["marks_awarded"] for q in sheet.questions)
    sheet.updated_at = utcnow()
    await sheet.save()
    return sheet_out(sheet)


async def delete_sheet(current: CurrentUser, sheet_id: str) -> None:
    await (await get_sheet(current, sheet_id)).delete()


# ------------------------------------------------------------------ report

def _cell(text: str) -> str:
    return (text or "").replace("|", "\\|").replace("\n", " ").strip() or "-"


def report_markdown(paper: GeneratedPaper, sheets: list[GradedSheet]) -> str:
    parts = []
    ranked = sorted(sheets, key=lambda s: -s.total_marks_awarded)
    parts.append("## Class summary\n\n| Student | Marks | % |\n|---|---|---|\n" + "\n".join(
        f"| {_cell(s.student_name)} | {s.total_marks_awarded:g} / {s.total_marks_possible} | {round(100 * s.total_marks_awarded / s.total_marks_possible) if s.total_marks_possible else 0}% |"
        for s in ranked) + "\n")
    for s in sheets:
        rows = "\n".join(
            f"| {q['question_number']} | {q['question_type'].replace('_', ' ')} | {q['marks_awarded']:g} / {q['marks_possible']} | {_cell(q['student_answer'])} | {_cell(q['feedback'])}{' (check)' if q.get('needs_review') and not q.get('adjusted') else ''} |"
            for q in s.questions)
        parts.append(f"---\n\n## {s.student_name}: {s.total_marks_awarded:g} / {s.total_marks_possible}\n\n"
                     f"| Q | Type | Marks | Student's answer | Feedback |\n|---|---|---|---|---|\n{rows}\n")
    return "\n".join(parts)


async def report(current: CurrentUser, paper_id: str, result_ids: list[str] | None, export_format: str) -> dict:
    paper = await qpg.get_owned(current, paper_id)
    sheets = [await get_sheet(current, i) for i in result_ids] if result_ids else [
        s for s in await GradedSheet.find(GradedSheet.school_id == current.school_id, GradedSheet.user_id == current.id,
                                          GradedSheet.paper_id == paper_id).sort(GradedSheet.student_name).to_list()]
    if not sheets:
        raise ValidationAppError("There are no graded sheets for that paper yet")
    if any(s.paper_id != paper_id for s in sheets):
        raise ValidationAppError("Those sheets belong to a different paper")
    if export_format not in ("pdf", "text"):
        raise ValidationAppError("format must be pdf or text")
    title = f"Grading report - {paper.subject_name} {paper.class_name}"
    header = [f"Class: {paper.class_name}    Subject: {paper.subject_name}", f"Maximum marks: {paper.total_marks}    Students: {len(sheets)}"]
    return await export_markdown(current, "grading_report", title, header, report_markdown(paper, sheets), export_format, {"paper_id": paper_id})
