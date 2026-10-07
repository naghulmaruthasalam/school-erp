"""Answer-sheet grading models: a graded sheet per student, and a batch job that grades several students at once."""
from typing import Any

from pydantic import Field

from app.models.base import TenantDocument


class GradedSheet(TenantDocument):
    """One student's graded answer sheet against a GeneratedPaper. A teacher may adjust marks afterwards."""

    user_id: str  # the teacher who graded it
    paper_id: str
    student_name: str
    student_id: str | None = None  # the ERP student, when the teacher picked one
    total_marks_possible: int = 0
    total_marks_awarded: float = 0.0
    # each: {question_number, question_type, marks_possible, marks_awarded, student_answer, feedback, needs_review, adjusted}
    questions: list[dict[str, Any]] = Field(default_factory=list)

    class Settings:
        name = "copilot_graded_sheets"
        indexes = ["school_id", "user_id", "paper_id"]


class GradingJob(TenantDocument):
    """A batch of students being graded in the background. Page images are never stored, only progress and result ids."""

    user_id: str
    paper_id: str
    # each: {student_name, student_id, status: queued|grading|done|failed, current_question, total_questions, result_id, error}
    students: list[dict[str, Any]] = Field(default_factory=list)

    class Settings:
        name = "copilot_grading_jobs"
        indexes = ["school_id", "user_id"]


MODELS: list = [GradedSheet, GradingJob]
