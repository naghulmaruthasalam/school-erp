"""Practice quiz / class test questions on a chapter (student self-practice, teacher class test)."""
from typing import Literal

from pydantic import BaseModel, Field

from app.copilot import llm
from app.copilot.features.base import Feature, field_spec
from app.core.exceptions import AppError

LETTERS = "ABCD"


class QuizParams(BaseModel):
    count: int = Field(default=5, ge=3, le=15)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    question_type: Literal["mcq", "short", "mixed"] = "mixed"
    language: str = "English"


def _clean(raw: dict) -> dict | None:
    question = str(raw.get("question", "")).strip()
    answer = str(raw.get("answer", "")).strip()
    if not question or not answer:
        return None
    kind = "mcq" if raw.get("type") == "mcq" else "short"
    options = raw.get("options")
    if kind == "mcq":
        if not isinstance(options, list) or len(options) != 4:
            return None
        options = [str(o).strip() for o in options]
        if len(answer) == 1 and answer.upper() in LETTERS:  # model answered "B" instead of the option text
            answer = options[LETTERS.index(answer.upper())]
        if answer not in options:
            return None
    else:
        options = None
    return {"type": kind, "question": question, "options": options, "answer": answer,
            "explanation": str(raw.get("explanation", "")).strip()}


async def run(current, ctx, params: dict) -> dict:
    p = QuizParams(**params)
    mix = {"mcq": "all multiple-choice (4 options)", "short": "all short-answer", "mixed": "a mix of multiple-choice (4 options) and short-answer"}[p.question_type]
    system = (
        "You write quiz questions for school students. Use ONLY the curriculum material given (and general "
        f"knowledge of the subject at this class level). Write {p.count} {p.difficulty} questions, {mix}. "
        f"Write in {p.language}. For maths use KaTeX LaTeX in single dollar signs. Respond ONLY with JSON: "
        '{"questions": [{"type": "mcq" or "short", "question": "...", "options": ["...","...","...","..."] or null, '
        '"answer": "the correct option text, or the model short answer", "explanation": "one or two sentences"}]}'
    )
    user = f"Class: {ctx.class_name}\nSubject: {ctx.subject_name}\nChapter: {ctx.chapter or 'whole syllabus'}\n\nMaterial:\n{ctx.text}"
    data = await llm.call_json(system, user)
    questions = [q for q in (_clean(r) for r in data.get("questions", []) if isinstance(r, dict)) if q]
    if not questions:
        raise AppError(502, "The AI could not produce a usable quiz. Please try again.")
    return {"title": f"{ctx.subject_name}: {ctx.chapter or 'Practice'} ({p.difficulty})", "questions": questions[: p.count]}


FEATURE = Feature(
    key="quiz",
    title="Practice quiz",
    description="Questions with answers and explanations on a chapter.",
    icon="ListChecks",
    handler=run,
    needs_context=True,
    require_subject=True,
    fields=[
        field_spec("count", "Number of questions", "number", default=5, min=3, max=15),
        field_spec("difficulty", "Difficulty", "select", default="medium", options=["easy", "medium", "hard"]),
        field_spec("question_type", "Question type", "select", default="mixed", options=["mixed", "mcq", "short"]),
    ],
)
