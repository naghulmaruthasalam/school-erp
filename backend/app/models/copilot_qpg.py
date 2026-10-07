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


class QuestionBankItem(TenantDocument):
    """One reusable question in the school's bank for a class + subject + chapter. Filled by the AI when a paper needs
    more questions than the bank holds, by teachers (POST /copilot/qpg/bank), or by an import."""

    class_id: str
    subject_id: str
    chapter: str
    question_type: str  # mcq | short | state_precisely | answer_in_brief | long
    marks: int
    text: str
    options: list[str] | None = None
    answer: str | None = None
    keywords: str | None = None
    text_hash: str  # of the normalised text: stops the same question being stored twice
    source: str = "ai"  # ai | teacher
    created_by: str | None = None

    class Settings:
        name = "copilot_question_bank"
        indexes = ["school_id", "class_id", "subject_id", "chapter", "text_hash"]


class RotationState(TenantDocument):
    """Per teacher + chapter + question type "shuffle bag": no question repeats across consecutive papers until the
    whole bucket has been used, then a fresh random order starts."""

    user_id: str
    class_id: str
    subject_id: str
    chapter: str
    question_type: str
    order: list[str] = Field(default_factory=list)
    cursor: int = 0
    cycle: int = 0

    class Settings:
        name = "copilot_question_rotation"
        indexes = ["school_id", "user_id", "class_id", "subject_id", "chapter", "question_type"]


MODELS: list = [GeneratedPaper, QuestionBankItem, RotationState]
