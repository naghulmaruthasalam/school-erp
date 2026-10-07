"""AI-powered homework validation and feedback service using Gemini."""
from __future__ import annotations

import json
import logging
from datetime import datetime

from pydantic import BaseModel

from app.services.ai.gemini_client import generate, generate_vision, GeminiError, GeminiNotConfigured

logger = logging.getLogger(__name__)


class QuestionFeedback(BaseModel):
    question_number: int
    student_answer: str
    is_correct: bool
    score: float
    max_score: float
    feedback: str
    suggestions: list[str]


class HomeworkValidationResult(BaseModel):
    homework_id: str
    student_id: str
    total_score: float
    max_score: float
    percentage: float
    grade: str
    overall_feedback: str
    strengths: list[str]
    areas_to_improve: list[str]
    questions: list[QuestionFeedback]
    validated_at: datetime


VALIDATION_SYSTEM_PROMPT = """You are an expert educational evaluator. Your task is to evaluate a student's homework submission against the homework questions and expected outcomes.

Evaluate each answer for:
1. Correctness - Is the answer factually correct?
2. Completeness - Does it cover all required aspects?
3. Understanding - Does the student demonstrate understanding of the concept?
4. Presentation - Is the answer well-structured and clear?

Provide constructive feedback that:
- Acknowledges what the student did well
- Points out specific errors without being discouraging
- Gives actionable suggestions for improvement
- Uses encouraging, age-appropriate language

Respond ONLY with valid JSON in this format:
{
  "total_score": <float>,
  "max_score": <float>,
  "grade": "<A/B/C/D/F>",
  "overall_feedback": "<2-3 sentences of overall feedback>",
  "strengths": ["<strength1>", "<strength2>"],
  "areas_to_improve": ["<area1>", "<area2>"],
  "questions": [
    {
      "question_number": <int>,
      "student_answer": "<extracted or provided answer>",
      "is_correct": <bool>,
      "score": <float>,
      "max_score": <float>,
      "feedback": "<specific feedback for this question>",
      "suggestions": ["<suggestion1>", "<suggestion2>"]
    }
  ]
}"""


async def validate_text_homework(
    homework_id: str,
    student_id: str,
    homework_title: str,
    homework_description: str,
    questions: list[dict],
    student_answers: list[str],
) -> HomeworkValidationResult:
    """Validate text-based homework submission."""

    questions_text = "\n".join([
        f"Q{i+1}. {q.get('question', '')} (Max marks: {q.get('marks', 1)})"
        for i, q in enumerate(questions)
    ])

    answers_text = "\n".join([
        f"A{i+1}. {ans}"
        for i, ans in enumerate(student_answers)
    ])

    user_prompt = f"""Homework: {homework_title}
Description: {homework_description}

Questions:
{questions_text}

Student's Answers:
{answers_text}

Please evaluate each answer and provide detailed feedback."""

    try:
        response = await generate(
            system_prompt=VALIDATION_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            temperature=0.3,
            json_mode=True,
        )

        result = json.loads(response)

        return HomeworkValidationResult(
            homework_id=homework_id,
            student_id=student_id,
            total_score=result.get("total_score", 0),
            max_score=result.get("max_score", 0),
            percentage=round((result.get("total_score", 0) / max(result.get("max_score", 1), 1)) * 100, 1),
            grade=result.get("grade", ""),
            overall_feedback=result.get("overall_feedback", ""),
            strengths=result.get("strengths", []),
            areas_to_improve=result.get("areas_to_improve", []),
            questions=[QuestionFeedback(**q) for q in result.get("questions", [])],
            validated_at=datetime.utcnow(),
        )
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Gemini response: {e}")
        raise GeminiError(f"Invalid response format from AI: {e}")
    except (GeminiError, GeminiNotConfigured):
        raise


async def validate_image_homework(
    homework_id: str,
    student_id: str,
    homework_title: str,
    homework_description: str,
    questions: list[dict],
    image_bytes_list: list[bytes],
) -> HomeworkValidationResult:
    """Validate homework submission with handwritten/image answers."""

    questions_text = "\n".join([
        f"Q{i+1}. {q.get('question', '')} (Max marks: {q.get('marks', 1)})"
        for i, q in enumerate(questions)
    ])

    user_prompt = f"""Homework: {homework_title}
Description: {homework_description}

Questions:
{questions_text}

The attached images contain the student's handwritten answers. Please:
1. Extract the text from each answer
2. Match answers to questions (by question number if labeled, or by order)
3. Evaluate each answer and provide detailed feedback"""

    try:
        response = await generate_vision(
            system_prompt=VALIDATION_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            images=image_bytes_list,
            temperature=0.3,
        )

        result = json.loads(response)

        return HomeworkValidationResult(
            homework_id=homework_id,
            student_id=student_id,
            total_score=result.get("total_score", 0),
            max_score=result.get("max_score", 0),
            percentage=round((result.get("total_score", 0) / max(result.get("max_score", 1), 1)) * 100, 1),
            grade=result.get("grade", ""),
            overall_feedback=result.get("overall_feedback", ""),
            strengths=result.get("strengths", []),
            areas_to_improve=result.get("areas_to_improve", []),
            questions=[QuestionFeedback(**q) for q in result.get("questions", [])],
            validated_at=datetime.utcnow(),
        )
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse Gemini response: {e}")
        raise GeminiError(f"Invalid response format from AI: {e}")
    except (GeminiError, GeminiNotConfigured):
        raise


QUICK_FEEDBACK_PROMPT = """You are a helpful teaching assistant. Provide quick, encouraging feedback on the student's work.

Keep your response:
- Concise (2-3 sentences max)
- Encouraging but honest
- Age-appropriate
- Actionable if improvements needed

Respond with JSON: {"feedback": "<your feedback>", "emoji": "<appropriate emoji>"}"""


async def get_quick_feedback(
    student_answer: str,
    question: str,
    subject: str,
    grade_level: str,
) -> dict:
    """Get quick AI feedback on a single answer."""

    user_prompt = f"""Subject: {subject}
Grade Level: {grade_level}
Question: {question}
Student's Answer: {student_answer}"""

    try:
        response = await generate(
            system_prompt=QUICK_FEEDBACK_PROMPT,
            user_prompt=user_prompt,
            temperature=0.5,
            json_mode=True,
        )
        return json.loads(response)
    except Exception as e:
        logger.error(f"Quick feedback failed: {e}")
        return {"feedback": "Unable to generate feedback at this time.", "emoji": ""}
