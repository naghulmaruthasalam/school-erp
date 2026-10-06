from datetime import date, datetime

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Exam
# ---------------------------------------------------------------------------


class ExamCreateRequest(BaseModel):
    academic_year_id: str
    name: str
    term: str | None = None
    start_date: date
    end_date: date
    class_ids: list[str] = Field(default_factory=list)


class ExamUpdateRequest(BaseModel):
    name: str | None = None
    term: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    class_ids: list[str] | None = None


class ExamOut(BaseModel):
    id: str
    school_id: str
    academic_year_id: str
    name: str
    term: str | None = None
    start_date: date
    end_date: date
    class_ids: list[str]
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# ExamSubject
# ---------------------------------------------------------------------------


class ExamSubjectCreateRequest(BaseModel):
    class_id: str
    subject_id: str
    max_marks: float
    pass_marks: float
    exam_date: date | None = None


class ExamSubjectUpdateRequest(BaseModel):
    class_id: str | None = None
    subject_id: str | None = None
    max_marks: float | None = None
    pass_marks: float | None = None
    exam_date: date | None = None


class ExamSubjectOut(BaseModel):
    id: str
    school_id: str
    exam_id: str
    class_id: str
    subject_id: str
    max_marks: float
    pass_marks: float
    exam_date: date | None = None


# ---------------------------------------------------------------------------
# Marks
# ---------------------------------------------------------------------------


class MarkEntryItem(BaseModel):
    student_id: str
    marks_obtained: float
    remarks: str | None = None


class MarkEntryRequest(BaseModel):
    marks: list[MarkEntryItem]


class MarkOut(BaseModel):
    id: str
    school_id: str
    exam_id: str
    exam_subject_id: str
    student_id: str
    marks_obtained: float
    remarks: str | None = None
    entered_by: str
    entered_at: datetime


# ---------------------------------------------------------------------------
# Result / report card
# ---------------------------------------------------------------------------


class ResultSubjectOut(BaseModel):
    exam_subject_id: str
    subject_id: str
    max_marks: float
    pass_marks: float
    marks_obtained: float | None = None
    grade: str | None = None


class ResultOut(BaseModel):
    exam_id: str
    student_id: str
    student_name: str
    class_id: str
    section_id: str
    roll_number: str | None = None
    subjects: list[ResultSubjectOut]
    total_marks_obtained: float
    total_max_marks: float
    percentage: float
    overall_grade: str
