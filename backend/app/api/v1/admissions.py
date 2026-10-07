from fastapi import APIRouter, Depends

from app.core.deps import CurrentUser, require_roles
from app.core.enums import AdmissionStatus, Role
from app.schemas.admission import (
    AdmissionCreateRequest,
    AdmissionOut,
    AdmissionReviewRequest,
    AdmissionReviewResponse,
)
from app.schemas.common import PageParams, PageResponse
from app.services import admission_service

router = APIRouter(prefix="/admissions", tags=["admissions"])

ADMIN_ROLES = (Role.SCHOOL_ADMIN, Role.PRINCIPAL)


@router.post("", response_model=AdmissionOut, status_code=201)
async def create_admission(
    payload: AdmissionCreateRequest,
    current: CurrentUser = Depends(require_roles(*ADMIN_ROLES)),
) -> AdmissionOut:
    admission = await admission_service.create_admission(current, payload)
    return admission_service.to_out(admission)


@router.get("", response_model=PageResponse[AdmissionOut])
async def list_admissions(
    status: AdmissionStatus | None = None,
    page_params: PageParams = Depends(),
    current: CurrentUser = Depends(require_roles(*ADMIN_ROLES)),
) -> PageResponse[AdmissionOut]:
    return await admission_service.list_admissions(current, status, page_params)


@router.get("/{admission_id}", response_model=AdmissionOut)
async def get_admission(
    admission_id: str,
    current: CurrentUser = Depends(require_roles(*ADMIN_ROLES)),
) -> AdmissionOut:
    admission = await admission_service.get_admission(current, admission_id)
    return admission_service.to_out(admission)


@router.post("/{admission_id}/review", response_model=AdmissionReviewResponse)
async def review_admission(
    admission_id: str,
    payload: AdmissionReviewRequest,
    current: CurrentUser = Depends(require_roles(*ADMIN_ROLES)),
) -> AdmissionReviewResponse:
    return await admission_service.review_admission(current, admission_id, payload)


@router.get("/next-roll-number/{section_id}", response_model=dict)
async def get_next_roll_number(
    section_id: str,
    current: CurrentUser = Depends(require_roles(*ADMIN_ROLES)),
) -> dict:
    """Get the next available roll number for a section"""
    roll_number = await admission_service._generate_roll_number(current.school_id, section_id)
    return {"roll_number": roll_number}
