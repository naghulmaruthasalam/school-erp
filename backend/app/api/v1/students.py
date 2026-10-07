from fastapi import APIRouter, Depends

from app.core.deps import CurrentUser, get_current_user, require_roles
from app.core.enums import Role, StudentStatus
from app.schemas.common import PageParams, PageResponse
from app.schemas.student import StudentCreateRequest, StudentCreateResponse, StudentOut, StudentStatusUpdateRequest, StudentUpdateRequest
from app.services import student_service

router = APIRouter(prefix="/students", tags=["students"])

ADMIN_ROLES = (Role.SCHOOL_ADMIN, Role.PRINCIPAL)


@router.post("", response_model=StudentCreateResponse, status_code=201)
async def create_student(
    payload: StudentCreateRequest,
    current: CurrentUser = Depends(require_roles(*ADMIN_ROLES)),
) -> StudentCreateResponse:
    student, credentials = await student_service.create_student(current, payload)
    out = student_service.to_out(student)
    return StudentCreateResponse(**out.model_dump(), credentials=credentials)


@router.get("", response_model=PageResponse[StudentOut])
async def list_students(
    class_id: str | None = None,
    section_id: str | None = None,
    status: StudentStatus | None = None,
    name: str | None = None,
    page_params: PageParams = Depends(),
    current: CurrentUser = Depends(require_roles(*ADMIN_ROLES, Role.TEACHER)),
) -> PageResponse[StudentOut]:
    return await student_service.list_students(current, class_id, section_id, status, name, page_params)


@router.get("/me", response_model=StudentOut)
async def get_my_profile(
    current: CurrentUser = Depends(require_roles(Role.STUDENT)),
) -> StudentOut:
    student = await student_service.get_own_profile(current)
    return student_service.to_out(student)


@router.patch("/me", response_model=StudentOut)
async def update_my_profile(
    payload: StudentUpdateRequest,
    current: CurrentUser = Depends(require_roles(Role.STUDENT)),
) -> StudentOut:
    student = await student_service.update_own_profile(current, payload)
    return student_service.to_out(student)


@router.get("/my-children", response_model=list[StudentOut])
async def get_my_children(
    current: CurrentUser = Depends(require_roles(Role.PARENT)),
) -> list[StudentOut]:
    students = await student_service.get_my_children(current)
    return [student_service.to_out(s) for s in students]


@router.get("/{student_id}", response_model=StudentOut)
async def get_student(
    student_id: str,
    current: CurrentUser = Depends(get_current_user),
) -> StudentOut:
    student = await student_service.get_student(current, student_id)
    return student_service.to_out(student)


@router.patch("/{student_id}", response_model=StudentOut)
async def update_student(
    student_id: str,
    payload: StudentUpdateRequest,
    current: CurrentUser = Depends(require_roles(*ADMIN_ROLES)),
) -> StudentOut:
    student = await student_service.update_student(current, student_id, payload)
    return student_service.to_out(student)


@router.patch("/{student_id}/status", response_model=StudentOut)
async def update_student_status(
    student_id: str,
    payload: StudentStatusUpdateRequest,
    current: CurrentUser = Depends(require_roles(*ADMIN_ROLES)),
) -> StudentOut:
    student = await student_service.update_student_status(current, student_id, payload)
    return student_service.to_out(student)


@router.delete("/{student_id}", status_code=204)
async def delete_student(
    student_id: str,
    current: CurrentUser = Depends(require_roles(*ADMIN_ROLES)),
) -> None:
    await student_service.delete_student(current, student_id)


@router.post("/{student_id}/guardians/{guardian_id}", response_model=StudentOut)
async def link_guardian(
    student_id: str,
    guardian_id: str,
    make_primary: bool = False,
    current: CurrentUser = Depends(require_roles(*ADMIN_ROLES)),
) -> StudentOut:
    student = await student_service.link_guardian(current, student_id, guardian_id, make_primary)
    return student_service.to_out(student)


@router.post("/{student_id}/reset-password")
async def reset_student_password(
    student_id: str,
    current: CurrentUser = Depends(require_roles(*ADMIN_ROLES)),
) -> dict:
    """Reset or create login credentials for a student."""
    credentials = await student_service.reset_student_password(current, student_id)
    return credentials
