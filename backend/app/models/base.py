from datetime import datetime, timezone

from beanie import Document
from pydantic import Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TenantDocument(Document):
    """Base for every collection scoped to a school (tenant).

    All queries on tenant documents MUST filter by school_id to ensure
    data isolation between schools. The school_id is set when creating
    documents and must match the current tenant context.
    """

    school_id: str = Field(..., description="Tenant id (Tenant.id as str)")
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        use_state_management = True
