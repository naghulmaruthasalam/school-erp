from typing import Any

from app.models.audit_log import AuditLog


async def record_audit(
    school_id: str,
    actor_user_id: str,
    action: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    details: dict[str, Any] | None = None,
    ip_address: str | None = None,
) -> None:
    await AuditLog(
        school_id=school_id,
        actor_user_id=actor_user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details or {},
        ip_address=ip_address,
    ).insert()
