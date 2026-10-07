from typing import Any

from pydantic import Field

from app.models.base import TenantDocument


class AuditLog(TenantDocument):
    actor_user_id: str
    action: str  # e.g. "fee.refund.initiated", "student.created"
    entity_type: str | None = None
    entity_id: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)
    ip_address: str | None = None

    class Settings:
        name = "audit_logs"
        indexes = ["school_id", "actor_user_id", "entity_type"]
