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

    status: AdmissionStatus = AdmissionStatus.SUBMITTED
    reviewed_by: str | None = None
    review_notes: str | None = None
    created_student_id: str | None = None

    class Settings:
        name = "admissions"
        indexes = ["school_id", "status"]
