"""Question paper generator models. OWNED BY THE QPG PORT: export every Beanie document in MODELS.

CONTRACT shared with the grading port (do not change field names without updating app/copilot/grading):
GeneratedPaper is what the grader reads."""
from typing import Any

from pydantic import Field

from app.models.base import TenantDocument


class GeneratedPaper(TenantDocument):
    """A question paper a teacher generated. Includes the full answer key; the grader reads it."""

    user_id: str  # the teacher's user id
    class_id: str
    class_name: str
    subject_id: str
    subject_name: str
    chapters: list[str] = Field(default_factory=list)
    total_marks: int = 0
    suggested_duration: str = ""
    # each question: {id, chapter, question_type, marks, text, options|None, answer|None, keywords|None}
    questions: list[dict[str, Any]] = Field(default_factory=list)

    class Settings:
        name = "copilot_generated_papers"
        indexes = ["school_id", "user_id"]


MODELS: list = [GeneratedPaper]
