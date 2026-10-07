"""AI-powered question paper and worksheet generator using Gemini."""

from __future__ import annotations

import json
import logging
import re
from typing import Literal

from pydantic import BaseModel, Field

from app.services.ai.gemini_client import generate, GeminiError

logger = logging.getLogger(__name__)


# ============================================================
# TYPES
# ============================================================

QuestionType = Literal[
    "mcq",
    "short_answer",
    "long_answer",
    "fill_blank",
    "true_false",
    "match",
]


# ============================================================
# QUESTION PAPER MODELS
# ============================================================

class Question(BaseModel):
    question_number: int
    question_type: QuestionType
    question_text: str
    marks: int = Field(ge=1)
    options: list[str] | None = None
    correct_answer: str | None = None
    answer_key: str | None = None
    bloom_level: str | None = None
    chapter: str | None = None
    topic: str | None = None


class QuestionSection(BaseModel):
    section_name: str
    section_label: str
    instructions: str
    total_marks: int
    questions: list[Question]


class QuestionPaper(BaseModel):
    title: str
    board: str
    grade: str
    subject: str
    chapters: list[str]
    total_marks: int
    duration_minutes: int
    sections: list[QuestionSection]
    general_instructions: list[str]


# ============================================================
# QUESTION PAPER PROMPT
# ============================================================

QUESTION_PAPER_PROMPT = """
You are an expert school examination paper setter.

Generate a professional, balanced, age-appropriate question paper
based strictly on the supplied board, grade, subject, chapters,
marks, duration, question distribution, and difficulty mix.

IMPORTANT REQUIREMENTS:

1. Cover the supplied chapters proportionally.
2. Follow the requested question distribution exactly.
3. Follow the requested marks per question exactly.
4. The total marks of all generated questions MUST equal the requested total.
5. Include easy, medium, and hard questions according to the requested difficulty mix.
6. Use different Bloom's taxonomy levels where appropriate:
   remember, understand, apply, analyze, evaluate, create.
7. MCQ options must have plausible distractors.
8. Questions must be clear and unambiguous.
9. Questions must be appropriate for the specified grade.
10. Every question must include an answer key.
11. Do not create extra questions beyond the requested distribution.
12. Do not omit requested question types.

STRICT JSON REQUIREMENTS:

- Return ONLY valid JSON.
- Do NOT use Markdown.
- Do NOT use ```json.
- Do NOT use ``` blocks.
- Do NOT include comments.
- Do NOT include explanations outside the JSON.
- Do NOT use trailing commas.
- Use double quotes for JSON keys and string values.
- The response must be directly parseable using Python json.loads().

JSON STRUCTURE:

{
  "title": "string",
  "total_marks": 100,
  "duration_minutes": 180,
  "general_instructions": [
    "string"
  ],
  "sections": [
    {
      "section_name": "Section A",
      "section_label": "Multiple Choice Questions",
      "instructions": "string",
      "total_marks": 20,
      "questions": [
        {
          "question_number": 1,
          "question_type": "mcq",
          "question_text": "string",
          "marks": 1,
          "options": [
            "Option A",
            "Option B",
            "Option C",
            "Option D"
          ],
          "correct_answer": "Option A",
          "answer_key": "Option A is correct because ...",
          "bloom_level": "remember",
          "chapter": "chapter name",
          "topic": "topic name"
        }
      ]
    }
  ]
}

QUESTION TYPE RULES:

mcq:
- Must contain 4 options.
- correct_answer must identify the correct option.

fill_blank:
- options should be null.
- correct_answer must contain the expected answer.

true_false:
- options should be ["True", "False"].
- correct_answer must be "True" or "False".

short_answer:
- options should be null.
- answer_key must contain the expected answer and marking guidance.

long_answer:
- options should be null.
- answer_key must contain a detailed marking scheme.

match:
- options may contain the matching items.
- answer_key must contain the correct matching pairs.

If a field is not applicable, use null rather than inventing content.
"""


# ============================================================
# WORKSHEET PROMPT
# ============================================================

WORKSHEET_PROMPT = """
You are an expert educational content creator.

Generate an engaging worksheet for students based on the supplied
grade, subject, topic, number of questions, and difficulty.

REQUIREMENTS:

1. Questions must be age-appropriate.
2. Questions must be relevant to the supplied topic.
3. Progress from easier to more challenging questions.
4. Include a variety of question types.
5. Include answers for teacher reference.
6. Keep the worksheet suitable for classroom or homework use.
7. Generate exactly the requested number of questions.
8. Do not generate unrelated questions.

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
- If options are not applicable, return an empty array [].
- If no bonus question is generated, return null for bonus_question.

JSON STRUCTURE:

{
  "title": "Worksheet title",
  "instructions": "Student instructions",
  "questions": [
    {
      "question_number": 1,
      "question_type": "mcq",
      "question_text": "Question text",
      "marks": 1,
      "options": [
        "Option A",
        "Option B",
        "Option C",
        "Option D"
      ],
      "answer": "Correct answer",
      "hint": "Optional hint"
    }
  ],
  "bonus_question": {
    "question_text": "Bonus question",
    "answer": "Answer"
  }
}
"""


# ============================================================
# DEFAULT DISTRIBUTION
# ============================================================

DEFAULT_DISTRIBUTION = {
    "mcq": {
        "count": 20,
        "marks_each": 1,
    },
    "fill_blank": {
        "count": 10,
        "marks_each": 1,
    },
    "short_answer": {
        "count": 10,
        "marks_each": 3,
    },
    "long_answer": {
        "count": 8,
        "marks_each": 5,
    },
}


DEFAULT_DIFFICULTY = {
    "easy": 30,
    "medium": 50,
    "hard": 20,
}


DEFAULT_MARKS_BY_TYPE = {
    "mcq": 1,
    "fill_blank": 1,
    "true_false": 1,
    "match": 1,
    "short_answer": 3,
    "long_answer": 5,
}


# ============================================================
# HELPER: CLEAN GEMINI JSON
# ============================================================

def _clean_json_response(response: str) -> str:
    """
    Clean common formatting problems from Gemini responses
    before passing the result to json.loads().
    """

    if not response:
        raise ValueError("Gemini returned an empty response.")

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
    # Remove accidental leading/trailing text around JSON
    # --------------------------------------------------------

    first_object = cleaned.find("{")
    first_array = cleaned.find("[")

    starts = [
        index
        for index in [first_object, first_array]
        if index != -1
    ]

    if starts:
        start = min(starts)

        if start > 0:
            cleaned = cleaned[start:]

    # --------------------------------------------------------
    # If there is trailing text after JSON, trim it.
    #
    # We intentionally do NOT use a regex to remove trailing
    # commas because that can corrupt commas inside strings.
    # --------------------------------------------------------

    return cleaned.strip()


# ============================================================
# HELPER: PARSE GEMINI JSON
# ============================================================

def _parse_json_response(response: str, response_type: str) -> dict:
    """Safely parse Gemini JSON response."""

    cleaned = _clean_json_response(response)

    try:
        parsed = json.loads(cleaned)

    except json.JSONDecodeError as exc:
        logger.error(
            "Invalid %s JSON from Gemini. "
            "Line=%s Column=%s Position=%s Error=%s",
            response_type,
            exc.lineno,
            exc.colno,
            exc.pos,
            exc.msg,
        )

        logger.error(
            "Gemini response preview:\n%s",
            cleaned[:8000],
        )

        raise GeminiError(
            f"Gemini returned invalid {response_type} JSON: "
            f"{exc.msg} at line {exc.lineno}, column {exc.colno}"
        ) from exc

    if not isinstance(parsed, dict):
        raise GeminiError(
            f"Gemini returned invalid {response_type} structure. "
            "Expected a JSON object."
        )

    return parsed


# ============================================================
# HELPER: NORMALIZE QUESTION DISTRIBUTION
# ============================================================

def _normalize_distribution(
    question_distribution: dict | None,
) -> dict:
    """
    Normalize frontend question distribution.

    Supported input formats:

    Format 1:
    {
        "mcq": 10,
        "short_answer": 5
    }

    Format 2:
    {
        "mcq": {
            "count": 10,
            "marks_each": 1
        }
    }
    """

    distribution = (
        question_distribution
        if question_distribution is not None
        else DEFAULT_DISTRIBUTION
    )

    if not isinstance(distribution, dict):
        raise ValueError(
            "question_distribution must be a dictionary."
        )

    normalized = {}

    for qtype, spec in distribution.items():

        qtype = str(qtype).strip().lower()

        if qtype not in DEFAULT_MARKS_BY_TYPE:
            raise ValueError(
                f"Unsupported question type: {qtype}"
            )

        # ----------------------------------------------------
        # Frontend supplied:
        #
        # "mcq": 10
        # ----------------------------------------------------

        if isinstance(spec, int):

            if spec < 0:
                raise ValueError(
                    f"Question count cannot be negative: {qtype}"
                )

            normalized[qtype] = {
                "count": spec,
                "marks_each": DEFAULT_MARKS_BY_TYPE[qtype],
            }

        # ----------------------------------------------------
        # Frontend supplied:
        #
        # "mcq": {
        #     "count": 10,
        #     "marks_each": 1
        # }
        # ----------------------------------------------------

        elif isinstance(spec, dict):

            count = spec.get("count", 0)

            marks_each = spec.get(
                "marks_each",
                DEFAULT_MARKS_BY_TYPE[qtype],
            )

            try:
                count = int(count)
                marks_each = int(marks_each)
            except (TypeError, ValueError) as exc:
                raise ValueError(
                    f"Invalid count/marks_each for {qtype}: {spec}"
                ) from exc

            if count < 0:
                raise ValueError(
                    f"Question count cannot be negative: {qtype}"
                )

            if marks_each <= 0:
                raise ValueError(
                    f"marks_each must be greater than 0: {qtype}"
                )

            normalized[qtype] = {
                "count": count,
                "marks_each": marks_each,
            }

        else:
            raise ValueError(
                f"Invalid question distribution for "
                f"'{qtype}': expected int or dict, "
                f"got {type(spec).__name__}"
            )

    return normalized


# ============================================================
# HELPER: CALCULATE DISTRIBUTION MARKS
# ============================================================

def _calculate_distribution_marks(
    distribution: dict,
) -> int:
    """Calculate total marks represented by distribution."""

    return sum(
        spec["count"] * spec["marks_each"]
        for spec in distribution.values()
    )


# ============================================================
# QUESTION PAPER GENERATION
# ============================================================

async def generate_question_paper(
    board: str,
    grade: str,
    subject: str,
    chapters: list[str],
    total_marks: int = 100,
    duration_minutes: int = 180,
    question_distribution: dict | None = None,
    difficulty_mix: dict | None = None,
) -> QuestionPaper:
    """Generate a complete question paper with answer key."""

    # --------------------------------------------------------
    # Validate basic input
    # --------------------------------------------------------

    if total_marks <= 0:
        raise ValueError("total_marks must be greater than 0.")

    if duration_minutes <= 0:
        raise ValueError(
            "duration_minutes must be greater than 0."
        )

    if not chapters:
        raise ValueError(
            "At least one chapter is required."
        )

    # --------------------------------------------------------
    # Normalize distribution
    # --------------------------------------------------------

    distribution = _normalize_distribution(
        question_distribution
    )

    if not distribution:
        raise ValueError(
            "At least one question type is required."
        )

    distribution_marks = _calculate_distribution_marks(
        distribution
    )

    # --------------------------------------------------------
    # IMPORTANT:
    #
    # Do not silently generate a paper whose distribution
    # doesn't match requested total marks.
    # --------------------------------------------------------

    if distribution_marks != total_marks:
        raise ValueError(
            "Question distribution does not match total marks. "
            f"Requested total_marks={total_marks}, "
            f"but distribution produces {distribution_marks} marks."
        )

    # --------------------------------------------------------
    # Difficulty
    # --------------------------------------------------------

    difficulty = (
        difficulty_mix
        if difficulty_mix is not None
        else DEFAULT_DIFFICULTY
    )

    if not isinstance(difficulty, dict):
        raise ValueError(
            "difficulty_mix must be a dictionary."
        )

    easy = int(difficulty.get("easy", 30))
    medium = int(difficulty.get("medium", 50))
    hard = int(difficulty.get("hard", 20))

    difficulty_total = easy + medium + hard

    if difficulty_total != 100:
        raise ValueError(
            "Difficulty mix must total 100%. "
            f"Received {difficulty_total}%."
        )

    # --------------------------------------------------------
    # Build chapter prompt
    # --------------------------------------------------------

    chapters_text = "\n".join(
        f"- {chapter}"
        for chapter in chapters
    )

    # --------------------------------------------------------
    # Build distribution prompt
    # --------------------------------------------------------

    distribution_text = "\n".join(
        (
            f"- {qtype}: "
            f"{spec['count']} questions, "
            f"{spec['marks_each']} mark(s) each"
        )
        for qtype, spec in distribution.items()
    )

    # --------------------------------------------------------
    # User prompt
    # --------------------------------------------------------

    user_prompt = f"""
Generate a question paper with these specifications.

Board: {board}
Grade: {grade}
Subject: {subject}

Total Marks: {total_marks}
Duration: {duration_minutes} minutes

Chapters to cover:
{chapters_text}

Question Distribution:
{distribution_text}

Difficulty Mix:
- Easy: {easy}%
- Medium: {medium}%
- Hard: {hard}%

IMPORTANT:

The distribution above represents exactly {distribution_marks} marks.

Generate exactly the requested number of questions.

The sum of all question marks MUST equal exactly {total_marks}.

Do not add extra questions.
Do not remove requested questions.

Create a professional examination paper with:
- sections
- clear instructions
- question numbers
- answers
- marking schemes
- Bloom's taxonomy levels
- chapter and topic information
"""

    # --------------------------------------------------------
    # Gemini generation
    # --------------------------------------------------------

    try:

        logger.info(
            "Generating question paper: "
            "board=%s grade=%s subject=%s marks=%s",
            board,
            grade,
            subject,
            total_marks,
        )

        response = await generate(
            system_prompt=QUESTION_PAPER_PROMPT,
            user_prompt=user_prompt,
            temperature=0.6,
            json_mode=True,
        )

        result = _parse_json_response(
            response,
            "question paper",
        )

        # ----------------------------------------------------
        # Build sections
        # ----------------------------------------------------

        sections: list[QuestionSection] = []

        for raw_section in result.get("sections", []):

            if not isinstance(raw_section, dict):
                logger.warning(
                    "Skipping invalid section: %s",
                    raw_section,
                )
                continue

            questions: list[Question] = []

            for raw_question in raw_section.get(
                "questions",
                [],
            ):

                if not isinstance(raw_question, dict):
                    logger.warning(
                        "Skipping invalid question: %s",
                        raw_question,
                    )
                    continue

                try:

                    question = Question(
                        question_number=int(
                            raw_question["question_number"]
                        ),
                        question_type=raw_question[
                            "question_type"
                        ],
                        question_text=str(
                            raw_question["question_text"]
                        ),
                        marks=int(
                            raw_question["marks"]
                        ),
                        options=raw_question.get("options"),
                        correct_answer=raw_question.get(
                            "correct_answer"
                        ),
                        answer_key=raw_question.get(
                            "answer_key"
                        ),
                        bloom_level=raw_question.get(
                            "bloom_level"
                        ),
                        chapter=raw_question.get(
                            "chapter"
                        ),
                        topic=raw_question.get(
                            "topic"
                        ),
                    )

                    questions.append(question)

                except Exception as exc:
                    logger.error(
                        "Invalid question returned by Gemini: %s",
                        exc,
                    )
                    raise GeminiError(
                        f"Invalid question structure returned "
                        f"by Gemini: {exc}"
                    ) from exc

            section = QuestionSection(
                section_name=str(
                    raw_section.get(
                        "section_name",
                        f"Section {len(sections) + 1}",
                    )
                ),
                section_label=str(
                    raw_section.get(
                        "section_label",
                        "",
                    )
                ),
                instructions=str(
                    raw_section.get(
                        "instructions",
                        "",
                    )
                ),
                total_marks=int(
                    raw_section.get(
                        "total_marks",
                        sum(q.marks for q in questions),
                    )
                ),
                questions=questions,
            )

            sections.append(section)

        # ----------------------------------------------------
        # Ensure sections were generated
        # ----------------------------------------------------

        if not sections:
            raise GeminiError(
                "Gemini generated no question paper sections."
            )

        # ----------------------------------------------------
        # Calculate actual generated marks
        # ----------------------------------------------------

        generated_marks = sum(
            question.marks
            for section in sections
            for question in section.questions
        )

        logger.info(
            "Generated question paper marks: %s / %s",
            generated_marks,
            total_marks,
        )

        # ----------------------------------------------------
        # Validate total marks
        # ----------------------------------------------------

        if generated_marks != total_marks:
            raise GeminiError(
                "Generated question paper has "
                f"{generated_marks} marks, but "
                f"{total_marks} marks were requested."
            )

        # ----------------------------------------------------
        # Build final model
        # ----------------------------------------------------

        return QuestionPaper(
            title=result.get(
                "title",
                f"{subject} - {grade} Examination",
            ),
            board=board,
            grade=grade,
            subject=subject,
            chapters=chapters,
            total_marks=total_marks,
            duration_minutes=int(
                result.get(
                    "duration_minutes",
                    duration_minutes,
                )
            ),
            sections=sections,
            general_instructions=[
                str(instruction)
                for instruction in result.get(
                    "general_instructions",
                    [],
                )
            ],
        )

    except GeminiError:
        raise

    except Exception as exc:
        logger.exception(
            "Question paper generation failed."
        )

        raise GeminiError(
            f"Failed to generate question paper: {exc}"
        ) from exc


# ============================================================
# WORKSHEET GENERATION
# ============================================================

async def generate_worksheet(
    grade: str,
    subject: str,
    topic: str,
    num_questions: int = 10,
    difficulty: str = "medium",
) -> dict:
    """Generate a practice worksheet for a specific topic."""

    if num_questions <= 0:
        raise ValueError(
            "num_questions must be greater than 0."
        )

    if not topic.strip():
        raise ValueError(
            "topic cannot be empty."
        )

    user_prompt = f"""
Generate a worksheet using these specifications:

Grade: {grade}
Subject: {subject}
Topic: {topic}
Number of Questions: {num_questions}
Difficulty Level: {difficulty}

Generate exactly {num_questions} questions.

The worksheet should be:
- age appropriate
- educational
- clear
- engaging
- progressively challenging
- suitable for classroom or homework use

Include answers for teacher reference.
"""

    try:

        logger.info(
            "Generating worksheet: "
            "grade=%s subject=%s topic=%s questions=%s",
            grade,
            subject,
            topic,
            num_questions,
        )

        response = await generate(
            system_prompt=WORKSHEET_PROMPT,
            user_prompt=user_prompt,
            temperature=0.7,
            json_mode=True,
        )

        result = _parse_json_response(
            response,
            "worksheet",
        )

        # ----------------------------------------------------
        # Validate questions
        # ----------------------------------------------------

        questions = result.get("questions")

        if not isinstance(questions, list):
            raise GeminiError(
                "Gemini worksheet response does not contain "
                "a valid questions array."
            )

        if len(questions) != num_questions:
            raise GeminiError(
                "Gemini generated "
                f"{len(questions)} questions, but "
                f"{num_questions} were requested."
            )

        # ----------------------------------------------------
        # Normalize question data
        # ----------------------------------------------------

        normalized_questions = []

        for index, question in enumerate(
            questions,
            start=1,
        ):

            if not isinstance(question, dict):
                raise GeminiError(
                    f"Invalid worksheet question at position "
                    f"{index}."
                )

            normalized_question = {
                "question_number": question.get(
                    "question_number",
                    index,
                ),
                "question_type": question.get(
                    "question_type",
                    "short_answer",
                ),
                "question_text": question.get(
                    "question_text",
                    "",
                ),
                "marks": question.get(
                    "marks",
                    1,
                ),
                "options": question.get(
                    "options",
                    [],
                ),
                "answer": question.get(
                    "answer",
                    "",
                ),
                "hint": question.get(
                    "hint",
                    None,
                ),
            }

            if not normalized_question["question_text"]:
                raise GeminiError(
                    f"Worksheet question {index} "
                    "has no question_text."
                )

            if normalized_question["options"] is None:
                normalized_question["options"] = []

            normalized_questions.append(
                normalized_question
            )

        result["questions"] = normalized_questions

        # ----------------------------------------------------
        # Normalize bonus question
        # ----------------------------------------------------

        if "bonus_question" not in result:
            result["bonus_question"] = None

        logger.info(
            "Worksheet generated successfully: %s questions",
            len(normalized_questions),
        )

        return result

    except GeminiError:
        raise

    except Exception as exc:
        logger.exception(
            "Worksheet generation failed."
        )

        raise GeminiError(
            f"Failed to generate worksheet: {exc}"
        ) from exc