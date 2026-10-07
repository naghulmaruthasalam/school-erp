from datetime import date

from pydantic import Field

from app.core.enums import TeacherStatus
from app.models.base import TenantDocument


class Teacher(TenantDocument):
    employee_no: str
    first_name: str
    last_name: str
    dob: date | None = None
    gender: str | None = None
    phone: str
    email: str | None = None
    address: str | None = None

    qualifications: list[str] = Field(default_factory=list)
    subject_ids: list[str] = Field(default_factory=list)
    assigned_class_ids: list[str] = Field(default_factory=list, description="Classes/grades this teacher can manage")

    joining_date: date | None = None
    status: TeacherStatus = TeacherStatus.ACTIVE

    photo_document_id: str | None = None
    document_ids: list[str] = Field(default_factory=list)

    class Settings:
        name = "teachers"
        indexes = ["school_id", "employee_no", "status"]

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()
