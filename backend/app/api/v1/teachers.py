from fastapi import APIRouter, Depends

from app.core.deps import CurrentUser, require_roles
from app.core.enums import Role
from app.schemas.common import PageParams, PageResponse
from app.schemas.teacher import (
    TeacherCreateRequest,
    TeacherCreateResponse,
    TeacherOut,
    TeacherSelfUpdateRequest,
    TeacherUpdateRequest,
)
from app.services import teacher_service

router = APIRouter(prefix="/teachers", tags=["teachers"])

_admin_only = require_roles(Role.SCHOOL_ADMIN, Role.PRINCIPAL)
_teacher_only = require_roles(Role.TEACHER)


@router.post("", response_model=TeacherCreateResponse, status_code=201)
async def create_teacher(
    payload: TeacherCreateRequest,
    current: CurrentUser = Depends(_admin_only),
) -> TeacherCreateResponse:
    teacher_out, credentials = await teacher_service.create_teacher(current.school_id, payload, current.id)
    return TeacherCreateResponse(**teacher_out.model_dump(), credentials=credentials)


@router.get("", response_model=PageResponse[TeacherOut])
async def list_teachers(
    params: PageParams = Depends(),
    name: str | None = None,
    subject_id: str | None = None,
    status: str | None = None,
    current: CurrentUser = Depends(_admin_only),
) -> PageResponse[TeacherOut]:
    return await teacher_service.list_teachers(current.school_id, params, name=name, subject_id=subject_id, status=status)


@router.get("/me", response_model=TeacherOut)
async def get_my_profile(current: CurrentUser = Depends(_teacher_only)) -> TeacherOut:
    return await teacher_service.get_my_teacher_profile(current)


@router.patch("/me", response_model=TeacherOut)
async def update_my_profile(
    payload: TeacherSelfUpdateRequest,
    current: CurrentUser = Depends(_teacher_only),
) -> TeacherOut:
    return await teacher_service.update_my_teacher_profile(current, payload)


@router.get("/{teacher_id}", response_model=TeacherOut)
async def get_teacher(
    teacher_id: str,
    current: CurrentUser = Depends(_admin_only),
) -> TeacherOut:
    return await teacher_service.get_teacher(current.school_id, teacher_id)


@router.patch("/{teacher_id}", response_model=TeacherOut)
async def update_teacher(
    teacher_id: str,
    payload: TeacherUpdateRequest,
    current: CurrentUser = Depends(_admin_only),
) -> TeacherOut:
    return await teacher_service.update_teacher(current.school_id, teacher_id, payload, current.id)


@router.delete("/{teacher_id}", status_code=204)
async def delete_teacher(
    teacher_id: str,
    current: CurrentUser = Depends(_admin_only),
) -> None:
    await teacher_service.delete_teacher(current.school_id, teacher_id, current.id)


@router.post("/{teacher_id}/reset-password")
async def reset_teacher_password(
    teacher_id: str,
    current: CurrentUser = Depends(_admin_only),
) -> dict:
    """Reset or create login credentials for a teacher."""
    return await teacher_service.reset_teacher_password(current.school_id, teacher_id)
