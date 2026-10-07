from datetime import date, datetime

from pydantic import BaseModel, Field

from app.core.enums import HomeworkSubmissionStatus

# ---------------------------------------------------------------------------
# Homework
# ---------------------------------------------------------------------------


class HomeworkCreateRequest(BaseModel):
    section_id: str
    subject_id: str
    teacher_id: str | None = None  # defaults to current.user.teacher_id when role == TEACHER
    title: str
    description: str | None = None
    chapter: str | None = None
    attachment_document_ids: list[str] = Field(default_factory=list)
    assigned_date: date
    due_date: date


class HomeworkUpdateRequest(BaseModel):
    subject_id: str | None = None
    title: str | None = None
    description: str | None = None
    chapter: str | None = None
    attachment_document_ids: list[str] | None = None
    assigned_date: date | None = None
    due_date: date | None = None


class HomeworkOut(BaseModel):
    id: str
    school_id: str
    section_id: str
    subject_id: str
    teacher_id: str
    title: str
    description: str | None = None
    chapter: str | None = None
    attachment_document_ids: list[str] = Field(default_factory=list)
    assigned_date: date
    due_date: date
    created_at: datetime
    updated_at: datetime


class PendingHomeworkOut(HomeworkOut):
    student_id: str  # whose pending homework this is (self for a student, the child for a parent)


# ---------------------------------------------------------------------------
# Homework submissions
# ---------------------------------------------------------------------------


class HomeworkSubmissionOut(BaseModel):
    id: str
    school_id: str
    homework_id: str
    student_id: str
    status: HomeworkSubmissionStatus
    submitted_at: datetime | None = None
    attachment_document_ids: list[str] = Field(default_factory=list)
    remarks: str | None = None
    created_at: datetime
    updated_at: datetime


class HomeworkSubmissionUpdateRequest(BaseModel):
    status: HomeworkSubmissionStatus | None = None
    attachment_document_ids: list[str] | None = None
    remarks: str | None = None
