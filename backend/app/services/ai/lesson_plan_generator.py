"""AI-powered lesson plan generator using Gemini."""

from __future__ import annotations

import json
import logging
from datetime import date
from typing import Any

from pydantic import BaseModel, Field

from app.services.ai.language import with_language
from app.services.ai.gemini_client import generate, GeminiError

logger = logging.getLogger(__name__)


# ============================================================
# PYDANTIC MODELS
# ============================================================

class LessonActivity(BaseModel):
    label: str
    minutes: int = Field(gt=0)
    description: str


class LessonSlot(BaseModel):
    date: date
    topic: str
    minutes_allocated: int = Field(gt=0)
    session_type: str
    sequence: list[LessonActivity]
    teacher_note: str
    pacing_flag: str | None = None


class UncoveredTopic(BaseModel):
    topic: str
    estimated_minutes_needed: int = Field(ge=0)


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


# ============================================================
# PROMPTS
# ============================================================

TOPIC_EXTRACTION_PROMPT = """
You are an expert curriculum planning assistant.

Given a textbook chapter or chapter content, break it down into
an ordered list of teachable topics and sub-topics.

The topics must:
- Follow the natural teaching order.
- Cover the important concepts in the supplied content.
- Be suitable for the specified grade.
- Avoid unnecessary duplication.
- Be specific enough for a teacher to plan individual lessons.
- Not invent topics that are unrelated to the supplied content.

STRICT JSON REQUIREMENTS:

- Return ONLY valid JSON.
- Do NOT use Markdown.
- Do NOT use ```json.
- Do NOT use ``` blocks.
- Do NOT include comments.
- Do NOT include explanations outside JSON.
- Do NOT use trailing commas.
- Use double quotes for JSON keys and string values.
- The response must be directly parseable using Python json.loads().

Required structure:

{
  "topics": [
    "topic 1",
    "topic 2",
    "topic 3"
  ]
}
"""


SCHEDULING_PROMPT = """
You are an expert school lesson-planning assistant.

Create a day-by-day teaching plan using ONLY the supplied topics
and available teaching dates.

For EACH teaching slot produce:

- session_type:
  A short 1-2 word label such as:
  Introduction
  Explanation
  Analysis
  Practice
  Application
  Review
  Assessment

- sequence:
  3-5 timed classroom activities.

Each activity must contain:
- label: short phase name
- minutes: duration
- description: detailed classroom-ready guidance

- teacher_note:
  A practical note covering:
  1. A concrete hook, analogy, or real-world example.
  2. A common student misconception and how to address it.
  3. A classroom management or engagement tip.
  4. Connection to the previous or next session.

- pacing_flag:
  null when there is no pacing concern.
  Otherwise provide one short sentence explaining the concern.

IMPORTANT SCHEDULING RULES:

1. Never exceed the available minutes for a teaching date.
2. The sum of sequence activity minutes must equal minutes_allocated.
3. Use only the supplied topics.
4. Do not invent unrelated topics.
5. Cover topics in the supplied order where practical.
6. If there is insufficient time to cover all topics, put the remaining
   topics in uncovered_topics.
7. If all topics are covered, uncovered_topics must be [].
8. Do not create slots for dates that were not supplied.
9. Do not create extra teaching dates.
10. Do not allocate more minutes to a slot than the date provides.
11. Keep lesson activities realistic for the specified grade.
12. Do not duplicate the same topic unnecessarily.

STRICT JSON REQUIREMENTS:

- Return ONLY valid JSON.
- Do NOT use Markdown.
- Do NOT use ```json.
- Do NOT use ``` blocks.
- Do NOT include comments.
- Do NOT include explanations outside JSON.
- Do NOT use trailing commas.
- Use double quotes for JSON keys and string values.
- The response must be directly parseable using Python json.loads().

Required structure:

{
  "slots": [
    {
      "date": "YYYY-MM-DD",
      "topic": "string",
      "minutes_allocated": 45,
      "session_type": "Introduction",
      "sequence": [
        {
          "label": "Warm-up",
          "minutes": 5,
          "description": "Detailed classroom guidance."
        },
        {
          "label": "Explanation",
          "minutes": 20,
          "description": "Detailed classroom guidance."
        },
        {
          "label": "Practice",
          "minutes": 15,
          "description": "Detailed classroom guidance."
        },
        {
          "label": "Closure",
          "minutes": 5,
          "description": "Detailed classroom guidance."
        }
      ],
      "teacher_note": "Detailed teacher guidance.",
      "pacing_flag": null
    }
  ],
  "uncovered_topics": [
    {
      "topic": "string",
      "estimated_minutes_needed": 30
    }
  ]
}
"""


# ============================================================
# JSON HELPERS
# ============================================================

def _clean_json_response(response: str) -> str:
    """
    Clean common Gemini response formatting before json.loads().

    This handles:
    - ```json ... ```
    - ``` ... ```
    - accidental text before JSON
    - accidental text after JSON

    It intentionally does NOT blindly remove trailing commas.
    """

    if not response:
        raise ValueError(
            "Gemini returned an empty response."
        )

    cleaned = response.strip()

    # --------------------------------------------------------
    # Remove Markdown code fences
    # --------------------------------------------------------

    if cleaned.startswith("```json"):
        cleaned = cleaned[len("```json"):].strip()

    elif cleaned.startswith("```"):
        cleaned = cleaned[len("```"):].strip()

    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()

    # --------------------------------------------------------
    # Locate JSON object
    # --------------------------------------------------------

    first_object = cleaned.find("{")

    if first_object == -1:
        raise ValueError(
            "No JSON object found in Gemini response."
        )

    if first_object > 0:
        cleaned = cleaned[first_object:]

    # --------------------------------------------------------
    # Remove obvious text after final JSON object.
    #
    # json.JSONDecoder.raw_decode() is used so that valid JSON
    # can be extracted even if Gemini adds trailing text.
    # --------------------------------------------------------

    try:
        decoder = json.JSONDecoder()
        parsed, end_index = decoder.raw_decode(cleaned)

        # Re-serialize to normalized JSON.
        return json.dumps(parsed)

    except json.JSONDecodeError:
        # Let the normal json.loads() later provide the detailed
        # line/column error.
        return cleaned.strip()


def _parse_json_response(
    response: str,
    response_type: str,
) -> dict:
    """Parse and validate a Gemini JSON object."""

    cleaned = _clean_json_response(response)

    try:
        result = json.loads(cleaned)

    except json.JSONDecodeError as exc:

        logger.error(
            "Invalid %s JSON from Gemini: "
            "line=%s column=%s position=%s error=%s",
            response_type,
            exc.lineno,
            exc.colno,
            exc.pos,
            exc.msg,
        )

        logger.error(
            "Gemini %s response:\n%s",
            response_type,
            cleaned[:10000],
        )

        raise GeminiError(
            f"Invalid {response_type} JSON: "
            f"{exc.msg} at line {exc.lineno}, "
            f"column {exc.colno}"
        ) from exc

    if not isinstance(result, dict):
        raise GeminiError(
            f"Invalid {response_type} response. "
            "Expected a JSON object."
        )

    return result


# ============================================================
# TOPIC EXTRACTION
# ============================================================

async def extract_topics(
    chapter_name: str,
    chapter_content: str | None = None,
    subject: str = "",
    grade: str = "",
    language: str = "english",
) -> list[str]:
    """
    Extract teachable topics from a chapter.
    """

    if not chapter_name.strip():
        raise ValueError(
            "chapter_name cannot be empty."
        )

    # --------------------------------------------------------
    # Prepare chapter content
    # --------------------------------------------------------

    content_text = (
        chapter_content.strip()
        if chapter_content
        else f"Chapter: {chapter_name}"
    )

    # Prevent excessively large prompts.
    if len(content_text) > 10000:
        logger.warning(
            "Chapter content exceeds 10000 characters. "
            "Truncating before Gemini request."
        )

        content_text = content_text[:10000]

    user_prompt = f"""
Subject: {subject}
Grade: {grade}
Chapter: {chapter_name}

Chapter Content:
{content_text}

Break this chapter into an ordered list of teachable
topics and sub-topics.
"""

    try:

        logger.info(
            "Extracting topics: chapter=%s grade=%s subject=%s",
            chapter_name,
            grade,
            subject,
        )

        response = await generate(
            system_prompt=with_language(TOPIC_EXTRACTION_PROMPT, language),
            user_prompt=user_prompt,
            temperature=0.4,
            json_mode=True,
        )

        result = _parse_json_response(
            response,
            "topic extraction",
        )

        topics = result.get("topics", [])

        # ----------------------------------------------------
        # Validate topics
        # ----------------------------------------------------

        if not isinstance(topics, list):
            raise GeminiError(
                "Topic extraction response contains an invalid "
                "'topics' field."
            )

        cleaned_topics: list[str] = []

        for topic in topics:

            if not isinstance(topic, str):
                continue

            topic = topic.strip()

            if not topic:
                continue

            if topic not in cleaned_topics:
                cleaned_topics.append(topic)

        if not cleaned_topics:
            raise GeminiError(
                "Gemini returned no valid topics for the chapter."
            )

        logger.info(
            "Extracted %s topics for chapter '%s'.",
            len(cleaned_topics),
            chapter_name,
        )

        return cleaned_topics

    except GeminiError:
        raise

    except Exception as exc:

        logger.exception(
            "Topic extraction failed."
        )

        raise GeminiError(
            f"Failed to extract topics: {exc}"
        ) from exc


# ============================================================
# LESSON PLAN GENERATION
# ============================================================

async def generate_lesson_plan(
    board: str,
    grade: str,
    subject: str,
    chapter: str,
    topics: list[str],
    teaching_dates: list[dict[str, Any]],
    language: str = "english",
) -> LessonPlanResponse:
    """
    Generate a complete lesson plan with activities scheduled
    across the supplied teaching dates.
    """

    # --------------------------------------------------------
    # Validate inputs
    # --------------------------------------------------------

    if not chapter.strip():
        raise ValueError(
            "chapter cannot be empty."
        )

    if not topics:
        raise ValueError(
            "At least one topic is required."
        )

    if not teaching_dates:
        raise ValueError(
            "At least one teaching date is required."
        )

    # --------------------------------------------------------
    # Normalize topics
    # --------------------------------------------------------

    cleaned_topics = []

    for topic in topics:

        if not isinstance(topic, str):
            continue

        topic = topic.strip()

        if topic and topic not in cleaned_topics:
            cleaned_topics.append(topic)

    if not cleaned_topics:
        raise ValueError(
            "No valid topics were provided."
        )

    # --------------------------------------------------------
    # Day names
    # --------------------------------------------------------

    day_names = {
        0: "Mon",
        1: "Tue",
        2: "Wed",
        3: "Thu",
        4: "Fri",
        5: "Sat",
        6: "Sun",
    }

    # --------------------------------------------------------
    # Validate and normalize teaching dates
    # --------------------------------------------------------

    normalized_dates = []

    for item in teaching_dates:

        if not isinstance(item, dict):
            raise ValueError(
                "Each teaching date must be an object."
            )

        raw_date = item.get("date")
        raw_minutes = item.get("minutes")

        if not raw_date:
            raise ValueError(
                "Teaching date is missing 'date'."
            )

        if raw_minutes is None:
            raise ValueError(
                f"Teaching date {raw_date} is missing 'minutes'."
            )

        try:
            parsed_date = date.fromisoformat(
                str(raw_date)
            )
        except ValueError as exc:
            raise ValueError(
                f"Invalid teaching date: {raw_date}. "
                "Expected YYYY-MM-DD."
            ) from exc

        try:
            minutes = int(raw_minutes)
        except (TypeError, ValueError) as exc:
            raise ValueError(
                f"Invalid minutes for {raw_date}: "
                f"{raw_minutes}"
            ) from exc

        if minutes <= 0:
            raise ValueError(
                f"Minutes must be greater than 0 "
                f"for {raw_date}."
            )

        normalized_dates.append({
            "date": parsed_date,
            "minutes": minutes,
        })

    # --------------------------------------------------------
    # Sort dates
    # --------------------------------------------------------

    normalized_dates.sort(
        key=lambda x: x["date"]
    )

    # --------------------------------------------------------
    # Create prompt date description
    # --------------------------------------------------------

    slots_desc = "\n".join(
        (
            f"- {item['date'].isoformat()} "
            f"({day_names[item['date'].weekday()]}): "
            f"{item['minutes']} minutes"
        )
        for item in normalized_dates
    )

    # --------------------------------------------------------
    # Create topics description
    # --------------------------------------------------------

    topics_list = "\n".join(
        f"{index}. {topic}"
        for index, topic in enumerate(
            cleaned_topics,
            start=1,
        )
    )

    # --------------------------------------------------------
    # Calculate total available teaching time
    # --------------------------------------------------------

    total_available_minutes = sum(
        item["minutes"]
        for item in normalized_dates
    )

    # --------------------------------------------------------
    # User prompt
    # --------------------------------------------------------

    user_prompt = f"""
Chapter: {chapter}

Board: {board}
Grade: {grade}
Subject: {subject}

Topics in teaching order:

{topics_list}

Available teaching dates and time budgets:

{slots_desc}

Total available teaching time:
{total_available_minutes} minutes

Create a detailed lesson plan assigning these topics
across the available dates.

IMPORTANT:

- Use only the dates supplied above.
- Do not create additional dates.
- Do not exceed the minutes available on any date.
- The sum of activity minutes for each slot must equal
  that slot's minutes_allocated.
- Cover topics in the supplied order.
- If the available time is insufficient, put remaining
  topics into uncovered_topics.
"""

    # --------------------------------------------------------
    # Gemini generation
    # --------------------------------------------------------

    try:

        logger.info(
            "Generating lesson plan: "
            "chapter=%s grade=%s subject=%s "
            "dates=%s total_minutes=%s",
            chapter,
            grade,
            subject,
            len(normalized_dates),
            total_available_minutes,
        )

        response = await generate(
            system_prompt=with_language(SCHEDULING_PROMPT, language),
            user_prompt=user_prompt,
            temperature=0.4,
            json_mode=True,
        )

        result = _parse_json_response(
            response,
            "lesson plan",
        )

        # ----------------------------------------------------
        # Allowed dates lookup
        # ----------------------------------------------------

        allowed_dates = {
            item["date"]
            for item in normalized_dates
        }

        date_minutes = {
            item["date"]: item["minutes"]
            for item in normalized_dates
        }

        # ----------------------------------------------------
        # Process slots
        # ----------------------------------------------------

        slots: list[LessonSlot] = []

        raw_slots = result.get(
            "slots",
            [],
        )

        if not isinstance(raw_slots, list):
            raise GeminiError(
                "Lesson plan 'slots' must be an array."
            )

        for index, raw_slot in enumerate(
            raw_slots,
            start=1,
        ):

            if not isinstance(raw_slot, dict):
                logger.warning(
                    "Skipping invalid lesson slot %s.",
                    index,
                )
                continue

            try:

                # --------------------------------------------
                # Date
                # --------------------------------------------

                raw_date = raw_slot.get("date")

                if not raw_date:
                    raise ValueError(
                        "Missing slot date."
                    )

                slot_date = date.fromisoformat(
                    str(raw_date)
                )

                if slot_date not in allowed_dates:
                    raise ValueError(
                        f"Date {slot_date} was not supplied "
                        "as an available teaching date."
                    )

                # --------------------------------------------
                # Minutes
                # --------------------------------------------

                minutes_allocated = int(
                    raw_slot.get(
                        "minutes_allocated",
                        0,
                    )
                )

                if minutes_allocated <= 0:
                    raise ValueError(
                        "minutes_allocated must be greater "
                        "than zero."
                    )

                if (
                    minutes_allocated
                    > date_minutes[slot_date]
                ):
                    raise ValueError(
                        f"Slot allocates "
                        f"{minutes_allocated} minutes on "
                        f"{slot_date}, but only "
                        f"{date_minutes[slot_date]} minutes "
                        "are available."
                    )

                # --------------------------------------------
                # Sequence
                # --------------------------------------------

                raw_sequence = raw_slot.get(
                    "sequence",
                    [],
                )

                if not isinstance(raw_sequence, list):
                    raise ValueError(
                        "sequence must be an array."
                    )

                sequence: list[LessonActivity] = []

                for activity_index, raw_activity in enumerate(
                    raw_sequence,
                    start=1,
                ):

                    if not isinstance(
                        raw_activity,
                        dict,
                    ):
                        raise ValueError(
                            f"Invalid activity "
                            f"{activity_index}."
                        )

                    activity = LessonActivity(
                        label=str(
                            raw_activity.get(
                                "label",
                                f"Activity {activity_index}",
                            )
                        ),
                        minutes=int(
                            raw_activity.get(
                                "minutes",
                                0,
                            )
                        ),
                        description=str(
                            raw_activity.get(
                                "description",
                                "",
                            )
                        ),
                    )

                    sequence.append(activity)

                # --------------------------------------------
                # Validate activity total
                # --------------------------------------------

                activity_minutes = sum(
                    activity.minutes
                    for activity in sequence
                )

                if activity_minutes != minutes_allocated:
                    raise ValueError(
                        f"Activity minutes "
                        f"({activity_minutes}) do not match "
                        f"minutes_allocated "
                        f"({minutes_allocated}) for "
                        f"{slot_date}."
                    )

                # --------------------------------------------
                # Topic
                # --------------------------------------------

                topic = str(
                    raw_slot.get(
                        "topic",
                        "",
                    )
                ).strip()

                if not topic:
                    raise ValueError(
                        "Lesson slot has no topic."
                    )

                # --------------------------------------------
                # Build slot
                # --------------------------------------------

                slot = LessonSlot(
                    date=slot_date,
                    topic=topic,
                    minutes_allocated=minutes_allocated,
                    session_type=str(
                        raw_slot.get(
                            "session_type",
                            "Lesson",
                        )
                    ),
                    sequence=sequence,
                    teacher_note=str(
                        raw_slot.get(
                            "teacher_note",
                            "",
                        )
                    ),
                    pacing_flag=raw_slot.get(
                        "pacing_flag"
                    ),
                )

                slots.append(slot)

            except Exception as exc:

                logger.warning(
                    "Skipping malformed lesson slot %s: %s",
                    index,
                    exc,
                )

        # ----------------------------------------------------
        # Process uncovered topics
        # ----------------------------------------------------

        uncovered: list[UncoveredTopic] = []

        raw_uncovered = result.get(
            "uncovered_topics",
            [],
        )

        if not isinstance(raw_uncovered, list):
            logger.warning(
                "Invalid uncovered_topics returned by Gemini."
            )
            raw_uncovered = []

        for item in raw_uncovered:

            # -----------------------------------------------
            # Standard object
            # -----------------------------------------------

            if isinstance(item, dict):

                topic = str(
                    item.get(
                        "topic",
                        "",
                    )
                ).strip()

                if not topic:
                    continue

                try:
                    estimated_minutes = int(
                        item.get(
                            "estimated_minutes_needed",
                            0,
                        )
                    )
                except (
                    TypeError,
                    ValueError,
                ):
                    estimated_minutes = 0

                uncovered.append(
                    UncoveredTopic(
                        topic=topic,
                        estimated_minutes_needed=max(
                            0,
                            estimated_minutes,
                        ),
                    )
                )

            # -----------------------------------------------
            # Backward compatibility if Gemini returns string
            # -----------------------------------------------

            elif isinstance(item, str):

                topic = item.strip()

                if topic:
                    uncovered.append(
                        UncoveredTopic(
                            topic=topic,
                            estimated_minutes_needed=0,
                        )
                    )

        # ----------------------------------------------------
        # Calculate actual total
        # ----------------------------------------------------

        total_minutes = sum(
            slot.minutes_allocated
            for slot in slots
        )

        # ----------------------------------------------------
        # Determine coverage
        # ----------------------------------------------------

        all_covered = len(uncovered) == 0

        # ----------------------------------------------------
        # Warn if Gemini generated fewer minutes than available
        # ----------------------------------------------------

        if total_minutes < total_available_minutes:
            logger.warning(
                "Lesson plan uses %s of %s available minutes.",
                total_minutes,
                total_available_minutes,
            )

        # ----------------------------------------------------
        # Build final response
        # ----------------------------------------------------

        lesson_plan = LessonPlanResponse(
            board=board,
            grade=grade,
            subject=subject,
            chapter=chapter,
            topics=cleaned_topics,
            slots=slots,
            uncovered_topics=uncovered,
            total_minutes=total_minutes,
            all_covered=all_covered,
        )

        logger.info(
            "Lesson plan generated successfully: "
            "%s slots, %s minutes, all_covered=%s",
            len(slots),
            total_minutes,
            all_covered,
        )

        return lesson_plan

    except GeminiError:
        raise

    except Exception as exc:

        logger.exception(
            "Lesson plan generation failed."
        )

        raise GeminiError(
            f"Failed to generate lesson plan: {exc}"
        ) from exc