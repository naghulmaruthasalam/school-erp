from pydantic import Field

from app.models.base import TenantDocument


class Guardian(TenantDocument):
    """A parent/guardian profile. May link to multiple students (siblings)."""

    full_name: str
    relation: str = Field(default="Guardian", description="Father / Mother / Guardian")
    phone: str
    email: str | None = None
    occupation: str | None = None
    address: str | None = None
    student_ids: list[str] = Field(default_factory=list)
    photo_document_id: str | None = None

    class Settings:
        name = "guardians"
        indexes = ["school_id", "phone"]
