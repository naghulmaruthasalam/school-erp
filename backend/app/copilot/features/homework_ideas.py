"""Homework ideas for a chapter. Each one can be turned into real homework from the chapter page."""
from typing import Literal

from pydantic import BaseModel, Field

from app.copilot import llm
from app.copilot.features.base import Feature, field_spec
from app.core.exceptions import AppError
from app.models.homework import Homework

KINDS = {"written": "written practice", "practical": "hands-on activity", "project": "small project", "reading": "reading and reflection", "mixed": "a mix"}


class HomeworkIdeasParams(BaseModel):
    count: int = Field(default=3, ge=1, le=6)
    kind: Literal["mixed", "written", "practical", "project", "reading"] = "mixed"
    minutes: int = Field(default=30, ge=10, le=120)
    language: str = "English"


async def run(current, ctx, params: dict) -> dict:
    p = HomeworkIdeasParams(**params)
    given = []
    if ctx.chapter and ctx.subject_id:  # what this chapter already has, so ideas don't repeat it
        rows = await Homework.find(
            Homework.school_id == current.school_id, Homework.subject_id == ctx.subject_id, Homework.chapter == ctx.chapter
        ).sort(-Homework.created_at).limit(10).to_list()
        given = [h.title for h in rows]
    system = (
        "You are a teaching assistant who designs homework for school classes. Use the curriculum material given. "
        f"Suggest {p.count} different homework tasks ({KINDS[p.kind]}) that take about {p.minutes} minutes each, suit "
        "the class level, need only things a child has at home, and can be checked by a teacher. "
        f"Write in {p.language}. For maths use KaTeX LaTeX in single dollar signs. Respond ONLY with JSON: "
        '{"ideas": [{"title": "short title", "kind": "written|practical|project|reading", "minutes": 30, '
        '"instructions": "what the student does, step by step, in Markdown", "what_to_check": "how the teacher can check it"}]}'
    )
    user = (
        f"Class: {ctx.class_name}\nSubject: {ctx.subject_name}\nChapter: {ctx.chapter or 'whole syllabus'}\n"
        f"Already assigned for this chapter (do not repeat): {given or 'nothing yet'}\n\nMaterial:\n{ctx.text}"
    )
    data = await llm.call_json(system, user)
    ideas = []
    for raw in data.get("ideas", []):
        if not isinstance(raw, dict) or not str(raw.get("title", "")).strip() or not str(raw.get("instructions", "")).strip():
            continue
        ideas.append({
            "title": str(raw["title"]).strip(),
            "kind": str(raw.get("kind", "written")).strip().lower(),
            "minutes": raw.get("minutes") if isinstance(raw.get("minutes"), int) else p.minutes,
            "instructions": str(raw["instructions"]).strip(),
            "what_to_check": str(raw.get("what_to_check", "")).strip(),
        })
    if not ideas:
        raise AppError(502, "The AI could not produce usable homework ideas. Please try again.")
    ideas = ideas[: p.count]
    content = "\n\n".join(
        f"### {i}. {x['title']} ({x['kind']}, about {x['minutes']} min)\n{x['instructions']}"
        + (f"\n\n*Check:* {x['what_to_check']}" if x["what_to_check"] else "")
        for i, x in enumerate(ideas, 1)
    )
    return {
        "title": f"Homework ideas: {ctx.chapter or ctx.subject_name}",
        "content": content,
        "ideas": ideas,
        "context": {"class_id": ctx.class_id, "subject_id": ctx.subject_id, "chapter": ctx.chapter},
    }


FEATURE = Feature(
    key="homework_ideas",
    title="Homework ideas",
    description="Suitable homework tasks for a chapter, ready to assign to a class with one click.",
    icon="NotebookPen",
    handler=run,
    needs_context=True,
    require_subject=True,
    require_chapter=True,
    fields=[
        field_spec("count", "How many ideas", "number", default=3, min=1, max=6),
        field_spec("kind", "Type of task", "select", default="mixed", options=list(KINDS)),
        field_spec("minutes", "Minutes per task", "number", default=30, min=10, max=120),
    ],
)
