"""Leave management API endpoints."""
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.deps import CurrentUser, require_tenant_user
from app.schemas.common import PageParams, PageResponse
from app.services import leave_service

router = APIRouter(prefix="/leave", tags=["leave"])


class LeaveCreateRequest(BaseModel):
    leave_type: str
    start_date: date
    end_date: date
    reason: str
    document_ids: list[str] = Field(default_factory=list)


class LeaveReviewRequest(BaseModel):
    action: str  # "approve" or "reject"
    notes: str | None = None


@router.post("")
async def create_leave_request(
    payload: LeaveCreateRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Create a leave request."""
    return await leave_service.create_leave_request(
        current,
        payload.leave_type,
        payload.start_date,
        payload.end_date,
        payload.reason,
        payload.document_ids,
    )


@router.get("")
async def list_leave_requests(
    status: str | None = None,
    requester_type: str | None = None,
    params: PageParams = Depends(),
    current: CurrentUser = Depends(require_tenant_user),
) -> PageResponse[dict[str, Any]]:
    """List leave requests."""
    return await leave_service.list_leave_requests(current, status, requester_type, params)


@router.post("/{leave_id}/review")
async def review_leave_request(
    leave_id: str,
    payload: LeaveReviewRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Approve or reject a leave request (admin only)."""
    return await leave_service.review_leave_request(
        current, leave_id, payload.action, payload.notes
    )


@router.post("/{leave_id}/cancel")
async def cancel_leave_request(
    leave_id: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Cancel a pending leave request."""
    return await leave_service.cancel_leave_request(current, leave_id)


@router.get("/summary")
async def get_leave_summary(
    requester_id: str | None = None,
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, int]:
    """Get leave summary counts."""
    return await leave_service.get_leave_summary(current, requester_id)
