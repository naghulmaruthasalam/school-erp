"""Notification and Announcement models."""
from datetime import datetime
from enum import Enum

from pydantic import Field

from app.models.base import TenantDocument


class NotificationType(str, Enum):
    ANNOUNCEMENT = "ANNOUNCEMENT"
    NOTICE = "NOTICE"
    ALERT = "ALERT"
    REMINDER = "REMINDER"
    EVENT = "EVENT"


class NotificationPriority(str, Enum):
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    URGENT = "URGENT"


class Notification(TenantDocument):
    """School-wide notifications and announcements."""

    title: str
    content: str
    notification_type: NotificationType = NotificationType.ANNOUNCEMENT
    priority: NotificationPriority = NotificationPriority.NORMAL

    # Target audience
    target_roles: list[str] = Field(default_factory=list)  # Empty = all roles
    target_class_ids: list[str] = Field(default_factory=list)  # Empty = all classes

    # Scheduling
    publish_at: datetime | None = None
    expires_at: datetime | None = None
    is_published: bool = True

    # Attachments
    document_ids: list[str] = Field(default_factory=list)

    # System-generated notifications (progress alerts, tickets, summaries) go to named users, not to a whole role.
    # When this is non-empty ONLY these users see the notification (admins included).
    target_user_ids: list[str] = Field(default_factory=list)
    category: str | None = None  # e.g. "progress", "teacher_performance", "weekly_summary", "ticket"
    link: str | None = None  # an in-app path the notification opens, e.g. "/parent/homework"
    dedupe_key: str | None = None  # the same event for the same user is only sent once

    # Author
    created_by: str
    created_by_name: str

    class Settings:
        name = "notifications"
        indexes = ["school_id", "notification_type", "is_published", "publish_at", "target_user_ids", "dedupe_key"]


class UserNotificationRead(TenantDocument):
    """Tracks which users have read which notifications."""

    user_id: str
    notification_id: str
    read_at: datetime

    class Settings:
        name = "user_notification_reads"
        indexes = ["school_id", "user_id", "notification_id"]
