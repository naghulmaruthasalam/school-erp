"""AI-powered lesson plan generator using Gemini."""
from __future__ import annotations

import json
import logging
from datetime import date
from typing import Any

from pydantic import BaseModel

from app.services.ai.gemini_client import generate, GeminiError

logger = logging.getLogger(__name__)


class LessonActivity(BaseModel):
    label: str
    minutes: int
    description: str


class LessonSlot(BaseModel):
    date: date
    topic: str
    minutes_allocated: int
    session_type: str
    sequence: list[LessonActivity]
    teacher_note: str
    pacing_flag: str | None = None


class UncoveredTopic(BaseModel):
    topic: str
    estimated_minutes_needed: int


class LessonPlanResponse(BaseModel):
    board: str
    grade: str
    subject: str
    chapter: str
    topics: list[str]
    slots: list[LessonSlot]
    uncovered_topics: list[UncoveredTopic]
    total_minutes: int
    all_covered: bool


TOPIC_EXTRACTION_PROMPT = """You are a curriculum planning assistant. Given a textbook chapter or topic description, break it down into an ordered list of teachable topics/sub-topics that together cover the whole content, in the order they should be taught.

Respond ONLY with JSON: {"topics": ["topic1", "topic2", ...]}"""


SCHEDULING_PROMPT = """You are a lesson-scheduling assistant creating a day-by-day teaching plan.

For EACH teaching slot, produce:
- "session_type": 1-2 word label (Introduction, Analysis, Practice, Review, etc.)
- "sequence": 3-5 timed sub-activities with:
  - "label": short phase name
  - "minutes": duration
  - "description": 4-5 sentences of detailed, classroom-ready guidance
- "teacher_note": 4-5 sentences covering:
  1. A concrete hook/analogy/real-world example
  2. A common student misconception and how to address it
  3. A classroom management/engagement tip
  4. Connection to previous/next session
- "pacing_flag": null normally, or one sentence about pacing concerns

If topics don't fit, list uncovered_topics with estimated minutes needed.

Respond ONLY with JSON:
{
  "slots": [{
    "date": "YYYY-MM-DD",
    "topic": "string",
    "minutes_allocated": int,
    "session_type": "string",
    "sequence": [{"label": "string", "minutes": int, "description": "string"}],
    "teacher_note": "string",
    "pacing_flag": "string or null"
  }],
  "uncovered_topics": [{"topic": "string", "estimated_minutes_needed": int}]
}"""


async def extract_topics(
    chapter_name: str,
    chapter_content: str | None = None,
    subject: str = "",
    grade: str = "",
) -> list[str]:
    """Extract teachable topics from a chapter."""

    content_text = chapter_content or f"Chapter: {chapter_name}"
    if len(content_text) > 10000:
        content_text = content_text[:10000]

    user_prompt = f"""Subject: {subject}
Grade: {grade}
Chapter: {chapter_name}

Content:
{content_text}

Break this into an ordered list of teachable topics/sub-topics."""

    try:
        response = await generate(
            system_prompt=TOPIC_EXTRACTION_PROMPT,
            user_prompt=user_prompt,
            temperature=0.4,
            json_mode=True,
        )
        result = json.loads(response)
        return result.get("topics", [])
    except Exception as e:
        logger.error(f"Topic extraction failed: {e}")
        raise GeminiError(f"Failed to extract topics: {e}")


async def generate_lesson_plan(
    board: str,
    grade: str,
    subject: str,
    chapter: str,
    topics: list[str],
    teaching_dates: list[dict],
) -> LessonPlanResponse:
    """Generate a complete lesson plan with activities scheduled across dates."""

    day_names = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}

    slots_desc = "\n".join([
        f"- {d['date']} ({day_names[date.fromisoformat(d['date']).weekday()]}): {d['minutes']} minutes"
        for d in sorted(teaching_dates, key=lambda x: x['date'])
    ])

    topics_list = "\n".join([f"- {t}" for t in topics])

    user_prompt = f"""Chapter: {chapter} (Grade {grade}, {subject}, {board} Board)

Topics in teaching order:
{topics_list}

Available teaching dates and time budgets:
{slots_desc}

Create a detailed lesson plan assigning topics to dates."""

    try:
        response = await generate(
            system_prompt=SCHEDULING_PROMPT,
            user_prompt=user_prompt,
            temperature=0.4,
            json_mode=True,
        )
        result = json.loads(response)

        slots = []
        for raw_slot in result.get("slots", []):
            try:
                slots.append(LessonSlot(
                    date=date.fromisoformat(raw_slot["date"]),
                    topic=raw_slot["topic"],
                    minutes_allocated=raw_slot["minutes_allocated"],
                    session_type=raw_slot["session_type"],
                    sequence=[LessonActivity(**s) for s in raw_slot.get("sequence", [])],
                    teacher_note=raw_slot.get("teacher_note", ""),
                    pacing_flag=raw_slot.get("pacing_flag"),
                ))
            except Exception as e:
                logger.warning(f"Skipping malformed slot: {e}")

        uncovered = []
        for u in result.get("uncovered_topics", []):
            if isinstance(u, dict):
                uncovered.append(UncoveredTopic(
                    topic=u.get("topic", ""),
                    estimated_minutes_needed=u.get("estimated_minutes_needed", 0),
                ))
            elif isinstance(u, str):
                uncovered.append(UncoveredTopic(topic=u, estimated_minutes_needed=0))

        total_minutes = sum(s.minutes_allocated for s in slots)

        return LessonPlanResponse(
            board=board,
            grade=grade,
            subject=subject,
            chapter=chapter,
            topics=topics,
            slots=slots,
            uncovered_topics=uncovered,
            total_minutes=total_minutes,
            all_covered=len(uncovered) == 0,
        )
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse lesson plan response: {e}")
        raise GeminiError(f"Invalid AI response format: {e}")
