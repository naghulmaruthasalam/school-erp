from datetime import date, timedelta
from typing import Any

from app.core.deps import CurrentUser
from app.core.enums import AttendanceStatus, PaymentStatus, StudentStatus
from app.models.attendance import StudentAttendance
from app.models.fee import Payment
from app.models.student import Student


async def attendance_trend(current: CurrentUser, days: int = 14) -> list[dict[str, Any]]:
    """Daily attendance percentage for the last N days."""
    end = date.today()
    start = end - timedelta(days=days - 1)
    result: list[dict[str, Any]] = []

    for i in range(days):
        day = start + timedelta(days=i)
        records = await StudentAttendance.find(
            StudentAttendance.school_id == current.school_id,
            StudentAttendance.date == day,
        ).to_list()
        if records:
            present = sum(1 for r in records if r.status == AttendanceStatus.PRESENT)
            pct = round((present / len(records)) * 100, 1)
        else:
            pct = 0
        result.append({"date": day.strftime("%b %d"), "percentage": pct})
    return result


async def fee_collection_monthly(current: CurrentUser, months: int = 6) -> list[dict[str, Any]]:
    """Monthly fee collection totals."""
    from datetime import datetime, timezone

    today = date.today()
    result: list[dict[str, Any]] = []

    for i in range(months - 1, -1, -1):
        month_start = (today.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        if month_start.month == 12:
            month_end = month_start.replace(year=month_start.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            month_end = month_start.replace(month=month_start.month + 1, day=1) - timedelta(days=1)

        dt_start = datetime.combine(month_start, datetime.min.time(), tzinfo=timezone.utc)
        dt_end = datetime.combine(month_end, datetime.max.time(), tzinfo=timezone.utc)

        payments = await Payment.find(
            Payment.school_id == current.school_id,
            Payment.status == PaymentStatus.SUCCESS,
            Payment.paid_at >= dt_start,
            Payment.paid_at <= dt_end,
        ).to_list()

        total = sum(p.amount for p in payments)
        result.append({"month": month_start.strftime("%b"), "amount": total})
    return result


async def student_distribution_by_class(current: CurrentUser) -> list[dict[str, Any]]:
    """Count of active students per class."""
    from app.models.academic import Class

    classes = await Class.find(Class.school_id == current.school_id).to_list()
    result: list[dict[str, Any]] = []

    for cls in classes:
        count = await Student.find(
            Student.school_id == current.school_id,
            Student.class_id == str(cls.id),
            Student.status == StudentStatus.ACTIVE,
        ).count()
        if count > 0:
            result.append({"name": cls.name, "value": count})
    return result


async def attendance_present_absent_trend(current: CurrentUser, days: int = 7) -> list[dict[str, Any]]:
    """Daily present vs absent counts."""
    end = date.today()
    start = end - timedelta(days=days - 1)
    result: list[dict[str, Any]] = []

    for i in range(days):
        day = start + timedelta(days=i)
        records = await StudentAttendance.find(
            StudentAttendance.school_id == current.school_id,
            StudentAttendance.date == day,
        ).to_list()
        present = sum(1 for r in records if r.status == AttendanceStatus.PRESENT)
        absent = sum(1 for r in records if r.status == AttendanceStatus.ABSENT)
        result.append({"date": day.strftime("%a"), "present": present, "absent": absent})
    return result


async def pending_fees_summary(current: CurrentUser) -> dict[str, Any]:
    """Summary of pending fees."""
    from app.models.fee import Invoice

    invoices = await Invoice.find(Invoice.school_id == current.school_id).to_list()

    total_due = sum(i.total_amount for i in invoices)
    total_paid = sum(i.amount_paid for i in invoices)
    total_pending = total_due - total_paid

    overdue_count = sum(1 for i in invoices if i.due_date and i.due_date < date.today() and i.amount_paid < i.total_amount)

    return {
        "total_due": total_due,
        "total_paid": total_paid,
        "total_pending": total_pending,
        "overdue_count": overdue_count,
        "total_invoices": len(invoices),
    }


async def teacher_workload(current: CurrentUser) -> list[dict[str, Any]]:
    """Teacher workload - classes and subjects assigned."""
    from app.models.teacher import Teacher
    from app.models.academic import ClassSubjectTeacher

    teachers = await Teacher.find(Teacher.school_id == current.school_id).to_list()
    result: list[dict[str, Any]] = []

    for teacher in teachers:
        assignments = await ClassSubjectTeacher.find(
            ClassSubjectTeacher.school_id == current.school_id,
            ClassSubjectTeacher.teacher_id == str(teacher.id),
        ).count()
        result.append({
            "name": teacher.full_name,
            "classes": assignments,
            "status": teacher.status,
        })

    return sorted(result, key=lambda x: x["classes"], reverse=True)


async def admission_stats(current: CurrentUser) -> dict[str, Any]:
    """Admission statistics."""
    from app.models.admission import Admission
    from app.core.enums import AdmissionStatus

    admissions = await Admission.find(Admission.school_id == current.school_id).to_list()

    stats = {
        "total": len(admissions),
        "submitted": sum(1 for a in admissions if a.status == AdmissionStatus.SUBMITTED),
        "under_review": sum(1 for a in admissions if a.status == AdmissionStatus.UNDER_REVIEW),
        "approved": sum(1 for a in admissions if a.status == AdmissionStatus.APPROVED),
        "rejected": sum(1 for a in admissions if a.status == AdmissionStatus.REJECTED),
        "converted": sum(1 for a in admissions if a.status == AdmissionStatus.CONVERTED),
    }

    return stats


async def leave_stats(current: CurrentUser) -> dict[str, Any]:
    """Leave request statistics."""
    from app.models.leave import LeaveRequest, LeaveStatus

    leaves = await LeaveRequest.find(LeaveRequest.school_id == current.school_id).to_list()

    stats = {
        "total": len(leaves),
        "pending": sum(1 for l in leaves if l.status == LeaveStatus.PENDING),
        "approved": sum(1 for l in leaves if l.status == LeaveStatus.APPROVED),
        "rejected": sum(1 for l in leaves if l.status == LeaveStatus.REJECTED),
        "by_type": {},
    }

    for leave in leaves:
        leave_type = leave.leave_type
        if leave_type not in stats["by_type"]:
            stats["by_type"][leave_type] = 0
        stats["by_type"][leave_type] += 1

    return stats
