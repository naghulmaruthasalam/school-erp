"""Support tickets: a student or parent who is not satisfied with a service raises one; school leaders and the platform's
super admins are told, can reply, and move it through its statuses."""
from datetime import datetime
from enum import StrEnum

from pydantic import Field

from app.models.base import TenantDocument, utcnow


class TicketStatus(StrEnum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class TicketCategory(StrEnum):
    ACADEMICS = "ACADEMICS"
    TEACHING = "TEACHING"
    FACILITIES = "FACILITIES"
    TRANSPORT = "TRANSPORT"
    FEES = "FEES"
    SAFETY = "SAFETY"
    TECHNICAL = "TECHNICAL"
    OTHER = "OTHER"


class Ticket(TenantDocument):
    ticket_no: str
    school_name: str | None = None  # so the platform-wide list shows which school it came from
    raised_by_user_id: str
    raised_by_name: str
    raised_by_role: str  # STUDENT or PARENT
    student_id: str | None = None  # the student it is about (the student themself, or the parent's child)
    student_name: str | None = None
    teacher_id: str | None = None  # optional: a teacher the ticket is about
    category: TicketCategory = TicketCategory.OTHER
    subject: str
    description: str
    rating: int | None = None  # satisfaction with the service, 1 (very unhappy) to 5
    priority: str = "NORMAL"  # NORMAL, HIGH (low rating or safety), URGENT (set by staff)
    status: TicketStatus = TicketStatus.OPEN
    last_activity_at: datetime = Field(default_factory=utcnow)
    resolved_at: datetime | None = None

    class Settings:
        name = "tickets"
        indexes = ["school_id", "raised_by_user_id", "status", "category", "teacher_id", "last_activity_at"]


class TicketReply(TenantDocument):
    ticket_id: str
    author_user_id: str
    author_name: str
    author_role: str
    message: str

    class Settings:
        name = "ticket_replies"
        indexes = ["school_id", "ticket_id"]
