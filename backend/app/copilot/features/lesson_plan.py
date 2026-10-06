"""Lesson plan generator (teacher): extract topics, then schedule them across the teacher's available days.
Ported from the Skillorea lesson plan service (same prompt, validation and coverage/surplus notices)."""
import logging
import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, ValidationError, model_validator

from app.copilot import llm
from app.copilot.features.base import Feature

logger = logging.getLogger("copilot.lesson_plan")

MAX_SCHEDULE_SPAN_DAYS = 30
MAX_TEACHING_MINUTES_PER_DAY = 480


class TeachingSlot(BaseModel):
    date: date
    minutes: int = Field(gt=0, le=MAX_TEACHING_MINUTES_PER_DAY)


class LessonPlanParams(BaseModel):
    step: Literal["topics", "schedule"] = "topics"
    topics: list[str] = Field(default_factory=list, max_length=50)
    start_date: date | None = None
    target_completion: date | None = None
    teaching_dates: list[TeachingSlot] = Field(default_factory=list)
    language: str = "English"

    @model_validator(mode="after")
    def _check_schedule(self) -> "LessonPlanParams":
        if self.step != "schedule":
            return self
        if not self.topics:
            raise ValueError("topics are required")
        if not self.start_date or not self.target_completion or not self.teaching_dates:
            raise ValueError("start_date, target_completion and teaching_dates are required")
        if self.target_completion < self.start_date:
            raise ValueError("target_completion cannot be before start_date")
        if (self.target_completion - self.start_date).days > MAX_SCHEDULE_SPAN_DAYS:
            raise ValueError(f"The schedule can span at most {MAX_SCHEDULE_SPAN_DAYS} days")
        seen: set[date] = set()
        for slot in self.teaching_dates:
            if not (self.start_date <= slot.date <= self.target_completion):
                raise ValueError(f"{slot.date.isoformat()} is outside the start/target date range")
            if slot.date in seen:
                raise ValueError(f"duplicate teaching date {slot.date.isoformat()}")
            seen.add(slot.date)
        return self


class SequenceStep(BaseModel):
    label: str = Field(max_length=60)
    minutes: int = Field(gt=0)
    description: str = Field(max_length=1500)


class LessonSlot(BaseModel):
    date: date
    topic: str
    minutes_allocated: int
    session_type: str = Field(max_length=60)
    sequence: list[SequenceStep] = Field(min_length=1)
    teacher_note: str
    pacing_flag: str | None = None


_DASH = re.compile(r"\s*(?:—|--)\s*")


def _arrow(text):
    return _DASH.sub(" → ", text).strip() if isinstance(text, str) and text else text


def _normalize(raw: dict) -> dict:
    raw = dict(raw)
    for key in ("teacher_note", "pacing_flag"):
        raw[key] = _arrow(raw.get(key))
    if isinstance(raw.get("sequence"), list):
        raw["sequence"] = [
            {**s, "description": _arrow(s.get("description", ""))} if isinstance(s, dict) else s for s in raw["sequence"]
        ]
    return raw


def _surplus_notice(teaching_dates: list[TeachingSlot], slots: list[dict]) -> str | None:
    used: dict[str, int] = {}
    for slot in slots:
        used[slot["date"]] = used.get(slot["date"], 0) + slot["minutes_allocated"]
    unused_days = [s for s in teaching_dates if s.date.isoformat() not in used]
    leftover = sum(s.minutes - used[s.date.isoformat()] for s in teaching_dates if s.date.isoformat() in used)
    if not unused_days and leftover < 10:
        return None
    parts = []
    if unused_days:
        parts.append(f"{len(unused_days)} full teaching day{'s' if len(unused_days) != 1 else ''}")
    if leftover >= 10:
        parts.append(f"about {leftover} extra minutes on the days you're already using")
    return (
        "The chapter can be completed within the dates and time you selected. You have "
        + " and ".join(parts)
        + " available, which can be used for revision, practice or other activities."
    )


async def run(current, ctx, params: dict) -> dict:
    p = LessonPlanParams(**params)
    where = f"Chapter: {ctx.chapter} (Class {ctx.class_name}, {ctx.subject_name})"
    if p.step == "topics":
        system = (
            "You are a curriculum planning assistant. Break the chapter into an ordered list of teachable "
            "topics/sub-topics that together cover it, in teaching order. "
            'Respond ONLY with JSON: {"topics": ["string"]}'
        )
        data = await llm.call_json(system, f"{where}\n\nMaterial:\n{ctx.text}")
        return {"step": "topics", "chapter": ctx.chapter, "topics": [str(t) for t in data.get("topics", []) if t]}

    names = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}
    available = "\n".join(
        f"- {s.date.isoformat()} ({names[s.date.weekday()]}): {s.minutes} minutes"
        for s in sorted(p.teaching_dates, key=lambda s: s.date)
    )
    system = (
        "You are a lesson-scheduling assistant writing a day-by-day plan a real teacher will follow in class. "
        "Assign the ordered topics to the available dates, splitting or grouping them to fit each slot's "
        "minutes. For EACH slot produce: \"session_type\" (1-2 words, e.g. Introduction, Application, Review); "
        "\"sequence\": 3-5 timed sub-activities {\"label\", \"minutes\", \"description\"} (hook, teaching, "
        "practice/discussion, closure) whose minutes add up exactly to minutes_allocated, each description "
        "4-5 sentences saying what the teacher should DO and SAY, with the specific example, question or "
        "material to use; \"teacher_note\": 4-5 sentences covering a concrete hook or analogy, one specific "
        "misconception and how to correct it, one classroom-management tip, and the link to the previous or "
        "next session; \"pacing_flag\": null, or ONE sentence if this session is much denser than the others. "
        "If not all topics fit, list them under uncovered_topics with an estimated extra minutes each. "
        "Never use an em dash or a double hyphen. "
        f"Write in {p.language}. Respond ONLY with JSON: "
        '{"slots": [{"date": "YYYY-MM-DD", "topic": "string", "minutes_allocated": int, "session_type": "string", '
        '"sequence": [{"label": "string", "minutes": int, "description": "string"}], "teacher_note": "string", '
        '"pacing_flag": "string or null"}], "uncovered_topics": [{"topic": "string", "estimated_minutes_needed": int}]}'
    )
    user = f"{where}\n\nTopics in teaching order:\n" + "\n".join(f"- {t}" for t in p.topics) + f"\n\nAvailable teaching dates:\n{available}"
    result = await llm.call_json(system, user)

    slots: list[dict] = []
    for raw in result.get("slots", []):
        try:
            slots.append(LessonSlot(**_normalize(raw)).model_dump(mode="json"))
        except (ValidationError, TypeError) as exc:
            logger.warning("Dropping malformed lesson-plan slot: %s", exc)

    uncovered_raw = result.get("uncovered_topics", [])
    uncovered = [u.get("topic", "") if isinstance(u, dict) else str(u) for u in uncovered_raw]

    def _minutes(u) -> float:
        try:
            return float(u.get("estimated_minutes_needed", 0)) if isinstance(u, dict) else 0.0
        except (TypeError, ValueError):
            return 0.0

    shortfall = round(sum(_minutes(u) for u in uncovered_raw))
    covered = not uncovered
    buffer_notice = None
    if not covered:
        extra = f" You're short by roughly {shortfall} minutes." if shortfall > 0 else ""
        buffer_notice = (
            f"This chapter needs more time: {len(uncovered)} topic{'s' if len(uncovered) != 1 else ''} "
            f"({', '.join(uncovered)}) won't be covered by {p.target_completion.isoformat()}.{extra} "
            "Add another teaching day, extend a slot's minutes, or push the target date."
        )
    return {
        "step": "schedule",
        "chapter": ctx.chapter,
        "slots": slots,
        "all_topics_covered": covered,
        "uncovered_topics": uncovered,
        "buffer_notice": buffer_notice,
        "surplus_notice": _surplus_notice(p.teaching_dates, slots) if covered else None,
    }


FEATURE = Feature(
    key="lesson_plan",
    title="Lesson plan",
    description="A day-by-day teaching plan for a chapter across the dates you pick.",
    icon="CalendarRange",
    handler=run,
    needs_context=True,
    require_subject=True,
    require_chapter=True,
    fields=[],  # dedicated two-step panel in the UI
)
