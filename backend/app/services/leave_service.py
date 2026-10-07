"""Leave management service."""
from datetime import date
from typing import Any

from app.core.audit import record_audit
from app.core.deps import CurrentUser
from app.core.enums import Role
from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationAppError
from app.models.leave import LeaveRequest, LeaveStatus, LeaveType
from app.models.student import Student
from app.models.teacher import Teacher
from app.schemas.common import PageParams, PageResponse

ADMIN_ROLES = (Role.SCHOOL_ADMIN, Role.PRINCIPAL)


def to_out(leave: LeaveRequest) -> dict[str, Any]:
    return {
        "id": str(leave.id),
        "school_id": leave.school_id,
        "requester_type": leave.requester_type,
        "requester_id": leave.requester_id,
        "requester_name": leave.requester_name,
        "leave_type": leave.leave_type,
        "start_date": leave.start_date.isoformat(),
        "end_date": leave.end_date.isoformat(),
        "reason": leave.reason,
        "status": leave.status,
        "reviewed_by": leave.reviewed_by,
        "reviewed_at": leave.reviewed_at.isoformat() if leave.reviewed_at else None,
        "review_notes": leave.review_notes,
        "document_ids": leave.document_ids,
        "created_at": leave.created_at.isoformat() if leave.created_at else None,
        "updated_at": leave.updated_at.isoformat() if leave.updated_at else None,
    }


async def create_leave_request(
    current: CurrentUser,
    leave_type: str,
    start_date: date,
    end_date: date,
    reason: str,
    document_ids: list[str] | None = None,
) -> dict[str, Any]:
    """Create a leave request for the current user."""
    if start_date > end_date:
        raise ValidationAppError("Start date cannot be after end date")

    # Determine requester type and details
    if current.role == Role.TEACHER:
        if not current.user.teacher_id:
            raise ValidationAppError("Teacher profile not found")
        teacher = await Teacher.get(current.user.teacher_id)
        if not teacher:
            raise ValidationAppError("Teacher profile not found")
        requester_type = "teacher"
        requester_id = current.user.teacher_id
        requester_name = teacher.full_name
    elif current.role == Role.STUDENT:
        if not current.user.student_id:
            raise ValidationAppError("Student profile not found")
        student = await Student.get(current.user.student_id)
        if not student:
            raise ValidationAppError("Student profile not found")
        requester_type = "student"
        requester_id = current.user.student_id
        requester_name = student.full_name
    else:
        raise PermissionDeniedError("Only teachers and students can request leave")

    leave = LeaveRequest(
        school_id=current.school_id,
        requester_type=requester_type,
        requester_id=requester_id,
        requester_name=requester_name,
        leave_type=LeaveType(leave_type),
        start_date=start_date,
        end_date=end_date,
        reason=reason,
        document_ids=document_ids or [],
    )
    await leave.insert()

    await record_audit(
        school_id=current.school_id,
        actor_user_id=str(current.user.id),
        action="leave.requested",
        entity_type="LeaveRequest",
        entity_id=str(leave.id),
    )

    return to_out(leave)


async def list_leave_requests(
    current: CurrentUser,
    status: str | None = None,
    requester_type: str | None = None,
    params: PageParams | None = None,
) -> PageResponse[dict[str, Any]]:
    """List leave requests based on user role."""
    params = params or PageParams()

    query = LeaveRequest.find(LeaveRequest.school_id == current.school_id)

    # Filter by role
    if current.role == Role.TEACHER and current.user.teacher_id:
        query = query.find(LeaveRequest.requester_id == current.user.teacher_id)
    elif current.role == Role.STUDENT and current.user.student_id:
        query = query.find(LeaveRequest.requester_id == current.user.student_id)
    elif current.role not in ADMIN_ROLES:
        raise PermissionDeniedError()

    # Filters
    if status:
        query = query.find(LeaveRequest.status == status)
    if requester_type:
        query = query.find(LeaveRequest.requester_type == requester_type)

    total = await query.count()
    leaves = await query.sort(-LeaveRequest.created_at).skip(params.skip).limit(params.page_size).to_list()

    return PageResponse(
        items=[to_out(l) for l in leaves],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


async def review_leave_request(
    current: CurrentUser,
    leave_id: str,
    action: str,  # "approve" or "reject"
    notes: str | None = None,
) -> dict[str, Any]:
    """Approve or reject a leave request (admin only)."""
    if current.role not in ADMIN_ROLES:
        raise PermissionDeniedError()

    leave = await LeaveRequest.get(leave_id)
    if not leave or leave.school_id != current.school_id:
        raise NotFoundError("Leave request not found")

    if leave.status != LeaveStatus.PENDING:
        raise ValidationAppError(f"Cannot review a leave request that is already {leave.status}")

    leave.status = LeaveStatus.APPROVED if action == "approve" else LeaveStatus.REJECTED
    leave.reviewed_by = str(current.user.id)
    leave.reviewed_at = date.today()
    leave.review_notes = notes
    await leave.save()

    await record_audit(
        school_id=current.school_id,
        actor_user_id=str(current.user.id),
        action=f"leave.{action}d",
        entity_type="LeaveRequest",
        entity_id=str(leave.id),
    )

    return to_out(leave)


async def cancel_leave_request(
    current: CurrentUser,
    leave_id: str,
) -> dict[str, Any]:
    """Cancel own pending leave request."""
    leave = await LeaveRequest.get(leave_id)
    if not leave or leave.school_id != current.school_id:
        raise NotFoundError("Leave request not found")

    # Check ownership
    if current.role == Role.TEACHER:
        if leave.requester_id != current.user.teacher_id:
            raise PermissionDeniedError()
    elif current.role == Role.STUDENT:
        if leave.requester_id != current.user.student_id:
            raise PermissionDeniedError()
    elif current.role not in ADMIN_ROLES:
        raise PermissionDeniedError()

    if leave.status != LeaveStatus.PENDING:
        raise ValidationAppError("Can only cancel pending leave requests")

    leave.status = LeaveStatus.CANCELLED
    await leave.save()

    return to_out(leave)


async def get_leave_summary(
    current: CurrentUser,
    requester_id: str | None = None,
) -> dict[str, int]:
    """Get leave summary (count by status)."""
    if current.role not in ADMIN_ROLES and not requester_id:
        if current.role == Role.TEACHER:
            requester_id = current.user.teacher_id
        elif current.role == Role.STUDENT:
            requester_id = current.user.student_id

    query = LeaveRequest.find(LeaveRequest.school_id == current.school_id)
    if requester_id:
        query = query.find(LeaveRequest.requester_id == requester_id)

    leaves = await query.to_list()

    summary = {
        "pending": 0,
        "approved": 0,
        "rejected": 0,
        "cancelled": 0,
        "total": len(leaves),
    }

    for leave in leaves:
        summary[leave.status.lower()] += 1

    return summary
