from datetime import datetime

import pymongo
from beanie import Document
from pydantic import Field

from app.models.base import utcnow


class Tenant(Document):
    """A school. Not tenant-scoped itself — this IS the tenant."""

    name: str
    code: str = Field(..., description="Unique short code, e.g. GHS2026")
    address: str | None = None
    city: str | None = None
    state: str | None = None
    country: str = "India"
    postal_code: str | None = None
    phone: str | None = None
    email: str | None = None
    logo_document_id: str | None = None
    academic_year_start_month: int = Field(default=6, ge=1, le=12)
    is_active: bool = True
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "tenants"
        indexes = [
            pymongo.IndexModel([("code", pymongo.ASCENDING)], unique=True, name="uniq_code"),
        ]
