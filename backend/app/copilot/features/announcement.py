"""Draft a school notice or announcement (principal / admin profiles)."""
from pydantic import BaseModel, Field

from app.copilot import llm
from app.copilot.features.base import Feature, field_spec


class AnnouncementParams(BaseModel):
    topic: str = Field(max_length=300)
    audience: str = Field(default="parents and students", max_length=60)
    tone: str = Field(default="formal", max_length=20)
    details: str = Field(default="", max_length=1500)
    language: str = "English"


async def run(current, ctx, params: dict) -> dict:
    p = AnnouncementParams(**params)
    system = (
        "You write clear school announcements. Include a short subject line, the key facts (what, when, where, "
        f"who must act), and a courteous close. Tone: {p.tone}. Do not invent dates, fees or names that were "
        f"not provided; write [to be confirmed] instead. Write in {p.language}. Return only the announcement."
    )
    user = f"Audience: {p.audience}\nTopic: {p.topic}\nDetails: {p.details or '(none)'}"
    return {"title": "Announcement draft", "content": await llm.call_text(system, user)}


FEATURE = Feature(
    key="announcement",
    title="Announcement draft",
    description="Draft a notice for parents, students or staff.",
    icon="Megaphone",
    handler=run,
    fields=[
        field_spec("topic", "Topic", required=True),
        field_spec("audience", "Audience", "select", default="parents and students", options=["parents and students", "parents", "students", "staff"]),
        field_spec("tone", "Tone", "select", default="formal", options=["formal", "friendly", "urgent"]),
        field_spec("details", "Details (dates, venue, actions)", "textarea"),
    ],
)
