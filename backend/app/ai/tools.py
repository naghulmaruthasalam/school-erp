"""Per-role function-calling tools for the AI assistants.

Every tool function has the signature `(current: CurrentUser, args: dict) ->
Any` and does nothing but call an existing, already permission-checked
service function — the exact same one the REST API uses. This file adds NO
new authorization logic; it only decides which already-authorized
capabilities each role's assistant is allowed to invoke. If a service
function itself enforces "only your own records" (e.g. parent/child
ownership), that guarantee carries through unchanged when called from here.

`propose_sensitive_action` is the one exception: it never touches data. It
only records a proposal for a human to see and confirm elsewhere in the
product — it cannot execute anything by itself.
"""

from datetime import date, timedelta
from typing import Any

from pydantic import BaseModel
from google.generativeai.types import FunctionDeclaration

from app.core.audit import record_audit
from app.core.deps import CurrentUser
from app.core.enums import AdmissionStatus, AttendanceStatus, Role
from app.core.exceptions import PermissionDeniedError
from app.schemas.common import PageParams
from app.services import (
    academic_service,
    admission_service,
    attendance_service,
    exam_service,
    fee_service,
    guardian_service,
    homework_service,
    student_service,
    teacher_service,
)


def _dump(obj: Any) -> Any:
    if obj is None:
        return None
    if isinstance(obj, list):
        return [_dump(o) for o in obj]
    if isinstance(obj, BaseModel):
        return obj.model_dump(mode="json")
    return obj


def _parse_date(value: str | None, default: date | None = None) -> date | None:
    if not value:
        return default
    return date.fromisoformat(value)


def _default_range(args: dict, days: int = 30) -> tuple[date, date]:
    today = date.today()
    date_from = _parse_date(args.get("date_from"), today - timedelta(days=days))
    date_to = _parse_date(args.get("date_to"), today)
    return date_from, date_to


# ---------------------------------------------------------------------------
# Student tools
# ---------------------------------------------------------------------------


async def _tool_get_my_profile(current: CurrentUser, args: dict) -> Any:
    student = await student_service.get_own_profile(current)
    return _dump(student_service.to_out(student))


async def _tool_get_my_attendance(current: CurrentUser, args: dict) -> Any:
    date_from, date_to = _default_range(args)
    summary = await attendance_service.student_attendance_summary(current, None, None, date_from, date_to)
    return _dump(summary)


async def _tool_get_my_pending_homework(current: CurrentUser, args: dict) -> Any:
    return _dump(await homework_service.pending_homework(current))


async def _tool_get_my_timetable(current: CurrentUser, args: dict) -> Any:
    student = await student_service.get_own_profile(current)
    slots = await academic_service.list_timetable_slots(current.school_id, section_id=student.section_id)
    return _dump([academic_service.to_timetable_slot_out(s) for s in slots])


async def _tool_list_exams(current: CurrentUser, args: dict) -> Any:
    result = await exam_service.list_exams(current.school_id, args.get("academic_year_id"), PageParams(page=1, page_size=20))
    return _dump(result)


async def _tool_get_my_exam_result(current: CurrentUser, args: dict) -> Any:
    student = await student_service.get_own_profile(current)
    result = await exam_service.get_student_result(args["exam_id"], str(student.id), current)
    return _dump(result)


async def _tool_list_upcoming_events(current: CurrentUser, args: dict) -> Any:
    today = date.today()
    days_ahead = int(args.get("days_ahead", 30))
    events = await academic_service.list_calendar_events(
        current.school_id, None, start_date=today, end_date=today + timedelta(days=days_ahead)
    )
    return _dump([academic_service.to_calendar_event_out(e) for e in events])


STUDENT_TOOLS: list[FunctionDeclaration] = [
    FunctionDeclaration(name="get_my_profile", description="Get the student's own profile (class, section, roll number).", parameters={"type": "object", "properties": {}}),
    FunctionDeclaration(
        name="get_my_attendance",
        description="Get the student's own attendance summary for a date range (defaults to the last 30 days).",
        parameters={
            "type": "object",
            "properties": {
                "date_from": {"type": "string", "description": "YYYY-MM-DD, optional"},
                "date_to": {"type": "string", "description": "YYYY-MM-DD, optional"},
            },
        },
    ),
    FunctionDeclaration(name="get_my_pending_homework", description="List the student's pending/upcoming homework.", parameters={"type": "object", "properties": {}}),
    FunctionDeclaration(name="get_my_timetable", description="Get the student's weekly class timetable.", parameters={"type": "object", "properties": {}}),
    FunctionDeclaration(
        name="list_exams",
        description="List exams for the school, optionally filtered by academic year, to find upcoming/past exams.",
        parameters={"type": "object", "properties": {"academic_year_id": {"type": "string"}}},
    ),
    FunctionDeclaration(
        name="get_my_exam_result",
        description="Get the student's own result for a specific exam (marks per subject, grade, percentage).",
        parameters={"type": "object", "properties": {"exam_id": {"type": "string"}}, "required": ["exam_id"]},
    ),
    FunctionDeclaration(
        name="list_upcoming_events",
        description="List upcoming school calendar events (holidays, exams, events) in the next N days (default 30).",
        parameters={"type": "object", "properties": {"days_ahead": {"type": "integer"}}},
    ),
]

STUDENT_DISPATCH = {
    "get_my_profile": _tool_get_my_profile,
    "get_my_attendance": _tool_get_my_attendance,
    "get_my_pending_homework": _tool_get_my_pending_homework,
    "get_my_timetable": _tool_get_my_timetable,
    "list_exams": _tool_list_exams,
    "get_my_exam_result": _tool_get_my_exam_result,
    "list_upcoming_events": _tool_list_upcoming_events,
}


# ---------------------------------------------------------------------------
# Parent tools
# ---------------------------------------------------------------------------


async def _tool_list_my_children(current: CurrentUser, args: dict) -> Any:
    children = await student_service.get_my_children(current)
    return _dump([student_service.to_out(c) for c in children])


async def _tool_get_child_attendance(current: CurrentUser, args: dict) -> Any:
    date_from, date_to = _default_range(args)
    summary = await attendance_service.student_attendance_summary(current, None, args["student_id"], date_from, date_to)
    return _dump(summary)


async def _tool_get_child_pending_homework(current: CurrentUser, args: dict) -> Any:
    all_pending = await homework_service.pending_homework(current)
    student_id = args.get("student_id")
    if student_id:
        all_pending = [h for h in all_pending if h.student_id == student_id]
    return _dump(all_pending)


async def _tool_get_child_fees(current: CurrentUser, args: dict) -> Any:
    result = await fee_service.list_invoices(current, args["student_id"], None, None, PageParams(page=1, page_size=20))
    return _dump(result)


async def _tool_get_child_exam_result(current: CurrentUser, args: dict) -> Any:
    result = await exam_service.get_student_result(args["exam_id"], args["student_id"], current)
    return _dump(result)


PARENT_TOOLS: list[FunctionDeclaration] = [
    FunctionDeclaration(name="list_my_children", description="List all children linked to this parent/guardian account.", parameters={"type": "object", "properties": {}}),
    FunctionDeclaration(
        name="get_child_attendance",
        description="Get a specific child's attendance summary for a date range (defaults to last 30 days). Requires the child's student_id from list_my_children.",
        parameters={
            "type": "object",
            "properties": {
                "student_id": {"type": "string"},
                "date_from": {"type": "string"},
                "date_to": {"type": "string"},
            },
            "required": ["student_id"],
        },
    ),
    FunctionDeclaration(
        name="get_child_pending_homework",
        description="List pending homework for one child (student_id) or all children if student_id is omitted.",
        parameters={"type": "object", "properties": {"student_id": {"type": "string"}}},
    ),
    FunctionDeclaration(
        name="get_child_fees",
        description="List fee invoices (with amounts, due dates, status) for a specific child.",
        parameters={"type": "object", "properties": {"student_id": {"type": "string"}}, "required": ["student_id"]},
    ),
    FunctionDeclaration(
        name="get_child_exam_result",
        description="Get a specific child's result for a specific exam.",
        parameters={
            "type": "object",
            "properties": {"student_id": {"type": "string"}, "exam_id": {"type": "string"}},
            "required": ["student_id", "exam_id"],
        },
    ),
    FunctionDeclaration(
        name="list_upcoming_events",
        description="List upcoming school calendar events (holidays, exams, events) in the next N days (default 30).",
        parameters={"type": "object", "properties": {"days_ahead": {"type": "integer"}}},
    ),
]

PARENT_DISPATCH = {
    "list_my_children": _tool_list_my_children,
    "get_child_attendance": _tool_get_child_attendance,
    "get_child_pending_homework": _tool_get_child_pending_homework,
    "get_child_fees": _tool_get_child_fees,
    "get_child_exam_result": _tool_get_child_exam_result,
    "list_upcoming_events": _tool_list_upcoming_events,
}


# ---------------------------------------------------------------------------
# Teacher tools
# ---------------------------------------------------------------------------


async def _tool_get_my_classes(current: CurrentUser, args: dict) -> Any:
    if not current.user.teacher_id:
        raise PermissionDeniedError("No teacher profile linked to this account")
    slots = await academic_service.list_timetable_slots(current.school_id, teacher_id=current.user.teacher_id)
    return _dump([academic_service.to_timetable_slot_out(s) for s in slots])


async def _tool_get_today_classes(current: CurrentUser, args: dict) -> Any:
    if not current.user.teacher_id:
        raise PermissionDeniedError("No teacher profile linked to this account")
    slots = await academic_service.list_timetable_slots(current.school_id, teacher_id=current.user.teacher_id)
    today_dow = date.today().weekday()  # 0=Monday, matches TimetableSlot.day_of_week
    todays = [s for s in slots if s.day_of_week == today_dow]
    return _dump([academic_service.to_timetable_slot_out(s) for s in todays])


async def _tool_get_absent_students(current: CurrentUser, args: dict) -> Any:
    target_date = _parse_date(args.get("date"), date.today())
    result = await attendance_service.list_student_attendance(
        current, args["section_id"], None, target_date, target_date, PageParams(page=1, page_size=200)
    )
    absent = [r for r in result.items if r.status == AttendanceStatus.ABSENT]
    return _dump(absent)


async def _tool_get_homework_submissions(current: CurrentUser, args: dict) -> Any:
    submissions = await homework_service.list_submissions(current, args["homework_id"])
    return _dump(submissions)


TEACHER_TOOLS: list[FunctionDeclaration] = [
    FunctionDeclaration(name="get_my_classes", description="List all of this teacher's timetabled classes for the week.", parameters={"type": "object", "properties": {}}),
    FunctionDeclaration(name="get_today_classes", description="List this teacher's classes scheduled for today.", parameters={"type": "object", "properties": {}}),
    FunctionDeclaration(
        name="get_absent_students",
        description="List students marked absent in a section on a given date (defaults to today).",
        parameters={
            "type": "object",
            "properties": {"section_id": {"type": "string"}, "date": {"type": "string"}},
            "required": ["section_id"],
        },
    ),
    FunctionDeclaration(
        name="get_homework_submissions",
        description="Get submission status for every student on a specific homework item.",
        parameters={"type": "object", "properties": {"homework_id": {"type": "string"}}, "required": ["homework_id"]},
    ),
]

TEACHER_DISPATCH = {
    "get_my_classes": _tool_get_my_classes,
    "get_today_classes": _tool_get_today_classes,
    "get_absent_students": _tool_get_absent_students,
    "get_homework_submissions": _tool_get_homework_submissions,
}


# ---------------------------------------------------------------------------
# Principal tools
# ---------------------------------------------------------------------------


async def _tool_get_school_daily_summary(current: CurrentUser, args: dict) -> Any:
    target_date = _parse_date(args.get("date"), date.today())

    from app.models.student import Student
    from app.models.teacher import Teacher
    from app.core.enums import StudentStatus, TeacherStatus

    total_students = await Student.find(Student.school_id == current.school_id, Student.status == StudentStatus.ACTIVE).count()
    total_teachers = await Teacher.find(Teacher.school_id == current.school_id, Teacher.status == TeacherStatus.ACTIVE).count()

    attendance_today = await attendance_service.list_student_attendance(
        current, None, None, target_date, target_date, PageParams(page=1, page_size=1)
    )
    staff_attendance_today = await attendance_service.list_staff_attendance(
        current, None, target_date, target_date, PageParams(page=1, page_size=1)
    )
    pending_admissions = await admission_service.list_admissions(current, AdmissionStatus.SUBMITTED, PageParams(page=1, page_size=1))
    upcoming_exams = await exam_service.list_exams(current.school_id, None, PageParams(page=1, page_size=5))

    return {
        "date": target_date.isoformat(),
        "active_students": total_students,
        "active_teachers": total_teachers,
        "student_attendance_records_marked_today": attendance_today.total,
        "staff_attendance_records_marked_today": staff_attendance_today.total,
        "pending_admission_approvals": pending_admissions.total,
        "upcoming_exams": _dump(upcoming_exams.items),
    }


async def _tool_get_attendance_trend(current: CurrentUser, args: dict) -> Any:
    date_from, date_to = _default_range(args, days=14)
    section_id = args.get("section_id")
    summary = await attendance_service.student_attendance_summary(current, section_id, None, date_from, date_to)
    if not summary:
        return {"date_from": date_from.isoformat(), "date_to": date_to.isoformat(), "students": []}
    overall_pct = sum(s.percentage_present for s in summary) / len(summary)
    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "school_wide_average_attendance_percentage": round(overall_pct, 2),
        "students": _dump(summary),
    }


async def _tool_get_staff_attendance_today(current: CurrentUser, args: dict) -> Any:
    today = date.today()
    result = await attendance_service.list_staff_attendance(current, None, today, today, PageParams(page=1, page_size=200))
    return _dump(result)


async def _tool_get_pending_admission_approvals(current: CurrentUser, args: dict) -> Any:
    result = await admission_service.list_admissions(current, AdmissionStatus.SUBMITTED, PageParams(page=1, page_size=50))
    return _dump(result)


async def _tool_get_fee_collection_summary(current: CurrentUser, args: dict) -> Any:
    date_from, date_to = _default_range(args, days=30)

    from datetime import datetime, time, timezone

    from app.core.enums import PaymentStatus
    from app.models.fee import Payment

    # Payment.paid_at is a datetime field — BSON can't encode a bare `date`,
    # so widen to the full day range in UTC.
    dt_from = datetime.combine(date_from, time.min, tzinfo=timezone.utc)
    dt_to = datetime.combine(date_to, time.max, tzinfo=timezone.utc)

    payments = await Payment.find(
        Payment.school_id == current.school_id,
        Payment.status == PaymentStatus.SUCCESS,
        Payment.paid_at >= dt_from,
        Payment.paid_at <= dt_to,
    ).to_list()
    total = sum(p.amount for p in payments)
    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "total_collected": total,
        "payment_count": len(payments),
    }


PRINCIPAL_TOOLS: list[FunctionDeclaration] = [
    FunctionDeclaration(
        name="get_school_daily_summary",
        description="Get today's (or a given date's) school-wide operational summary: active students/teachers, attendance marked, pending admissions, upcoming exams.",
        parameters={"type": "object", "properties": {"date": {"type": "string"}}},
    ),
    FunctionDeclaration(
        name="get_attendance_trend",
        description="Get school-wide (or one section's) student attendance trend over a date range (defaults to last 14 days).",
        parameters={
            "type": "object",
            "properties": {"section_id": {"type": "string"}, "date_from": {"type": "string"}, "date_to": {"type": "string"}},
        },
    ),
    FunctionDeclaration(name="get_staff_attendance_today", description="Get today's staff (teacher) attendance records.", parameters={"type": "object", "properties": {}}),
    FunctionDeclaration(name="get_pending_admission_approvals", description="List admissions awaiting review/approval.", parameters={"type": "object", "properties": {}}),
    FunctionDeclaration(
        name="get_fee_collection_summary",
        description="Get total fee amount collected (successful payments) over a date range (defaults to last 30 days).",
        parameters={"type": "object", "properties": {"date_from": {"type": "string"}, "date_to": {"type": "string"}}},
    ),
]

PRINCIPAL_DISPATCH = {
    "get_school_daily_summary": _tool_get_school_daily_summary,
    "get_attendance_trend": _tool_get_attendance_trend,
    "get_staff_attendance_today": _tool_get_staff_attendance_today,
    "get_pending_admission_approvals": _tool_get_pending_admission_approvals,
    "get_fee_collection_summary": _tool_get_fee_collection_summary,
}


# ---------------------------------------------------------------------------
# Admin tools
# ---------------------------------------------------------------------------


async def _tool_student_lookup(current: CurrentUser, args: dict) -> Any:
    result = await student_service.list_students(
        current, args.get("class_id"), args.get("section_id"), None, args.get("name"), PageParams(page=1, page_size=10)
    )
    return _dump(result)


async def _tool_parent_lookup(current: CurrentUser, args: dict) -> Any:
    result = await guardian_service.list_guardians(current, args.get("phone"), args.get("name"), PageParams(page=1, page_size=10))
    return _dump(result)


async def _tool_teacher_lookup(current: CurrentUser, args: dict) -> Any:
    result = await teacher_service.list_teachers(current.school_id, PageParams(page=1, page_size=10), name=args.get("name"))
    return _dump(result)


async def _tool_admission_search(current: CurrentUser, args: dict) -> Any:
    status = AdmissionStatus(args["status"]) if args.get("status") else None
    result = await admission_service.list_admissions(current, status, PageParams(page=1, page_size=10))
    return _dump(result)


async def _tool_fee_lookup(current: CurrentUser, args: dict) -> Any:
    result = await fee_service.list_invoices(current, args["student_id"], None, None, PageParams(page=1, page_size=20))
    return _dump(result)


async def _tool_propose_sensitive_action(current: CurrentUser, args: dict) -> Any:
    """Records a proposal only. This NEVER executes anything — it exists so
    the assistant can surface 'here's what I would do, confirm to proceed'
    without ever being the thing that actually does it. Real execution goes
    through the normal authenticated REST endpoints, triggered by the human's
    explicit confirmation in the UI, not by this tool."""
    await record_audit(
        school_id=current.school_id,
        actor_user_id=current.id,
        action=f"ai.proposed.{args.get('action_type', 'unknown')}",
        entity_type=args.get("target_entity_type"),
        entity_id=args.get("target_entity_id"),
        details={"description": args.get("description")},
    )
    return {
        "status": "proposal_recorded",
        "requires_human_confirmation": True,
        "note": "This action has NOT been executed. It must be confirmed and carried out through the normal admin UI/workflow.",
    }


ADMIN_TOOLS: list[FunctionDeclaration] = [
    FunctionDeclaration(
        name="student_lookup",
        description="Search/look up students by name, class, or section.",
        parameters={
            "type": "object",
            "properties": {"name": {"type": "string"}, "class_id": {"type": "string"}, "section_id": {"type": "string"}},
        },
    ),
    FunctionDeclaration(
        name="parent_lookup",
        description="Search/look up parents/guardians by name or phone.",
        parameters={"type": "object", "properties": {"name": {"type": "string"}, "phone": {"type": "string"}}},
    ),
    FunctionDeclaration(
        name="teacher_lookup",
        description="Search/look up teachers by name.",
        parameters={"type": "object", "properties": {"name": {"type": "string"}}},
    ),
    FunctionDeclaration(
        name="admission_search",
        description="Search admissions, optionally filtered by status (SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, CONVERTED).",
        parameters={"type": "object", "properties": {"status": {"type": "string"}}},
    ),
    FunctionDeclaration(
        name="fee_lookup",
        description="Look up fee invoices for a specific student.",
        parameters={"type": "object", "properties": {"student_id": {"type": "string"}}, "required": ["student_id"]},
    ),
    FunctionDeclaration(
        name="propose_sensitive_action",
        description=(
            "Use this for any sensitive/irreversible action a user asks for (refunds, deleting records, "
            "deactivating accounts, etc.) INSTEAD of pretending to do it. This only records a proposal for "
            "human confirmation — it never executes anything."
        ),
        parameters={
            "type": "object",
            "properties": {
                "action_type": {"type": "string", "description": "e.g. 'fee_refund', 'account_deactivation'"},
                "description": {"type": "string"},
                "target_entity_type": {"type": "string"},
                "target_entity_id": {"type": "string"},
            },
            "required": ["action_type", "description"],
        },
    ),
]

ADMIN_DISPATCH = {
    "student_lookup": _tool_student_lookup,
    "parent_lookup": _tool_parent_lookup,
    "teacher_lookup": _tool_teacher_lookup,
    "admission_search": _tool_admission_search,
    "fee_lookup": _tool_fee_lookup,
    "propose_sensitive_action": _tool_propose_sensitive_action,
}


def get_tools_for_role(role: Role) -> tuple[list[FunctionDeclaration], dict]:
    if role == Role.STUDENT:
        return STUDENT_TOOLS, STUDENT_DISPATCH
    if role == Role.PARENT:
        return PARENT_TOOLS, PARENT_DISPATCH
    if role == Role.TEACHER:
        return TEACHER_TOOLS, TEACHER_DISPATCH
    if role == Role.PRINCIPAL:
        return PRINCIPAL_TOOLS, PRINCIPAL_DISPATCH
    if role in (Role.SCHOOL_ADMIN, Role.SUPER_ADMIN):
        return ADMIN_TOOLS, ADMIN_DISPATCH
    return [], {}
