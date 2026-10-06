"""Question paper generator: pick the class/subject/chapters and how many of each question type; questions come from the
school's bank (shuffle-bag rotation per teacher), topped up by the AI from the chapter's own syllabus text when the bank
runs short. The result is saved as a GeneratedPaper that can be exported as PDF or graded against.
"""
import hashlib
import logging
import math
import re

from beanie import PydanticObjectId

from app.copilot import llm
from app.copilot.features.export import export_markdown
from app.copilot.grounding import build_study_context, context_options
from app.copilot.qpg import rotation
from app.copilot.qpg.schemas import (
    MARKS_BY_TYPE, TYPE_LABELS, BankItemIn, ExportRequest, GenerateRequest, allowed_types, validate_selection,
    MAX_PAPER_MARKS, PER_CHAPTER_MARK_CAP,
)
from app.core.deps import CurrentUser
from app.core.exceptions import AppError, NotFoundError, ValidationAppError
from app.models.academic import Class
from app.models.base import utcnow
from app.models.copilot_qpg import GeneratedPaper, QuestionBankItem

logger = logging.getLogger("copilot.qpg")

MAX_PAPERS = 30
LETTERS = "ABCD"


def text_hash(text: str) -> str:
    return hashlib.sha1(re.sub(r"\W+", " ", text.lower()).strip().encode()).hexdigest()


def suggested_duration(questions: list[dict]) -> str:
    """Rough exam slot: 1.5 minutes per mark, rounded up to a quarter hour."""
    minutes = max(15, math.ceil(sum(q["marks"] for q in questions) * 1.5 / 15) * 15)
    hours, rest = divmod(minutes, 60)
    return " ".join(p for p in (f"{hours} hour{'s' if hours != 1 else ''}" if hours else "", f"{rest} minutes" if rest else "") if p)


# ------------------------------------------------------------------ options

async def options(current: CurrentUser) -> dict:
    ctx = await context_options(current)
    classes = [{**c, "types": [
        {"key": k, "label": TYPE_LABELS[k], "marks": MARKS_BY_TYPE[k], "max": mx} for k, mx in allowed_types(c["name"]).items()
    ]} for c in ctx["classes"]]
    return {"classes": classes, "limits": {"paper_marks": MAX_PAPER_MARKS, "chapter_marks": PER_CHAPTER_MARK_CAP}}


# ------------------------------------------------------------------ AI top-up

def _clean_generated(raw: dict, allowed: set[str]) -> dict | None:
    qtype = str(raw.get("question_type", "")).strip().lower()
    text = str(raw.get("text", "")).strip()
    answer = str(raw.get("answer", "") or "").strip()
    if qtype not in allowed or not text or len(text) > 5000:
        return None
    options = raw.get("options")
    if qtype == "mcq":
        if not isinstance(options, list) or len(options) != 4:
            return None
        options = [str(o).strip() for o in options]
        if len(answer) == 1 and answer.upper() in LETTERS:  # the model answered "B" instead of the option text
            answer = options[LETTERS.index(answer.upper())]
        if answer not in options:
            return None
    else:
        options = None
        if not answer:
            return None
    return {"question_type": qtype, "text": text, "options": options, "answer": answer, "keywords": str(raw.get("keywords", "") or "").strip() or None}


async def _top_up(current: CurrentUser, class_id: str, subject_id: str, chapter: str, needs: dict[str, int], language: str) -> int:
    """Ask the model for questions of the missing types, grounded in the chapter's syllabus text. Returns how many were stored."""
    ctx = await build_study_context(current, class_id, subject_id, chapter, require_subject=True)
    spec = ", ".join(f"{n} {t} ({MARKS_BY_TYPE[t]} mark{'s' if MARKS_BY_TYPE[t] != 1 else ''} each)" for t, n in needs.items())
    system = (
        "You write exam questions for school students from the curriculum material given (and general knowledge of the "
        "subject at this class level). Questions must be clear, answerable, different from each other and suit the class. "
        f"Write exactly these: {spec}. Write in {language}. For maths use KaTeX LaTeX in single dollar signs. Types: "
        "mcq = four options with exactly one correct; short = 2-3 sentence answer; state_precisely = one precise statement; "
        "answer_in_brief = a brief paragraph; long = a detailed answer with several points. Respond ONLY with JSON: "
        '{"questions": [{"question_type": "mcq|short|state_precisely|answer_in_brief|long", "text": "...", '
        '"options": ["..","..","..",".."] or null, "answer": "the correct option text for mcq, else a model answer", '
        '"keywords": "comma-separated key points a marker looks for"}]}'
    )
    user = f"Class: {ctx.class_name}\nSubject: {ctx.subject_name}\nChapter: {chapter}\n\nMaterial:\n{ctx.text}"
    data = await llm.call_json(system, user)
    stored = 0
    existing = {i.text_hash for i in await QuestionBankItem.find(
        QuestionBankItem.school_id == current.school_id, QuestionBankItem.class_id == class_id,
        QuestionBankItem.subject_id == subject_id, QuestionBankItem.chapter == chapter).to_list()}
    for raw in data.get("questions", []):
        q = _clean_generated(raw, set(needs)) if isinstance(raw, dict) else None
        if q is None or text_hash(q["text"]) in existing:
            continue
        existing.add(text_hash(q["text"]))
        await QuestionBankItem(
            school_id=current.school_id, class_id=class_id, subject_id=subject_id, chapter=chapter,
            marks=MARKS_BY_TYPE[q["question_type"]], text_hash=text_hash(q["text"]), source="ai", created_by=current.id, **q,
        ).insert()
        stored += 1
    return stored


# ------------------------------------------------------------------ generate

def _question_dict(item: QuestionBankItem) -> dict:
    return {"id": str(item.id), "chapter": item.chapter, "question_type": item.question_type, "marks": MARKS_BY_TYPE[item.question_type],
            "text": item.text, "options": item.options, "answer": item.answer, "keywords": item.keywords}


async def _bucket(school_id: str, class_id: str, subject_id: str, chapter: str, qtype: str) -> list[QuestionBankItem]:
    return await QuestionBankItem.find(
        QuestionBankItem.school_id == school_id, QuestionBankItem.class_id == class_id, QuestionBankItem.subject_id == subject_id,
        QuestionBankItem.chapter == chapter, QuestionBankItem.question_type == qtype).to_list()


async def generate(current: CurrentUser, req: GenerateRequest) -> dict:
    school_class = await Class.get(req.class_id) if len(req.class_id) == 24 else None
    if school_class is None or school_class.school_id != current.school_id:
        raise NotFoundError("Class not found")
    validate_selection(req, school_class.name)
    ctx = await build_study_context(current, req.class_id, req.subject_id, require_subject=True)  # access check + names
    unknown = [s.chapter for s in req.chapters if ctx.chapters and s.chapter not in ctx.chapters]
    if unknown:
        raise ValidationAppError(f"Not in this subject's syllabus: {', '.join(unknown)}")

    by_type: dict[str, list[dict]] = {t: [] for t in MARKS_BY_TYPE}
    topped_up = 0
    for sel in req.chapters:
        wanted = {t: n for t, n in sel.counts.items() if n > 0}
        buckets = {t: await _bucket(current.school_id, req.class_id, req.subject_id, sel.chapter, t) for t in wanted}
        short = {t: n - len(buckets[t]) for t, n in wanted.items() if len(buckets[t]) < n}
        if short:  # the bank can't fill this chapter: ask the AI for the shortfall (plus a couple spare so papers differ)
            try:
                topped_up += await _top_up(current, req.class_id, req.subject_id, sel.chapter, {t: n + 2 for t, n in short.items()}, req.language)
            except llm.LLMError as exc:
                if not any(buckets.values()):
                    raise  # nothing in the bank to fall back on: report the AI problem
                logger.warning("Top-up failed for %s: %s", sel.chapter, exc)
            buckets = {t: await _bucket(current.school_id, req.class_id, req.subject_id, sel.chapter, t) for t in wanted}
        for qtype, count in wanted.items():
            items = {str(i.id): i for i in buckets[qtype]}
            ids = await rotation.draw(current.school_id, current.id, req.class_id, req.subject_id, sel.chapter, qtype, list(items), count)
            by_type[qtype].extend(_question_dict(items[i]) for i in ids)

    questions = [q for t in MARKS_BY_TYPE for q in by_type[t]]
    if not questions:
        raise NotFoundError("No questions could be found or written for those chapters")
    paper = GeneratedPaper(
        school_id=current.school_id, user_id=current.id, class_id=req.class_id, class_name=school_class.name,
        subject_id=req.subject_id, subject_name=ctx.subject_name or "", chapters=[s.chapter for s in req.chapters if any(q["chapter"] == s.chapter for q in questions)],
        total_marks=sum(q["marks"] for q in questions), suggested_duration=suggested_duration(questions), questions=questions,
    )
    await paper.insert()
    for old in (await GeneratedPaper.find(GeneratedPaper.school_id == current.school_id, GeneratedPaper.user_id == current.id)
                .sort(-GeneratedPaper.created_at).skip(MAX_PAPERS).to_list()):
        await old.delete()
    return {**paper_out(paper), "new_questions_written": topped_up}


def paper_out(p: GeneratedPaper, *, summary: bool = False) -> dict:
    out = {"id": str(p.id), "class_id": p.class_id, "class_name": p.class_name, "subject_id": p.subject_id,
           "subject_name": p.subject_name, "chapters": p.chapters, "total_marks": p.total_marks,
           "suggested_duration": p.suggested_duration, "question_count": len(p.questions), "created_at": p.created_at}
    if not summary:
        out["questions"] = p.questions
    return out


async def list_papers(current: CurrentUser) -> list[dict]:
    rows = await GeneratedPaper.find(GeneratedPaper.school_id == current.school_id, GeneratedPaper.user_id == current.id).sort(-GeneratedPaper.created_at).limit(MAX_PAPERS).to_list()
    return [paper_out(p, summary=True) for p in rows]


async def get_owned(current: CurrentUser, paper_id: str) -> GeneratedPaper:
    paper = await GeneratedPaper.get(paper_id) if len(paper_id) == 24 else None
    if paper is None or paper.school_id != current.school_id or paper.user_id != current.id:
        raise NotFoundError("Question paper not found")
    return paper


async def delete_paper(current: CurrentUser, paper_id: str) -> None:
    await (await get_owned(current, paper_id)).delete()


# ------------------------------------------------------------------ export

def paper_markdown(paper: GeneratedPaper, include_answers: bool) -> str:
    out: list[str] = []
    number = 0
    section = 0
    for qtype in MARKS_BY_TYPE:
        qs = [q for q in paper.questions if q["question_type"] == qtype]
        if not qs:
            continue
        marks = MARKS_BY_TYPE[qtype]
        out.append(f"## Section {chr(ord('A') + section)}: {TYPE_LABELS[qtype]} ({marks} mark{'s' if marks != 1 else ''} each)\n")
        section += 1
        for q in qs:
            number += 1
            out.append(f"**{number}.** {q['text']} *[{q['marks']}]*\n")
            if q.get("options"):
                out.append("  \n".join(f"({chr(97 + i)}) {o}" for i, o in enumerate(q["options"])) + "\n")
            if include_answers:
                out.append(f"**Answer:** {q.get('answer') or '-'}" + (f"  \n**Key points:** {q['keywords']}" if q.get("keywords") else "") + "\n")
    return "\n".join(out)


async def export(current: CurrentUser, paper_id: str, req: ExportRequest) -> dict:
    paper = await get_owned(current, paper_id)
    h = req.header
    title = (h.exam_title or f"{paper.subject_name} - {paper.class_name}") + (" (Answer key)" if req.include_answers else "")
    lines = [l for l in (h.school_name, f"Class: {paper.class_name}    Subject: {paper.subject_name}",
                         f"Maximum marks: {paper.total_marks}    Time: {h.time_label or paper.suggested_duration}",
                         f"Date: {h.date_label}" if h.date_label else "", h.instructions) if l]
    if req.format not in ("pdf", "text"):
        raise ValidationAppError("format must be pdf or text")
    return await export_markdown(
        current, "answer_key" if req.include_answers else "question_paper", title, lines, paper_markdown(paper, req.include_answers),
        req.format, {"paper_id": str(paper.id)},
    )


# ------------------------------------------------------------------ the bank

def bank_out(i: QuestionBankItem) -> dict:
    return {"id": str(i.id), "class_id": i.class_id, "subject_id": i.subject_id, "chapter": i.chapter, "question_type": i.question_type,
            "marks": i.marks, "text": i.text, "options": i.options, "answer": i.answer, "keywords": i.keywords, "source": i.source}


async def list_bank(current: CurrentUser, class_id: str | None, subject_id: str | None, chapter: str | None, qtype: str | None) -> list[dict]:
    q = [QuestionBankItem.school_id == current.school_id]
    for field, value in ((QuestionBankItem.class_id, class_id), (QuestionBankItem.subject_id, subject_id),
                         (QuestionBankItem.chapter, chapter), (QuestionBankItem.question_type, qtype)):
        if value:
            q.append(field == value)
    rows = await QuestionBankItem.find(*q).sort(-QuestionBankItem.created_at).limit(200).to_list()
    return [bank_out(i) for i in rows]


async def add_to_bank(current: CurrentUser, body: BankItemIn) -> dict:
    school_class = await Class.get(body.class_id) if len(body.class_id) == 24 else None
    if school_class is None or school_class.school_id != current.school_id:
        raise NotFoundError("Class not found")
    await build_study_context(current, body.class_id, body.subject_id, body.chapter, require_subject=True)  # access + chapter exist
    if body.question_type not in allowed_types(school_class.name):
        raise ValidationAppError(f"'{body.question_type}' isn't a question type for {school_class.name}")
    options, answer = body.options, (body.answer or "").strip()
    if body.question_type == "mcq":
        if not options or len(options) != 4 or answer not in options:
            raise ValidationAppError("A multiple-choice question needs four options and the correct one as the answer")
    else:
        options = None
        if not answer:
            raise ValidationAppError("Add the model answer")
    h = text_hash(body.text)
    if await QuestionBankItem.find_one(QuestionBankItem.school_id == current.school_id, QuestionBankItem.class_id == body.class_id,
                                       QuestionBankItem.subject_id == body.subject_id, QuestionBankItem.chapter == body.chapter,
                                       QuestionBankItem.text_hash == h):
        raise ValidationAppError("That question is already in the bank")
    item = QuestionBankItem(school_id=current.school_id, class_id=body.class_id, subject_id=body.subject_id, chapter=body.chapter,
                            question_type=body.question_type, marks=MARKS_BY_TYPE[body.question_type], text=body.text, options=options,
                            answer=answer, keywords=body.keywords, text_hash=h, source="teacher", created_by=current.id)
    await item.insert()
    return bank_out(item)


async def delete_from_bank(current: CurrentUser, item_id: str) -> None:
    item = await QuestionBankItem.get(item_id) if len(item_id) == 24 else None
    if item is None or item.school_id != current.school_id:
        raise NotFoundError("Question not found")
    await item.delete()
