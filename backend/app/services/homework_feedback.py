"""AI feedback on a student's homework, from what the student actually handed in.

The submission's files (photos of handwriting, PDFs, Word documents, text files) and typed remarks are read, compared with the
homework's own instructions/questions and with the chapter's textbook notes, and the model returns a score, per-question
feedback, strengths and what to improve - written in the language the student uses in the app. The result is stored per
submission and language, and recomputed when the student hands in something different.
"""
import hashlib
import io
import logging
import re
import zipfile
from dataclasses import dataclass, field

from app.copilot import llm
from app.copilot.grading.images import MAX_FILE_SIZE_BYTES, UnsupportedUpload, pages_from_bytes
from app.core.lang import LANG_NAMES, normalize_lang
from app.core.s3 import read_bytes
from app.models.base import utcnow
from app.models.document import Document
from app.models.homework import Homework, HomeworkSubmission
from app.models.homework_validation import HomeworkValidation

logger = logging.getLogger("homework.feedback")

MAX_TEXT_CHARS = 12000
MAX_IMAGES = 8
MIN_PDF_TEXT = 80  # a PDF with less text than this is a scan: read it as page images


@dataclass
class Answer:
    text: str = ""
    pages: list[bytes] = field(default_factory=list)  # JPEG pages (photos, scanned PDFs)
    files: list[str] = field(default_factory=list)  # names we could read
    unreadable: list[str] = field(default_factory=list)

    @property
    def empty(self) -> bool:
        return not self.text.strip() and not self.pages


def _docx_text(raw: bytes) -> str:
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        xml = z.read("word/document.xml").decode("utf-8", errors="ignore")
    xml = re.sub(r"</w:p>", "\n", xml)
    return re.sub(r"<[^>]+>", "", xml)


def _pdf_text(raw: bytes) -> str:
    from pypdf import PdfReader

    return "\n".join((p.extract_text() or "") for p in PdfReader(io.BytesIO(raw)).pages)


async def collect_answer(submission: HomeworkSubmission) -> Answer:
    answer = Answer()
    chunks: list[str] = []
    if (submission.remarks or "").strip():
        chunks.append(f"[Typed note from the student]\n{submission.remarks.strip()}")
    for doc_id in submission.attachment_document_ids:
        try:
            doc = await Document.get(doc_id)
        except Exception:  # noqa: BLE001 - malformed id
            doc = None
        if doc is None or doc.school_id != submission.school_id:
            continue
        name, ctype = doc.original_filename or "file", (doc.content_type or "").lower()
        lower = name.lower()
        try:
            if doc.size_bytes > MAX_FILE_SIZE_BYTES:
                raise UnsupportedUpload("too large")
            raw = read_bytes(doc.s3_key)
            if ctype.endswith("pdf") or lower.endswith(".pdf"):
                text = _pdf_text(raw)
                if len(text.strip()) >= MIN_PDF_TEXT:
                    chunks.append(f"[{name}]\n{text.strip()}")
                else:
                    answer.pages.extend(pages_from_bytes([(name, ctype, raw)]))
            elif lower.endswith(".docx"):
                chunks.append(f"[{name}]\n{_docx_text(raw).strip()}")
            elif lower.endswith((".txt", ".md", ".csv")) or ctype.startswith("text/"):
                chunks.append(f"[{name}]\n{raw.decode('utf-8', errors='ignore').strip()}")
            elif ctype.startswith("image/") or lower.endswith((".jpg", ".jpeg", ".png", ".webp")):
                answer.pages.extend(pages_from_bytes([(name, ctype, raw)]))
            else:
                answer.unreadable.append(name)  # e.g. legacy .doc: say so rather than guess
                continue
            answer.files.append(name)
        except Exception as exc:  # noqa: BLE001 - one bad file must not stop the rest
            logger.info("Could not read %s: %s", name, type(exc).__name__)
            answer.unreadable.append(name)
    answer.text = "\n\n".join(chunks)[:MAX_TEXT_CHARS]
    answer.pages = answer.pages[:MAX_IMAGES]
    return answer


async def chapter_reference(school_id: str, homework: Homework, lang: str) -> str:
    """The textbook notes for the homework's chapter (any equivalent class/subject record), so marking follows the book."""
    from app.services import syllabus_service

    ch = await syllabus_service.find_chapter(school_id, homework.section_id, homework.subject_id, homework.chapter)
    if ch is None:
        return ""
    loc = ch.localized(lang)
    return f"{loc.name}\n{(loc.content or '').strip()}"[:6000]


SYSTEM = """You are a kind, fair teacher marking a school student's homework.
The homework text contains the task and its questions. Find the questions in it (if it is a single task, treat it as one question).
Compare what the student handed in with what was asked, using the textbook notes when given. Give each question a score out of its
marks (default 10 split sensibly; whole task = 10), say what is right, what is wrong and exactly how to fix it. Never invent
answers the student did not write: if a question is not answered, score 0 and say it was left out. Be encouraging and age-appropriate.
Write every feedback sentence in {language}. Respond ONLY with JSON:
{{"total_score": number, "max_score": number, "grade": "A|B|C|D|F", "overall_feedback": "2-3 sentences",
"strengths": ["..."], "areas_to_improve": ["..."],
"questions": [{{"question_number": 1, "student_answer": "what the student wrote (short)", "is_correct": true,
"score": number, "max_score": number, "feedback": "...", "suggestions": ["..."]}}]}}"""


def _num(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _clean(raw: dict) -> dict:
    questions = []
    for i, q in enumerate(raw.get("questions") or [], 1):
        if not isinstance(q, dict):
            continue
        mx = max(_num(q.get("max_score"), 10.0), 0.0)
        questions.append({
            "question_number": int(_num(q.get("question_number"), i)) or i,
            "student_answer": str(q.get("student_answer") or "")[:1500],
            "is_correct": bool(q.get("is_correct")),
            "score": min(max(_num(q.get("score")), 0.0), mx), "max_score": mx,
            "feedback": str(q.get("feedback") or "")[:1500],
            "suggestions": [str(s)[:300] for s in (q.get("suggestions") or [])][:4],
        })
    total_max = sum(q["max_score"] for q in questions) or max(_num(raw.get("max_score"), 10.0), 1.0)
    total = sum(q["score"] for q in questions) if questions else min(max(_num(raw.get("total_score")), 0.0), total_max)
    pct = round(total / total_max * 100, 1)
    grade = str(raw.get("grade") or "").strip().upper()[:1]
    if grade not in "ABCDF" or not grade:
        grade = "A" if pct >= 85 else "B" if pct >= 70 else "C" if pct >= 55 else "D" if pct >= 40 else "F"
    return {
        "total_score": round(total, 1), "max_score": round(total_max, 1), "percentage": pct, "grade": grade,
        "overall_feedback": str(raw.get("overall_feedback") or "")[:1500],
        "strengths": [str(s)[:300] for s in (raw.get("strengths") or [])][:5],
        "areas_to_improve": [str(s)[:300] for s in (raw.get("areas_to_improve") or [])][:5],
        "questions": questions,
    }


def fingerprint(submission: HomeworkSubmission) -> str:
    basis = "|".join([*submission.attachment_document_ids, submission.remarks or ""])
    return hashlib.sha1(basis.encode()).hexdigest()[:16]


def public(v: HomeworkValidation, status: str = "ready") -> dict:
    return {
        "status": status, "total_score": v.total_score, "max_score": v.max_score, "percentage": v.percentage, "grade": v.grade,
        "overall_feedback": v.overall_feedback, "strengths": v.strengths, "areas_to_improve": v.areas_to_improve,
        "questions": v.questions, "language": v.language, "files_checked": v.files_checked,
        "validated_at": v.validated_at.isoformat() if v.validated_at else None,
    }


async def feedback_for(submission: HomeworkSubmission, language: str = "en", *, force: bool = False, validated_by: str | None = None) -> dict:
    """Stored feedback for this submission+language, creating it (one model call) when missing or out of date.
    status: ready | unreadable (nothing we can read was handed in) | not_configured | pending (the AI service failed; try again)."""
    lang = normalize_lang(language)
    fp = fingerprint(submission)
    stored = await HomeworkValidation.find_one({"submission_id": str(submission.id), "language": lang})
    if stored and stored.fingerprint == fp and not force:
        return public(stored)

    homework = await Homework.get(submission.homework_id)
    if homework is None or homework.school_id != submission.school_id:
        return {"status": "pending", "message": "Homework not found"}
    answer = await collect_answer(submission)
    if answer.empty:
        return {"status": "unreadable", "files_unreadable": answer.unreadable,
                "message": "No readable answer was found. Upload a clear photo, a PDF or a Word (.docx) file, or type the answer."}
    if not llm.is_configured():
        return {"status": "not_configured", "message": "AI feedback isn't set up on this server yet."}

    reference = await chapter_reference(submission.school_id, homework, lang)
    user = (
        f"Homework title: {homework.title}\nHomework (task and questions):\n{(homework.description or homework.title)[:6000]}\n\n"
        + (f"Textbook notes for the chapter:\n{reference}\n\n" if reference else "")
        + (f"The student's answer (text):\n{answer.text}\n\n" if answer.text else "")
        + ("The attached images are the student's handwritten/printed answer pages in order. Read them first.\n" if answer.pages else "")
    )
    system = SYSTEM.format(language=LANG_NAMES[lang])
    try:
        raw = await (llm.call_vision_json(system, user, answer.pages) if answer.pages else llm.call_json(system, user))
    except llm.LLMNotConfigured:
        return {"status": "not_configured", "message": "AI feedback isn't set up on this server yet."}
    except llm.LLMError as exc:
        logger.warning("Homework feedback failed for %s: %s", submission.id, exc)
        return {"status": "pending", "message": "The AI service is busy. Please try again in a moment."}

    data = _clean(raw)
    if stored is None:
        stored = HomeworkValidation(
            school_id=submission.school_id, homework_id=submission.homework_id, student_id=submission.student_id,
            submission_id=str(submission.id), language=lang, fingerprint=fp, files_checked=answer.files, **data,
        )
        stored.validated_by = validated_by
        await stored.insert()
    else:
        for k, v in {**data, "language": lang, "fingerprint": fp, "files_checked": answer.files, "validated_at": utcnow(), "validated_by": validated_by}.items():
            setattr(stored, k, v)
        stored.updated_at = utcnow()
        await stored.save()
    return public(stored)


async def feedback_in_background(school_id: str, submission_id: str, language: str) -> None:
    """Fire-and-forget after a student hands in work, so the feedback is usually ready when they look. Never raises."""
    try:
        if not llm.is_configured():
            return
        submission = await HomeworkSubmission.get(submission_id)
        if submission is not None and submission.school_id == school_id:
            await feedback_for(submission, language)
    except Exception:  # noqa: BLE001
        logger.exception("Background homework feedback failed for %s", submission_id)
