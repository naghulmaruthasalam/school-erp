from datetime import date

import pymongo

from app.core.enums import AttendanceStatus
from app.models.base import TenantDocument


class StudentAttendance(TenantDocument):
    section_id: str
    student_id: str
    date: date
    status: AttendanceStatus
    marked_by: str  # User id (teacher)
    remarks: str | None = None

    class Settings:
        name = "student_attendance"
        indexes = [
            pymongo.IndexModel(
                [("student_id", pymongo.ASCENDING), ("date", pymongo.ASCENDING)],
                unique=True,
                name="uniq_student_date",
            ),
            "school_id",
            "section_id",
            "date",
        ]


class StaffAttendance(TenantDocument):
    teacher_id: str
    date: date
    status: AttendanceStatus
    marked_by: str  # User id (admin/principal)
    remarks: str | None = None

    class Settings:
        name = "staff_attendance"
        indexes = [
            pymongo.IndexModel(
                [("teacher_id", pymongo.ASCENDING), ("date", pymongo.ASCENDING)],
                unique=True,
                name="uniq_teacher_date",
            ),
            "school_id",
            "date",
        ]
