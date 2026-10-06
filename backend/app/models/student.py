from datetime import date

from pydantic import Field

from app.core.enums import StudentStatus
from app.models.base import TenantDocument


class Student(TenantDocument):
    admission_no: str
    first_name: str
    last_name: str
    dob: date | None = None
    gender: str | None = None
    blood_group: str | None = None

    academic_year_id: str
    class_id: str
    section_id: str
    roll_number: str | None = None

    guardian_ids: list[str] = Field(default_factory=list)
    primary_guardian_id: str | None = None

    admission_date: date | None = None
    status: StudentStatus = StudentStatus.ACTIVE

    address: str | None = None
    phone: str | None = None
    email: str | None = None

    photo_document_id: str | None = None
    document_ids: list[str] = Field(default_factory=list)

    class Settings:
        name = "students"
        indexes = ["school_id", "section_id", "class_id", "admission_no", "status"]

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()
