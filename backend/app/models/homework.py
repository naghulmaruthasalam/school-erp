from datetime import date, datetime

from pydantic import Field

from app.core.enums import HomeworkSubmissionStatus
from app.models.base import TenantDocument


class Homework(TenantDocument):
    section_id: str
    subject_id: str
    teacher_id: str
    title: str
    description: str | None = None
    chapter: str | None = None  # syllabus chapter this homework belongs to
    attachment_document_ids: list[str] = Field(default_factory=list)
    assigned_date: date
    due_date: date

    class Settings:
        name = "homework"
        indexes = ["school_id", "section_id", "due_date"]


class HomeworkSubmission(TenantDocument):
    homework_id: str
    student_id: str
    status: HomeworkSubmissionStatus = HomeworkSubmissionStatus.PENDING
    submitted_at: datetime | None = None
    attachment_document_ids: list[str] = Field(default_factory=list)
    remarks: str | None = None

    class Settings:
        name = "homework_submissions"
        indexes = ["school_id", "homework_id", "student_id"]
