from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field

from app.core.enums import StudentStatus


class StudentCreateRequest(BaseModel):
    admission_no: str | None = Field(default=None, description="Auto-generated if not provided")
    first_name: str
    last_name: str
    dob: date | None = None
    gender: str | None = None
    blood_group: str | None = None

    academic_year_id: str
    class_id: str
    section_id: str
    roll_number: str | None = None

    admission_date: date | None = None

    address: str | None = None
    phone: str | None = None
    email: EmailStr | None = None

    photo_document_id: str | None = None
    document_ids: list[str] = Field(default_factory=list)


class StudentUpdateRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    dob: date | None = None
    gender: str | None = None
    blood_group: str | None = None

    academic_year_id: str | None = None
    class_id: str | None = None
    section_id: str | None = None
    roll_number: str | None = None

    address: str | None = None
    phone: str | None = None
    email: EmailStr | None = None

    photo_document_id: str | None = None
    document_ids: list[str] | None = None


class StudentStatusUpdateRequest(BaseModel):
    status: StudentStatus
    note: str | None = None


class StudentOut(BaseModel):
    id: str
    school_id: str
    admission_no: str
    first_name: str
    last_name: str
    full_name: str
    dob: date | None = None
    gender: str | None = None
    blood_group: str | None = None

    academic_year_id: str
    class_id: str
    section_id: str
    roll_number: str | None = None

    guardian_ids: list[str]
    primary_guardian_id: str | None = None

    admission_date: date | None = None
    status: StudentStatus

    address: str | None = None
    phone: str | None = None
    email: str | None = None

    photo_document_id: str | None = None
    document_ids: list[str]

    created_at: datetime
    updated_at: datetime


class StudentCreateResponse(StudentOut):
    """Response after creating a student - includes one-time credentials if email was provided."""
    credentials: dict | None = None  # {"email": "...", "password": "..."}
