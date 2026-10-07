from datetime import date, datetime

import pymongo
from pydantic import Field

from app.models.base import TenantDocument, utcnow


class Exam(TenantDocument):
    academic_year_id: str
    name: str  # e.g. "Term 1 Final"
    term: str | None = None
    start_date: date
    end_date: date
    class_ids: list[str] = Field(default_factory=list)

    class Settings:
        name = "exams"
        indexes = ["school_id", "academic_year_id"]


class ExamSubject(TenantDocument):
    exam_id: str
    class_id: str
    subject_id: str
    max_marks: float
    pass_marks: float
    exam_date: date | None = None

    class Settings:
        name = "exam_subjects"
        indexes = ["school_id", "exam_id", "class_id"]


class Mark(TenantDocument):
    exam_id: str
    exam_subject_id: str
    student_id: str
    marks_obtained: float
    remarks: str | None = None
    entered_by: str
    entered_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "marks"
        indexes = [
            pymongo.IndexModel(
                [("exam_subject_id", pymongo.ASCENDING), ("student_id", pymongo.ASCENDING)],
                unique=True,
                name="uniq_exam_subject_student",
            ),
            "school_id",
            "exam_id",
            "student_id",
        ]
