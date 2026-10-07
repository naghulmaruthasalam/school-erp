"""Reports API endpoints."""
from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query

from app.core.deps import CurrentUser, get_current_user
from app.core.enums import Role
from app.models.attendance import StudentAttendance
from app.models.fee import Payment
from app.models.student import Student

router = APIRouter(prefix="/reports", tags=["Reports"])

ADMIN_ROLES = (Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL)


@router.get("/attendance-summary")
async def get_attendance_summary(
    section_id: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    current: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    """Get attendance summary for a date range."""
    if current.role not in ADMIN_ROLES:
        return {"error": "Permission denied"}

    date_from = date_from or date.today()
    date_to = date_to or date.today()

    query = StudentAttendance.find(
        StudentAttendance.school_id == current.school_id,
        StudentAttendance.date >= date_from,
        StudentAttendance.date <= date_to,
    )
    if section_id:
        query = query.find(StudentAttendance.section_id == section_id)

    records = await query.to_list()

    present = sum(1 for r in records if r.status == "PRESENT")
    absent = sum(1 for r in records if r.status == "ABSENT")
    late = sum(1 for r in records if r.status == "LATE")

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "total_records": len(records),
        "present": present,
        "absent": absent,
        "late": late,
        "attendance_rate": round((present / len(records)) * 100, 1) if records else 0,
    }


@router.get("/fee-summary")
async def get_fee_summary(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    current: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    """Get fee collection summary."""
    if current.role not in ADMIN_ROLES:
        return {"error": "Permission denied"}

    date_from = date_from or (date.today() - timedelta(days=30))
    date_to = date_to or date.today()

    payments = await Payment.find(
        Payment.school_id == current.school_id,
        Payment.payment_date >= date_from,
        Payment.payment_date <= date_to,
    ).to_list()

    total_collected = sum(p.amount for p in payments)

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "total_collected": total_collected,
        "payment_count": len(payments),
    }


@router.get("/student-enrollment")
async def get_student_enrollment(
    current: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    """Get student enrollment statistics."""
    if current.role not in ADMIN_ROLES:
        return {"error": "Permission denied"}

    total = await Student.find(Student.school_id == current.school_id).count()
    active = await Student.find(
        Student.school_id == current.school_id,
        Student.status == "ACTIVE",
    ).count()

    return {
        "total_enrolled": total,
        "active_students": active,
        "inactive_students": total - active,
    }
