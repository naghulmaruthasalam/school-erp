"""System notifications addressed to named users (progress alerts, summaries, tickets). Each one is sent once per
dedupe key, so re-running a scan never repeats an alert."""
import logging

from app.models.notification import Notification, NotificationPriority, NotificationType

logger = logging.getLogger("notify")


async def notify_users(
    school_id: str, user_ids: list[str], title: str, content: str, *, category: str, priority: str = "NORMAL",
    link: str | None = None, dedupe_key: str | None = None, ntype: str = "ALERT", created_by: str = "system",
    created_by_name: str = "School ERP",
) -> bool:
    """Create one notification for these users. Returns False when there was nobody to tell or it was already sent."""
    user_ids = sorted({u for u in user_ids if u})
    if not user_ids:
        return False
    if dedupe_key:
        if await Notification.find_one({"school_id": school_id, "dedupe_key": dedupe_key}):
            return False
    await Notification(
        school_id=school_id, title=title, content=content, notification_type=NotificationType(ntype),
        priority=NotificationPriority(priority), target_user_ids=user_ids, category=category, link=link,
        dedupe_key=dedupe_key, created_by=created_by, created_by_name=created_by_name,
    ).insert()
    return True
