from datetime import datetime

from pydantic import BaseModel, EmailStr


class GuardianCreateRequest(BaseModel):
    full_name: str
    relation: str = "Guardian"
    phone: str
    email: EmailStr | None = None
    occupation: str | None = None
    address: str | None = None
    photo_document_id: str | None = None


class GuardianUpdateRequest(BaseModel):
    full_name: str | None = None
    relation: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    occupation: str | None = None
    address: str | None = None
    photo_document_id: str | None = None


class GuardianOut(BaseModel):
    id: str
    school_id: str
    full_name: str
    relation: str
    phone: str
    email: str | None = None
    occupation: str | None = None
    address: str | None = None
    student_ids: list[str]
    photo_document_id: str | None = None
    created_at: datetime
    updated_at: datetime


class GuardianCreateResponse(GuardianOut):
    """Response after creating a guardian - includes one-time credentials if email was provided."""
    credentials: dict | None = None
