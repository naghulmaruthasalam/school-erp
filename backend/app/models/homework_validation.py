"""Model for storing AI homework validation results."""
from datetime import datetime
from typing import Optional

from beanie import Document
from pydantic import Field

from app.models.base import utcnow


class QuestionFeedbackDoc(Document):
    question_number: int
    student_answer: str
    is_correct: bool
    score: float
    max_score: float
    feedback: str
    suggestions: list[str] = Field(default_factory=list)

    class Settings:
        name = "question_feedback"


class HomeworkValidation(Document):
    """Stores AI validation results for homework submissions."""

    school_id: str
    homework_id: str
    student_id: str
    submission_id: str

    total_score: float
    max_score: float
    percentage: float
    grade: str

    overall_feedback: str
    strengths: list[str] = Field(default_factory=list)
    areas_to_improve: list[str] = Field(default_factory=list)

    questions: list[dict] = Field(default_factory=list)

    validated_at: datetime = Field(default_factory=utcnow)
    validated_by: str | None = None

    parent_viewed: bool = False
    parent_viewed_at: datetime | None = None
    teacher_reviewed: bool = False
    teacher_reviewed_at: datetime | None = None
    teacher_comments: str | None = None

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "homework_validations"
        indexes = [
            "school_id",
            "homework_id",
            "student_id",
            "submission_id",
            [("school_id", 1), ("student_id", 1)],
            [("school_id", 1), ("homework_id", 1)],
        ]
