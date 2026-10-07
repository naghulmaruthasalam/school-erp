"""Notification service."""
from datetime import datetime, timezone
from typing import Any

from app.core.audit import record_audit
from app.core.deps import CurrentUser
from app.core.enums import Role
from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.models.notification import Notification, NotificationPriority, NotificationType, UserNotificationRead
from app.schemas.common import PageParams, PageResponse

ADMIN_ROLES = (Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL)


def to_out(notification: Notification, is_read: bool = False) -> dict[str, Any]:
    return {
        "id": str(notification.id),
        "school_id": notification.school_id,
        "title": notification.title,
        "content": notification.content,
        "notification_type": notification.notification_type,
        "priority": notification.priority,
        "target_roles": notification.target_roles,
        "target_class_ids": notification.target_class_ids,
        "publish_at": notification.publish_at.isoformat() if notification.publish_at else None,
        "expires_at": notification.expires_at.isoformat() if notification.expires_at else None,
        "is_published": notification.is_published,
        "document_ids": notification.document_ids,
        "created_by": notification.created_by,
        "created_by_name": notification.created_by_name,
        "created_at": notification.created_at.isoformat() if notification.created_at else None,
        "is_read": is_read,
    }


async def create_notification(
    current: CurrentUser,
    title: str,
    content: str,
    notification_type: str = "ANNOUNCEMENT",
    priority: str = "NORMAL",
    target_roles: list[str] | None = None,
    target_class_ids: list[str] | None = None,
    publish_at: datetime | None = None,
    expires_at: datetime | None = None,
    document_ids: list[str] | None = None,
) -> dict[str, Any]:
    """Create a notification (admin only)."""
    if current.role not in ADMIN_ROLES:
        raise PermissionDeniedError()

    notification = Notification(
        school_id=current.school_id,
        title=title,
        content=content,
        notification_type=NotificationType(notification_type),
        priority=NotificationPriority(priority),
        target_roles=target_roles or [],
        target_class_ids=target_class_ids or [],
        publish_at=publish_at,
        expires_at=expires_at,
        is_published=publish_at is None,
        document_ids=document_ids or [],
        created_by=str(current.user.id),
        created_by_name=current.user.full_name,
    )
    await notification.insert()

    await record_audit(
        school_id=current.school_id,
        actor_user_id=str(current.user.id),
        action="notification.created",
        entity_type="Notification",
        entity_id=str(notification.id),
    )

    return to_out(notification)


async def list_notifications(
    current: CurrentUser,
    notification_type: str | None = None,
    include_expired: bool = False,
    params: PageParams | None = None,
) -> PageResponse[dict[str, Any]]:
    """List notifications visible to the current user."""
    params = params or PageParams()
    now = datetime.now(timezone.utc)

    query = Notification.find(Notification.school_id == current.school_id)

    # Only show published notifications (or all for admins)
    if current.role not in ADMIN_ROLES:
        query = query.find(Notification.is_published == True)
        # Filter by target roles
        query = query.find({
            "$or": [
                {"target_roles": {"$size": 0}},
                {"target_roles": current.role},
            ]
        })

    if notification_type:
        query = query.find(Notification.notification_type == notification_type)

    if not include_expired:
        query = query.find({
            "$or": [
                {"expires_at": None},
                {"expires_at": {"$gt": now}},
            ]
        })

    total = await query.count()
    notifications = await query.sort(-Notification.created_at).skip(params.skip).limit(params.page_size).to_list()

    # Get read status for current user
    notification_ids = [str(n.id) for n in notifications]
    reads = await UserNotificationRead.find(
        UserNotificationRead.user_id == str(current.user.id),
        {"notification_id": {"$in": notification_ids}},
    ).to_list()
    read_ids = {r.notification_id for r in reads}

    items = [to_out(n, is_read=str(n.id) in read_ids) for n in notifications]

    return PageResponse(
        items=items,
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


async def get_notification(current: CurrentUser, notification_id: str) -> dict[str, Any]:
    """Get a single notification."""
    notification = await Notification.get(notification_id)
    if not notification or notification.school_id != current.school_id:
        raise NotFoundError("Notification not found")

    # Check read status
    read = await UserNotificationRead.find_one(
        UserNotificationRead.user_id == str(current.user.id),
        UserNotificationRead.notification_id == notification_id,
    )

    return to_out(notification, is_read=read is not None)


async def mark_as_read(current: CurrentUser, notification_id: str) -> dict[str, str]:
    """Mark a notification as read."""
    notification = await Notification.get(notification_id)
    if not notification or notification.school_id != current.school_id:
        raise NotFoundError("Notification not found")

    # Check if already read
    existing = await UserNotificationRead.find_one(
        UserNotificationRead.user_id == str(current.user.id),
        UserNotificationRead.notification_id == notification_id,
    )

    if not existing:
        read = UserNotificationRead(
            school_id=current.school_id,
            user_id=str(current.user.id),
            notification_id=notification_id,
            read_at=datetime.now(timezone.utc),
        )
        await read.insert()

    return {"message": "Marked as read"}


async def delete_notification(current: CurrentUser, notification_id: str) -> dict[str, str]:
    """Delete a notification (admin only)."""
    if current.role not in ADMIN_ROLES:
        raise PermissionDeniedError()

    notification = await Notification.get(notification_id)
    if not notification or notification.school_id != current.school_id:
        raise NotFoundError("Notification not found")

    await notification.delete()

    return {"message": "Notification deleted"}


async def get_unread_count(current: CurrentUser) -> dict[str, int]:
    """Get count of unread notifications for current user."""
    now = datetime.now(timezone.utc)

    # Get all visible notifications
    query = Notification.find(
        Notification.school_id == current.school_id,
        Notification.is_published == True,
        {
            "$or": [
                {"expires_at": None},
                {"expires_at": {"$gt": now}},
            ]
        },
        {
            "$or": [
                {"target_roles": {"$size": 0}},
                {"target_roles": current.role},
            ]
        },
    )

    all_notifications = await query.to_list()
    notification_ids = [str(n.id) for n in all_notifications]

    # Get read notifications
    reads = await UserNotificationRead.find(
        UserNotificationRead.user_id == str(current.user.id),
        {"notification_id": {"$in": notification_ids}},
    ).to_list()
    read_ids = {r.notification_id for r in reads}

    unread_count = sum(1 for nid in notification_ids if nid not in read_ids)

    return {"unread": unread_count, "total": len(notification_ids)}
