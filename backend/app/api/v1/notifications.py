"""Notification API endpoints."""
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.core.deps import CurrentUser, get_current_user
from app.schemas.common import PageParams, PageResponse
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class NotificationCreate(BaseModel):
    title: str
    content: str
    notification_type: str = "ANNOUNCEMENT"
    priority: str = "NORMAL"
    target_roles: list[str] | None = None
    target_class_ids: list[str] | None = None
    publish_at: datetime | None = None
    expires_at: datetime | None = None
    document_ids: list[str] | None = None


@router.post("")
async def create_notification(
    payload: NotificationCreate,
    current: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return await notification_service.create_notification(
        current,
        title=payload.title,
        content=payload.content,
        notification_type=payload.notification_type,
        priority=payload.priority,
        target_roles=payload.target_roles,
        target_class_ids=payload.target_class_ids,
        publish_at=payload.publish_at,
        expires_at=payload.expires_at,
        document_ids=payload.document_ids,
    )


@router.get("")
async def list_notifications(
    notification_type: str | None = Query(None),
    include_expired: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current: CurrentUser = Depends(get_current_user),
) -> PageResponse[dict[str, Any]]:
    return await notification_service.list_notifications(
        current,
        notification_type=notification_type,
        include_expired=include_expired,
        params=PageParams(page=page, page_size=page_size),
    )


@router.get("/unread-count")
async def get_unread_count(
    current: CurrentUser = Depends(get_current_user),
) -> dict[str, int]:
    return await notification_service.get_unread_count(current)


@router.get("/{notification_id}")
async def get_notification(
    notification_id: str,
    current: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return await notification_service.get_notification(current, notification_id)


@router.post("/{notification_id}/read")
async def mark_as_read(
    notification_id: str,
    current: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    return await notification_service.mark_as_read(current, notification_id)


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current: CurrentUser = Depends(get_current_user),
) -> dict[str, str]:
    return await notification_service.delete_notification(current, notification_id)
