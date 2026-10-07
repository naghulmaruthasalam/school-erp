from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.deps import CurrentUser, require_roles, require_tenant_user
from app.core.enums import Role
from app.core.exceptions import NotFoundError
from app.models.base import utcnow
from app.models.tenant import Tenant
from app.schemas.common import PageParams, PageResponse
from app.schemas.school import SchoolCreateRequest, SchoolCreateResponse, SchoolOut, SchoolUpdateRequest
from app.services import school_service

router = APIRouter(prefix="/schools", tags=["schools"])

_super_admin_only = require_roles(Role.SUPER_ADMIN)
_admin_roles = require_roles(Role.SCHOOL_ADMIN, Role.PRINCIPAL)


@router.post("", response_model=SchoolCreateResponse, status_code=201)
async def create_school(
    payload: SchoolCreateRequest,
    current: CurrentUser = Depends(_super_admin_only),
) -> SchoolCreateResponse:
    return await school_service.create_school(payload)


@router.post("/register", response_model=SchoolCreateResponse, status_code=201)
async def register_school(payload: SchoolCreateRequest) -> SchoolCreateResponse:
    """Public, unauthenticated self-service sign-up — a new school creates
    itself + its first SCHOOL_ADMIN login, same underlying flow as the
    super-admin-only `POST /schools` above. No email verification, captcha,
    or rate limiting is applied here — that's an intentional v1 gap, not an
    oversight; add one before relying on this in real production (e.g. a
    reverse-proxy/API-gateway rate limit, or a library like slowapi)."""
    return await school_service.create_school(payload)


def _school_settings_out(tenant: Tenant) -> dict[str, Any]:
    return {
        "id": str(tenant.id),
        "name": tenant.name,
        "code": tenant.code,
        "email": tenant.email or "",
        "phone": tenant.phone or "",
        "address": tenant.address or "",
        "city": tenant.city or "",
        "state": tenant.state or "",
        "pincode": tenant.postal_code or "",
        "website": tenant.website or "",
        "logo_url": "",
        "academic_year_start_month": tenant.academic_year_start_month,
        "currency": tenant.currency,
        "timezone": tenant.timezone,
    }


class SchoolSettingsUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    website: str | None = None
    academic_year_start_month: int | None = Field(default=None, ge=1, le=12)
    currency: str | None = None
    timezone: str | None = None


# NOTE: declared before the /{school_id} routes so "current" is never read as a school id.


@router.get("/current", response_model=dict[str, Any])
async def get_current_school(
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """The signed-in user's own school (settings page, branding)."""
    tenant = await Tenant.get(current.school_id)
    if not tenant:
        raise NotFoundError("School not found")
    return _school_settings_out(tenant)


@router.patch("/current", response_model=dict[str, Any])
async def update_current_school(
    payload: SchoolSettingsUpdate,
    current: CurrentUser = Depends(_admin_roles),
) -> dict[str, Any]:
    """Update the signed-in admin's own school."""
    tenant = await Tenant.get(current.school_id)
    if not tenant:
        raise NotFoundError("School not found")

    update_data = payload.model_dump(exclude_none=True)
    if "pincode" in update_data:
        update_data["postal_code"] = update_data.pop("pincode")
    for key, value in update_data.items():
        setattr(tenant, key, value)
    tenant.updated_at = utcnow()
    await tenant.save()
    return _school_settings_out(tenant)


@router.get("", response_model=PageResponse[SchoolOut])
async def list_schools(
    params: PageParams = Depends(),
    current: CurrentUser = Depends(_super_admin_only),
) -> PageResponse[SchoolOut]:
    return await school_service.list_schools(params)


@router.get("/{school_id}", response_model=SchoolOut)
async def get_school(
    school_id: str,
    current: CurrentUser = Depends(_super_admin_only),
) -> SchoolOut:
    return await school_service.get_school(school_id)


@router.patch("/{school_id}", response_model=SchoolOut)
async def update_school(
    school_id: str,
    payload: SchoolUpdateRequest,
    current: CurrentUser = Depends(_super_admin_only),
) -> SchoolOut:
    return await school_service.update_school(school_id, payload, current.id)


@router.get("/stats/overview")
async def get_platform_stats(
    current: CurrentUser = Depends(_super_admin_only),
) -> dict[str, Any]:
    return await school_service.get_platform_stats()


@router.get("/stats/users")
async def get_users_by_role(
    current: CurrentUser = Depends(_super_admin_only),
) -> list[dict[str, Any]]:
    return await school_service.get_users_by_role()


@router.get("/stats/audit-logs")
async def get_recent_audit_logs(
    limit: int = 50,
    current: CurrentUser = Depends(_super_admin_only),
) -> list[dict[str, Any]]:
    return await school_service.get_recent_audit_logs(limit)


@router.get("/{school_id}/stats")
async def get_school_stats(
    school_id: str,
    current: CurrentUser = Depends(_super_admin_only),
) -> dict[str, Any]:
    return await school_service.get_school_stats(school_id)
