from datetime import date

from pydantic import Field

from app.core.enums import CalendarEventType
from app.models.base import TenantDocument


class AcademicYear(TenantDocument):
    name: str  # e.g. "2026-2027"
    start_date: date
    end_date: date
    is_current: bool = False

    class Settings:
        name = "academic_years"
        indexes = ["school_id"]


class Class(TenantDocument):
    academic_year_id: str
    name: str  # e.g. "Class 8"
    order: int = 0

    class Settings:
        name = "classes"
        indexes = ["school_id", "academic_year_id"]


class Section(TenantDocument):
    class_id: str
    name: str  # e.g. "A"
    class_teacher_id: str | None = None
    room_no: str | None = None

    class Settings:
        name = "sections"
        indexes = ["school_id", "class_id"]


class Subject(TenantDocument):
    name: str
    code: str

    class Settings:
        name = "subjects"
        indexes = ["school_id", "code"]


class ClassSubjectTeacher(TenantDocument):
    section_id: str
    subject_id: str
    teacher_id: str

    class Settings:
        name = "class_subject_teachers"
        indexes = ["school_id", "section_id", "teacher_id"]


class TimetableSlot(TenantDocument):
    section_id: str
    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday .. 6=Sunday")
    period_number: int
    # Stored as "HH:MM:SS" strings, not datetime.time — BSON/Beanie's encoder
    # cannot serialize a bare time-of-day value. Converted to/from `time` at
    # the service boundary (see academic_service.to_timetable_slot_out).
    start_time: str
    end_time: str
    subject_id: str
    teacher_id: str

    class Settings:
        name = "timetable_slots"
        indexes = ["school_id", "section_id", "teacher_id", "day_of_week"]


class CalendarEvent(TenantDocument):
    academic_year_id: str
    title: str
    description: str | None = None
    event_date: date
    event_type: CalendarEventType = CalendarEventType.OTHER

    class Settings:
        name = "calendar_events"
        indexes = ["school_id", "academic_year_id", "event_date"]
