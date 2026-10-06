from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

from app.core.enums import AdmissionStatus


class AdmissionCreateRequest(BaseModel):
    applicant_first_name: str
    applicant_last_name: str
    dob: date | None = None
    gender: str | None = None

    applying_for_class_id: str
    applicant_email: EmailStr | None = None

    guardian_name: str
    guardian_phone: str
    guardian_email: EmailStr | None = None

    document_ids: list[str] = Field(default_factory=list)


class AdmissionOut(BaseModel):
    id: str
    school_id: str
    applicant_first_name: str
    applicant_last_name: str
    dob: date | None = None
    gender: str | None = None
    applying_for_class_id: str
    applicant_email: str | None = None
    guardian_name: str
    guardian_phone: str
    guardian_email: str | None = None
    document_ids: list[str]
    status: AdmissionStatus
    reviewed_by: str | None = None
    review_notes: str | None = None
    created_student_id: str | None = None
    created_at: datetime
    updated_at: datetime


class AdmissionReviewRequest(BaseModel):
    action: Literal["approve", "reject"]
    review_notes: str | None = None

    # Required only when action == "approve"
    academic_year_id: str | None = None
    section_id: str | None = None
    admission_no: str | None = None
    roll_number: str | None = None


class AdmissionReviewResponse(BaseModel):
    admission: AdmissionOut
    student_id: str | None = None
    guardian_id: str | None = None
    student_login_created: bool = False
    guardian_login_created: bool = False
    notes: list[str] = Field(default_factory=list)
