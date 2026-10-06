from fastapi import APIRouter, Depends

from app.core.deps import CurrentUser, require_tenant_user
from app.schemas.common import PageParams, PageResponse
from app.schemas.syllabus import (
    SyllabusCreateRequest,
    SyllabusOut,
    SyllabusUpdateRequest,
)
from app.services import syllabus_service

router = APIRouter(prefix="/syllabus", tags=["syllabus"])


@router.post("", response_model=SyllabusOut, status_code=201)
async def create_syllabus(
    payload: SyllabusCreateRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> SyllabusOut:
    return await syllabus_service.create_syllabus(current, payload)


@router.get("", response_model=PageResponse[SyllabusOut])
async def list_syllabus(
    class_id: str | None = None,
    subject_id: str | None = None,
    academic_year_id: str | None = None,
    params: PageParams = Depends(),
    current: CurrentUser = Depends(require_tenant_user),
) -> PageResponse[SyllabusOut]:
    return await syllabus_service.list_syllabus(current, class_id, subject_id, academic_year_id, params)


@router.get("/{syllabus_id}", response_model=SyllabusOut)
async def get_syllabus(
    syllabus_id: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> SyllabusOut:
    return await syllabus_service.get_syllabus(current, syllabus_id)


@router.patch("/{syllabus_id}", response_model=SyllabusOut)
async def update_syllabus(
    syllabus_id: str,
    payload: SyllabusUpdateRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> SyllabusOut:
    return await syllabus_service.update_syllabus(current, syllabus_id, payload)


@router.delete("/{syllabus_id}", status_code=204)
async def delete_syllabus(
    syllabus_id: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> None:
    await syllabus_service.delete_syllabus(current, syllabus_id)
