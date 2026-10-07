"""Leave request model for students and staff."""
from datetime import date
from enum import Enum

from pydantic import Field

from app.models.base import TenantDocument


class LeaveType(str, Enum):
    SICK = "SICK"
    CASUAL = "CASUAL"
    EMERGENCY = "EMERGENCY"
    VACATION = "VACATION"
    MATERNITY = "MATERNITY"
    PATERNITY = "PATERNITY"
    OTHER = "OTHER"


class LeaveStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class LeaveRequest(TenantDocument):
    """Leave request for students or staff."""

    # Who is requesting
    requester_type: str  # "student" or "teacher"
    requester_id: str  # student_id or teacher_id
    requester_name: str

    # Leave details
    leave_type: LeaveType
    start_date: date
    end_date: date
    reason: str

    # Status
    status: LeaveStatus = LeaveStatus.PENDING

    # Approval
    reviewed_by: str | None = None
    reviewed_at: date | None = None
    review_notes: str | None = None

    # Supporting documents
    document_ids: list[str] = Field(default_factory=list)

    class Settings:
        name = "leave_requests"
        indexes = ["school_id", "requester_type", "requester_id", "status", "start_date"]
