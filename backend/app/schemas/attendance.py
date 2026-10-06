from datetime import date, datetime

from pydantic import BaseModel, Field

from app.core.enums import AttendanceStatus

# ---------------------------------------------------------------------------
# Student attendance
# ---------------------------------------------------------------------------


class StudentAttendanceMarkItem(BaseModel):
    student_id: str
    status: AttendanceStatus
    remarks: str | None = None


class StudentAttendanceBulkMarkRequest(BaseModel):
    section_id: str
    date: date
    records: list[StudentAttendanceMarkItem] = Field(..., min_length=1)


class StudentAttendanceOut(BaseModel):
    id: str
    school_id: str
    section_id: str
    student_id: str
    date: date
    status: AttendanceStatus
    marked_by: str
    remarks: str | None = None
    created_at: datetime
    updated_at: datetime


class StudentAttendanceSummaryItem(BaseModel):
    student_id: str
    total_days: int
    counts: dict[str, int]
    percentage_present: float


# ---------------------------------------------------------------------------
# Staff (teacher) attendance
# ---------------------------------------------------------------------------


class StaffAttendanceMarkItem(BaseModel):
    teacher_id: str
    status: AttendanceStatus
    remarks: str | None = None


class StaffAttendanceBulkMarkRequest(BaseModel):
    date: date
    records: list[StaffAttendanceMarkItem] = Field(..., min_length=1)


class StaffAttendanceOut(BaseModel):
    id: str
    school_id: str
    teacher_id: str
    date: date
    status: AttendanceStatus
    marked_by: str
    remarks: str | None = None
    created_at: datetime
    updated_at: datetime


class StaffAttendanceSummaryItem(BaseModel):
    teacher_id: str
    total_days: int
    counts: dict[str, int]
    percentage_present: float
