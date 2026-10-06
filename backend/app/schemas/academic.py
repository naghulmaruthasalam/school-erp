from datetime import date, time

from pydantic import BaseModel, Field

from app.core.enums import CalendarEventType

# ---------------------------------------------------------------------------
# AcademicYear
# ---------------------------------------------------------------------------


class AcademicYearCreateRequest(BaseModel):
    name: str
    start_date: date
    end_date: date
    is_current: bool = False


class AcademicYearUpdateRequest(BaseModel):
    name: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_current: bool | None = None


class AcademicYearOut(BaseModel):
    id: str
    school_id: str
    name: str
    start_date: date
    end_date: date
    is_current: bool


# ---------------------------------------------------------------------------
# Class
# ---------------------------------------------------------------------------


class ClassCreateRequest(BaseModel):
    academic_year_id: str
    name: str
    order: int = 0


class ClassUpdateRequest(BaseModel):
    name: str | None = None
    order: int | None = None


class ClassOut(BaseModel):
    id: str
    school_id: str
    academic_year_id: str
    name: str
    order: int


# ---------------------------------------------------------------------------
# Section
# ---------------------------------------------------------------------------


class SectionCreateRequest(BaseModel):
    class_id: str
    name: str
    class_teacher_id: str | None = None
    room_no: str | None = None


class SectionUpdateRequest(BaseModel):
    name: str | None = None
    class_teacher_id: str | None = None
    room_no: str | None = None


class SectionOut(BaseModel):
    id: str
    school_id: str
    class_id: str
    name: str
    class_teacher_id: str | None = None
    room_no: str | None = None


# ---------------------------------------------------------------------------
# Subject
# ---------------------------------------------------------------------------


class SubjectCreateRequest(BaseModel):
    name: str
    code: str


class SubjectUpdateRequest(BaseModel):
    name: str | None = None
    code: str | None = None


class SubjectOut(BaseModel):
    id: str
    school_id: str
    name: str
    code: str


# ---------------------------------------------------------------------------
# ClassSubjectTeacher
# ---------------------------------------------------------------------------


class ClassSubjectTeacherCreateRequest(BaseModel):
    section_id: str
    subject_id: str
    teacher_id: str


class ClassSubjectTeacherOut(BaseModel):
    id: str
    school_id: str
    section_id: str
    subject_id: str
    teacher_id: str


# ---------------------------------------------------------------------------
# TimetableSlot
# ---------------------------------------------------------------------------


class TimetableSlotCreateRequest(BaseModel):
    section_id: str
    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday .. 6=Sunday")
    period_number: int
    start_time: time
    end_time: time
    subject_id: str
    teacher_id: str


class TimetableSlotUpdateRequest(BaseModel):
    day_of_week: int | None = Field(default=None, ge=0, le=6)
    period_number: int | None = None
    start_time: time | None = None
    end_time: time | None = None
    subject_id: str | None = None
    teacher_id: str | None = None


class TimetableSlotOut(BaseModel):
    id: str
    school_id: str
    section_id: str
    day_of_week: int
    period_number: int
    start_time: time
    end_time: time
    subject_id: str
    teacher_id: str


# ---------------------------------------------------------------------------
# CalendarEvent
# ---------------------------------------------------------------------------


class CalendarEventCreateRequest(BaseModel):
    academic_year_id: str
    title: str
    description: str | None = None
    event_date: date
    event_type: CalendarEventType = CalendarEventType.OTHER


class CalendarEventUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    event_date: date | None = None
    event_type: CalendarEventType | None = None


class CalendarEventOut(BaseModel):
    id: str
    school_id: str
    academic_year_id: str
    title: str
    description: str | None = None
    event_date: date
    event_type: CalendarEventType
