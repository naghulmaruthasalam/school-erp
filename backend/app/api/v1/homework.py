from datetime import date

from fastapi import APIRouter, Depends

from app.core.deps import CurrentUser, require_tenant_user
from app.schemas.common import PageParams, PageResponse
from app.schemas.homework import (
    HomeworkCreateRequest,
    HomeworkOut,
    HomeworkSubmissionOut,
    HomeworkSubmissionUpdateRequest,
    HomeworkUpdateRequest,
    PendingHomeworkOut,
)
from app.services import homework_service

router = APIRouter(prefix="/homework", tags=["homework"])


@router.post("", response_model=HomeworkOut, status_code=201)
async def create_homework(
    payload: HomeworkCreateRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> HomeworkOut:
    return await homework_service.create_homework(current, payload)


@router.get("", response_model=PageResponse[HomeworkOut])
async def list_homework(
    section_id: str | None = None,
    subject_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    params: PageParams = Depends(),
    current: CurrentUser = Depends(require_tenant_user),
) -> PageResponse[HomeworkOut]:
    return await homework_service.list_homework(current, section_id, subject_id, date_from, date_to, params)


@router.get("/pending", response_model=list[PendingHomeworkOut])
async def pending_homework(
    current: CurrentUser = Depends(require_tenant_user),
) -> list[PendingHomeworkOut]:
    return await homework_service.pending_homework(current)


@router.get("/{homework_id}", response_model=HomeworkOut)
async def get_homework(
    homework_id: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> HomeworkOut:
    return await homework_service.get_homework(current, homework_id)


@router.patch("/{homework_id}", response_model=HomeworkOut)
async def update_homework(
    homework_id: str,
    payload: HomeworkUpdateRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> HomeworkOut:
    return await homework_service.update_homework(current, homework_id, payload)


@router.delete("/{homework_id}", status_code=204)
async def delete_homework(
    homework_id: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> None:
    await homework_service.delete_homework(current, homework_id)


@router.get("/{homework_id}/submissions", response_model=list[HomeworkSubmissionOut])
async def list_submissions(
    homework_id: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> list[HomeworkSubmissionOut]:
    return await homework_service.list_submissions(current, homework_id)


@router.patch("/submissions/{submission_id}", response_model=HomeworkSubmissionOut)
async def update_submission(
    submission_id: str,
    payload: HomeworkSubmissionUpdateRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> HomeworkSubmissionOut:
    return await homework_service.update_submission(current, submission_id, payload)
