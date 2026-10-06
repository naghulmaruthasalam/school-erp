"""AI-powered question paper generator using Gemini."""
from __future__ import annotations

import json
import logging
from typing import Literal

from pydantic import BaseModel

from app.services.ai.gemini_client import generate, GeminiError

logger = logging.getLogger(__name__)


QuestionType = Literal["mcq", "short_answer", "long_answer", "fill_blank", "true_false", "match"]


class Question(BaseModel):
    question_number: int
    question_type: QuestionType
    question_text: str
    marks: int
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


QUESTION_PAPER_PROMPT = """You are an expert exam paper setter. Generate a well-balanced question paper following the given specifications.

Guidelines:
1. Include a mix of difficulty levels (easy, medium, hard)
2. Cover all specified chapters proportionally
3. Include different Bloom's taxonomy levels (remember, understand, apply, analyze, evaluate, create)
4. MCQ options should have plausible distractors
5. Questions should be clear, unambiguous, and age-appropriate
6. Include marking scheme for each question

Respond ONLY with JSON in this format:
{
  "title": "<paper title>",
  "total_marks": <int>,
  "duration_minutes": <int>,
  "general_instructions": ["<instruction1>", "<instruction2>", ...],
  "sections": [
    {
      "section_name": "<e.g., Section A>",
      "section_label": "<e.g., Multiple Choice Questions>",
      "instructions": "<section-specific instructions>",
      "total_marks": <int>,
      "questions": [
        {
          "question_number": <int>,
          "question_type": "<mcq|short_answer|long_answer|fill_blank|true_false|match>",
          "question_text": "<the question>",
          "marks": <int>,
          "options": ["<option1>", ...] (for mcq/match only),
          "correct_answer": "<answer for mcq/fill_blank/true_false>",
          "answer_key": "<detailed answer/marking scheme>",
          "bloom_level": "<remember|understand|apply|analyze|evaluate|create>",
          "chapter": "<chapter name>",
          "topic": "<topic name>"
        }
      ]
    }
  ]
}"""


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

    default_distribution = {
        "mcq": {"count": 10, "marks_each": 1},
        "fill_blank": {"count": 5, "marks_each": 1},
        "short_answer": {"count": 8, "marks_each": 3},
        "long_answer": {"count": 5, "marks_each": 5},
    }
    distribution = question_distribution or default_distribution

    default_difficulty = {"easy": 30, "medium": 50, "hard": 20}
    difficulty = difficulty_mix or default_difficulty

    chapters_text = "\n".join([f"- {ch}" for ch in chapters])
    distribution_text = "\n".join([
        f"- {qtype}: {spec['count']} questions, {spec['marks_each']} mark(s) each"
        for qtype, spec in distribution.items()
    ])

    user_prompt = f"""Generate a question paper with these specifications:

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
- Easy: {difficulty.get('easy', 30)}%
- Medium: {difficulty.get('medium', 50)}%
- Hard: {difficulty.get('hard', 20)}%

Create a well-structured exam paper with sections, clear instructions, and complete answer key."""

    try:
        response = await generate(
            system_prompt=QUESTION_PAPER_PROMPT,
            user_prompt=user_prompt,
            temperature=0.6,
            json_mode=True,
        )
        result = json.loads(response)

        sections = []
        for raw_section in result.get("sections", []):
            questions = []
            for q in raw_section.get("questions", []):
                questions.append(Question(
                    question_number=q["question_number"],
                    question_type=q["question_type"],
                    question_text=q["question_text"],
                    marks=q["marks"],
                    options=q.get("options"),
                    correct_answer=q.get("correct_answer"),
                    answer_key=q.get("answer_key"),
                    bloom_level=q.get("bloom_level"),
                    chapter=q.get("chapter"),
                    topic=q.get("topic"),
                ))

            sections.append(QuestionSection(
                section_name=raw_section["section_name"],
                section_label=raw_section["section_label"],
                instructions=raw_section.get("instructions", ""),
                total_marks=raw_section.get("total_marks", 0),
                questions=questions,
            ))

        return QuestionPaper(
            title=result.get("title", f"{subject} - {grade} Examination"),
            board=board,
            grade=grade,
            subject=subject,
            chapters=chapters,
            total_marks=result.get("total_marks", total_marks),
            duration_minutes=result.get("duration_minutes", duration_minutes),
            sections=sections,
            general_instructions=result.get("general_instructions", []),
        )
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse question paper response: {e}")
        raise GeminiError(f"Invalid AI response format: {e}")


WORKSHEET_PROMPT = """You are an expert educational content creator. Generate an engaging worksheet for students.

The worksheet should:
1. Have clear, age-appropriate questions
2. Progress from easy to challenging
3. Include a variety of question types
4. Be visually organized with clear sections
5. Include answers for teacher reference

Respond ONLY with JSON:
{
  "title": "<worksheet title>",
  "instructions": "<student instructions>",
  "questions": [
    {
      "question_number": <int>,
      "question_type": "<type>",
      "question_text": "<question>",
      "marks": <int>,
      "options": [...] (if applicable),
      "answer": "<answer>",
      "hint": "<optional hint>"
    }
  ],
  "bonus_question": {
    "question_text": "<optional bonus>",
    "answer": "<answer>"
  }
}"""


async def generate_worksheet(
    grade: str,
    subject: str,
    topic: str,
    num_questions: int = 10,
    difficulty: str = "medium",
) -> dict:
    """Generate a practice worksheet for a specific topic."""

    user_prompt = f"""Generate a worksheet:

Grade: {grade}
Subject: {subject}
Topic: {topic}
Number of Questions: {num_questions}
Difficulty Level: {difficulty}

Create an engaging worksheet suitable for classroom or homework use."""

    try:
        response = await generate(
            system_prompt=WORKSHEET_PROMPT,
            user_prompt=user_prompt,
            temperature=0.7,
            json_mode=True,
        )
        return json.loads(response)
    except Exception as e:
        logger.error(f"Worksheet generation failed: {e}")
        raise GeminiError(f"Failed to generate worksheet: {e}")
