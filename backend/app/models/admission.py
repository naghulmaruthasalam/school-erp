from datetime import date

from pydantic import Field

from app.core.enums import AdmissionStatus
from app.models.base import TenantDocument


class Admission(TenantDocument):
    applicant_first_name: str
    applicant_last_name: str
    dob: date | None = None
    gender: str | None = None

    applying_for_class_id: str

    applicant_email: str | None = Field(
        default=None,
        description="Applicant's own email, used to provision their STUDENT login on approval. "
        "Optional — if absent, the student login is skipped on approval (noted in the response).",
    )

    guardian_name: str
    guardian_phone: str
    guardian_email: str | None = None

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

    status: AdmissionStatus = AdmissionStatus.SUBMITTED
    reviewed_by: str | None = None
    review_notes: str | None = None
    created_student_id: str | None = None

    class Settings:
        name = "admissions"
        indexes = ["school_id", "status"]
