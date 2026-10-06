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

    # Additional details collected by the admission form (all optional)
    applicant_middle_name: str | None = None
    blood_group: str | None = None
    academic_year_id: str | None = None
    previous_school: str | None = None
    student_photo_id: str | None = None

    father_name: str | None = None
    father_phone: str | None = None
    father_email: str | None = None
    mother_name: str | None = None
    mother_phone: str | None = None
    mother_email: str | None = None
    primary_guardian: str | None = None
    guardian_relationship: str | None = None

    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    postal_code: str | None = None

    previous_class: str | None = None
    previous_board: str | None = None
    previous_school_location: str | None = None
    transfer_certificate_no: str | None = None
    admission_type: str | None = None


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

    # Additional details collected by the admission form (all optional)
    applicant_middle_name: str | None = None
    blood_group: str | None = None
    academic_year_id: str | None = None
    previous_school: str | None = None
    student_photo_id: str | None = None

    father_name: str | None = None
    father_phone: str | None = None
    father_email: str | None = None
    mother_name: str | None = None
    mother_phone: str | None = None
    mother_email: str | None = None
    primary_guardian: str | None = None
    guardian_relationship: str | None = None

    address_line1: str | None = None
    address_line2: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    postal_code: str | None = None

    previous_class: str | None = None
    previous_board: str | None = None
    previous_school_location: str | None = None
    transfer_certificate_no: str | None = None
    admission_type: str | None = None
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
