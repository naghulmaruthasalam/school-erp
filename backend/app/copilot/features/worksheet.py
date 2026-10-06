"""Worksheet generator (teacher): pick topics + activity types from a chapter, then generate the worksheet."""
from typing import Literal

from pydantic import BaseModel, Field

from app.copilot import llm
from app.copilot.features.base import Feature, field_spec
from app.copilot.features.export import export_markdown


class SelectedTopic(BaseModel):
    topic: str = Field(max_length=300)
    activities: list[str] = Field(max_length=10)


class WorksheetHeader(BaseModel):
    school_name: str = Field(default="", max_length=200)
    student_name_label: str = Field(default="Student Name:", max_length=100)
    grade_class_label: str = Field(default="Grade / Class:", max_length=100)
    subject_label: str = Field(default="Subject:", max_length=100)
    date_label: str = Field(default="Date:", max_length=100)
    worksheet_title: str = Field(default="HOMEWORK WORKSHEET", max_length=200)


class WorksheetParams(BaseModel):
    step: Literal["topics", "generate", "finalize"] = "topics"
    selected_topics: list[SelectedTopic] = Field(default_factory=list, max_length=3)
    content: str = Field(default="", max_length=60000)  # finalize: the (possibly edited) generated worksheet
    header: WorksheetHeader = Field(default_factory=WorksheetHeader)
    export_format: Literal["pdf", "text"] = "pdf"
    language: str = "English"


async def run(current, ctx, params: dict) -> dict:
    p = WorksheetParams(**params)
    where = f"Chapter: {ctx.chapter} (Class {ctx.class_name}, {ctx.subject_name})"
    if p.step == "topics":
        system = (
            "You are a curriculum assistant for school teachers. Given a chapter, identify the key teachable "
            "topics. For each topic write a one-sentence plain-language description and suggest 3-5 "
            "homework/worksheet activity types (e.g. 'Short-Answer Questions', 'Fill in the Blanks', 'Match the "
            "Following', 'Draw & Label Diagram'). Respond ONLY with JSON: "
            '{"topics": [{"topic": "string", "description": "string", "suggested_activities": ["string"]}]}'
        )
        data = await llm.call_json(system, f"{where}\n\nMaterial:\n{ctx.text}")
        topics = [t for t in data.get("topics", []) if isinstance(t, dict) and t.get("topic")]
        return {"step": "topics", "chapter": ctx.chapter, "topics": topics}

    if p.step == "finalize":
        from app.core.exceptions import ValidationAppError

        if not p.content.strip():
            raise ValidationAppError("There is no worksheet to export")
        h = p.header
        header_lines = [
            ctx.chapter or "",
            f"{h.student_name_label} ____________________________",
            f"{h.grade_class_label} {ctx.class_name}    {h.subject_label} {ctx.subject_name}",
            f"{h.date_label} ____________________",
        ]
        title = f"{h.school_name}\n{h.worksheet_title}" if h.school_name else h.worksheet_title
        return await export_markdown(current, "worksheet", title, header_lines, p.content, p.export_format,
                                     {"chapter": ctx.chapter, "subject": ctx.subject_name, "class": ctx.class_name})

    if not p.selected_topics:
        from app.core.exceptions import ValidationAppError

        raise ValidationAppError("Select at least one topic")
    system = (
        "You write homework worksheets for school teachers. Using the material and the teacher's selected "
        "topics and activity types, write a complete worksheet body: clear instructions, numbered "
        "questions/activities grouped by topic, suited to the class level. Do not add a title or header block. "
        "Format as Markdown, exactly: '## <Topic Name>' then a numbered list of that topic's questions, then a "
        "line with '---'. Use no level-1 heading and no code fences. Add no topic, introduction, summary, "
        f"answer key or bonus section beyond the listed topics. Write in {p.language}. "
        "For maths use KaTeX LaTeX in single dollar signs."
    )
    selection = "\n".join(f"- Topic: {t.topic} | Activities: {', '.join(t.activities)}" for t in p.selected_topics)
    content = await llm.call_text(system, f"{where}\n\nSelected topics and activities:\n{selection}\n\nMaterial:\n{ctx.text}")
    return {"step": "generate", "chapter": ctx.chapter, "title": f"Worksheet: {ctx.chapter}", "content": content}


FEATURE = Feature(
    key="worksheet",
    title="Worksheet generator",
    description="Choose topics and activities from a chapter, get a printable worksheet.",
    icon="FileText",
    handler=run,
    needs_context=True,
    require_subject=True,
    require_chapter=True,
    fields=[],  # two-step flow rendered by the UI's dedicated worksheet panel
)
