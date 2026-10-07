from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field

from app.core.enums import TeacherStatus


class TeacherCreateRequest(BaseModel):
    employee_no: str | None = Field(default=None, description="Auto-generated if not provided")
    first_name: str
    last_name: str
    dob: date | None = None
    gender: str | None = None
    phone: str
    email: EmailStr
    address: str | None = None
    qualifications: list[str] = Field(default_factory=list)
    subject_ids: list[str] = Field(default_factory=list)
    assigned_class_ids: list[str] = Field(default_factory=list, description="Classes/grades this teacher can manage")
    joining_date: date | None = None
    status: TeacherStatus = TeacherStatus.ACTIVE


class TeacherUpdateRequest(BaseModel):
    """Full update available to SCHOOL_ADMIN/PRINCIPAL."""

    employee_no: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    dob: date | None = None
    gender: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    qualifications: list[str] | None = None
    subject_ids: list[str] | None = None
    assigned_class_ids: list[str] | None = None
    joining_date: date | None = None
    status: TeacherStatus | None = None


class TeacherSelfUpdateRequest(BaseModel):
    """Restricted subset a TEACHER may update on their own profile.

    Deliberately excludes employee_no/status/subject_ids/email and other
    admin-controlled fields.
    """

    phone: str | None = None
    address: str | None = None
    dob: date | None = None
    gender: str | None = None
    photo_document_id: str | None = None


class TeacherOut(BaseModel):
    id: str
    school_id: str
    employee_no: str
    first_name: str
    last_name: str
    full_name: str
    dob: date | None = None
    gender: str | None = None
    phone: str
    email: str | None = None
    address: str | None = None
    qualifications: list[str] = Field(default_factory=list)
    subject_ids: list[str] = Field(default_factory=list)
    assigned_class_ids: list[str] = Field(default_factory=list)
    joining_date: date | None = None
    status: TeacherStatus
    photo_document_id: str | None = None
    document_ids: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class TeacherCreateResponse(TeacherOut):
    """Response after creating a teacher - includes one-time credentials."""
    credentials: dict | None = None  # {"username": "...", "password": "..."}
