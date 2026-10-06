"""Draft a short message from a teacher to a parent."""
from pydantic import BaseModel, Field

from app.copilot import llm
from app.copilot.features.base import Feature, field_spec


class ParentNoteParams(BaseModel):
    purpose: str = Field(default="general", max_length=40)
    student_name: str = Field(default="", max_length=100)
    details: str = Field(default="", max_length=1500)
    tone: str = Field(default="warm", max_length=20)
    language: str = "English"


async def run(current, ctx, params: dict) -> dict:
    p = ParentNoteParams(**params)
    system = (
        "You draft short, respectful messages from a school teacher to a student's parent or guardian. "
        f"Tone: {p.tone}. Keep it under 150 words, specific and constructive, with a clear next step when "
        f"relevant. Do not invent facts beyond what the teacher gives you. Write in {p.language}. "
        "Return only the message text, ready to send."
    )
    user = (
        f"Teacher: {current.user.full_name}\nPurpose: {p.purpose}\n"
        f"Student: {p.student_name or '(not named)'}\nDetails from the teacher: {p.details or '(none)'}"
    )
    return {"title": "Message to parent", "content": await llm.call_text(system, user)}


FEATURE = Feature(
    key="parent_note",
    title="Parent note",
    description="Draft a message to a parent: appreciation, concern, reminder or meeting request.",
    icon="MessageSquareText",
    handler=run,
    fields=[
        field_spec("purpose", "Purpose", "select", default="general",
                   options=["general", "appreciation", "concern", "reminder", "meeting request", "homework follow-up"]),
        field_spec("student_name", "Student name (optional)"),
        field_spec("tone", "Tone", "select", default="warm", options=["warm", "formal", "firm but kind"]),
        field_spec("details", "What should the message say?", "textarea", required=True),
    ],
)
