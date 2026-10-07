"""Single-database multi-tenant isolation via school_id filtering.

All collections live in one database. Tenant isolation is enforced by:
1. Every tenant-scoped document has a `school_id` field
2. All queries must filter by `school_id`
3. A contextvar tracks the current tenant for the request

This is simpler than database-per-tenant and avoids MongoDB permission issues
while maintaining data isolation through application-level enforcement.
"""

from contextvars import ContextVar

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import get_settings

_current_school_id: ContextVar[str | None] = ContextVar("current_school_id", default=None)
_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(get_settings().mongodb_uri)
    return _client


def close_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


def get_database() -> AsyncIOMotorDatabase:
    """Get the single shared database."""
    return get_client()[get_settings().mongodb_db_name]


# Aliases for backwards compatibility during migration
def get_platform_db() -> AsyncIOMotorDatabase:
    return get_database()


def set_current_tenant(school_id: str | None) -> None:
    """Set the current tenant for this request context.

    school_id=None means platform-level access (SUPER_ADMIN).
    """
    _current_school_id.set(school_id)


def get_current_school_id() -> str | None:
    """Get the current tenant's school_id, or None for platform access."""
    return _current_school_id.get()


def require_current_school_id() -> str:
    """Get the current school_id, raising if not set.

    Use this in tenant-scoped operations that must have a school context.
    """
    school_id = _current_school_id.get()
    if school_id is None:
        raise RuntimeError(
            "No tenant set for this request context — set_current_tenant() must run "
            "before any tenant-scoped operation."
        )
    return school_id
