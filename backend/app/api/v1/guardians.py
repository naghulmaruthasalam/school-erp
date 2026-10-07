from fastapi import APIRouter, Depends

from app.core.deps import CurrentUser, require_roles
from app.core.enums import Role
from app.schemas.common import PageParams, PageResponse
from app.schemas.guardian import GuardianCreateRequest, GuardianCreateResponse, GuardianOut, GuardianUpdateRequest
from app.services import guardian_service

router = APIRouter(prefix="/guardians", tags=["guardians"])

ADMIN_ROLES = (Role.SCHOOL_ADMIN, Role.PRINCIPAL)


@router.post("", response_model=GuardianCreateResponse, status_code=201)
async def create_guardian(
    payload: GuardianCreateRequest,
    current: CurrentUser = Depends(require_roles(*ADMIN_ROLES)),
) -> GuardianCreateResponse:
    guardian, credentials = await guardian_service.create_guardian(current, payload)
    out = guardian_service.to_out(guardian)
    return GuardianCreateResponse(**out.model_dump(), credentials=credentials)


@router.get("", response_model=PageResponse[GuardianOut])
async def list_guardians(
    phone: str | None = None,
    name: str | None = None,
    page_params: PageParams = Depends(),
    current: CurrentUser = Depends(require_roles(*ADMIN_ROLES)),
) -> PageResponse[GuardianOut]:
    return await guardian_service.list_guardians(current, phone, name, page_params)


@router.get("/me", response_model=GuardianOut)
async def get_my_guardian_profile(
    current: CurrentUser = Depends(require_roles(Role.PARENT)),
) -> GuardianOut:
    guardian = await guardian_service.get_own_guardian(current)
    return guardian_service.to_out(guardian)


@router.patch("/me", response_model=GuardianOut)
async def update_my_guardian_profile(
    payload: GuardianUpdateRequest,
    current: CurrentUser = Depends(require_roles(Role.PARENT)),
) -> GuardianOut:
    guardian = await guardian_service.update_own_guardian(current, payload)
    return guardian_service.to_out(guardian)


@router.get("/{guardian_id}", response_model=GuardianOut)
async def get_guardian(
    guardian_id: str,
    current: CurrentUser = Depends(require_roles(*ADMIN_ROLES)),
) -> GuardianOut:
    guardian = await guardian_service.get_guardian(current, guardian_id)
    return guardian_service.to_out(guardian)


@router.patch("/{guardian_id}", response_model=GuardianOut)
async def update_guardian(
    guardian_id: str,
    payload: GuardianUpdateRequest,
    current: CurrentUser = Depends(require_roles(*ADMIN_ROLES)),
) -> GuardianOut:
    guardian = await guardian_service.update_guardian(current, guardian_id, payload)
    return guardian_service.to_out(guardian)


@router.delete("/{guardian_id}", status_code=204)
async def delete_guardian(
    guardian_id: str,
    current: CurrentUser = Depends(require_roles(*ADMIN_ROLES)),
) -> None:
    await guardian_service.delete_guardian(current, guardian_id)


@router.post("/{guardian_id}/reset-password")
async def reset_guardian_password(
    guardian_id: str,
    current: CurrentUser = Depends(require_roles(*ADMIN_ROLES)),
) -> dict:
    """Reset or create login credentials for a guardian/parent."""
    return await guardian_service.reset_guardian_password(current, guardian_id)
