"""Revision plan for a student built from their own pending homework and upcoming exams."""
from datetime import date

from pydantic import BaseModel, Field

from app.copilot import llm
from app.copilot.features import erp_data
from app.copilot.features.base import Feature, field_spec


class StudyPlanParams(BaseModel):
    days: int = Field(default=7, ge=3, le=14)
    minutes_per_day: int = Field(default=60, ge=20, le=240)
    focus: str = Field(default="", max_length=300)
    language: str = "English"


def _short(items, limit=12):
    if isinstance(items, dict):
        items = items.get("items", [])
    return [it for it in (items or [])][:limit]


async def run(current, ctx, params: dict) -> dict:
    p = StudyPlanParams(**params)
    homework = _short(await erp_data.call(current, "get_my_pending_homework"))
    exams = _short(await erp_data.call(current, "list_exams"))
    upcoming = [e for e in exams if str(e.get("end_date", "9999")) >= date.today().isoformat()]
    system = (
        "You are Study Buddy. Build a realistic day-by-day revision plan for a school student from their own "
        "pending homework and upcoming exams. Order by deadline, mix subjects, include short breaks and one "
        "lighter day, and keep each day within the daily time budget. Use only the data given; if there is "
        "none, make a balanced plan from the focus text. "
        f"Write in {p.language}. Reply in Markdown with a heading per day and a short encouraging closing line."
    )
    user = (
        f"Today: {date.today().isoformat()}\nDays to plan: {p.days}\nMinutes per day: {p.minutes_per_day}\n"
        f"Focus: {p.focus or '(none)'}\nPending homework: {homework}\nUpcoming exams: {upcoming}"
    )
    return {"title": f"{p.days}-day study plan", "content": await llm.call_text(system, user)}


FEATURE = Feature(
    key="study_plan",
    title="Study plan",
    description="A day-by-day plan around your homework deadlines and exams.",
    icon="CalendarCheck",
    handler=run,
    fields=[
        field_spec("days", "Days to plan", "number", default=7, min=3, max=14),
        field_spec("minutes_per_day", "Study minutes per day", "number", default=60, min=20, max=240),
        field_spec("focus", "Anything to focus on? (optional)", "text"),
    ],
)
