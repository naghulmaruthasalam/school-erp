"""Attendance service.

Percentage-present rule (documented once, applied consistently for both
student and staff summaries): PRESENT and LATE count as a full day present,
HALF_DAY counts as half a day present, ABSENT and EXCUSED count as not
present. ``percentage_present = (present + late + 0.5 * half_day) / total *
100``, rounded to 2 decimal places. ``total`` is the number of attendance
records found in range (i.e. days actually marked), not the calendar span.
"""

from datetime import date

from beanie.operators import In
from pymongo.errors import DuplicateKeyError

from app.core.deps import CurrentUser
from app.core.enums import AttendanceStatus, Role
from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.models.academic import Section
from app.models.attendance import StaffAttendance, StudentAttendance
from app.models.base import utcnow
from app.models.guardian import Guardian
from app.models.student import Student
from app.models.teacher import Teacher
from app.schemas.attendance import (
    StaffAttendanceBulkMarkRequest,
    StaffAttendanceOut,
    StaffAttendanceSummaryItem,
    StudentAttendanceBulkMarkRequest,
    StudentAttendanceOut,
    StudentAttendanceSummaryItem,
)
from app.schemas.common import PageParams, PageResponse

_MARK_STUDENT_ROLES = (Role.TEACHER, Role.SCHOOL_ADMIN, Role.PRINCIPAL)
_MARK_STAFF_ROLES = (Role.SCHOOL_ADMIN, Role.PRINCIPAL)


async def _verify_teacher_section_access(current: CurrentUser, section_id: str) -> None:
    """Ensure a teacher has access to the section's class. Admins/Principals have full access."""
    if current.role in (Role.SCHOOL_ADMIN, Role.PRINCIPAL):
        return
    if current.role == Role.TEACHER:
        if not current.user.teacher_id:
            raise PermissionDeniedError("No teacher profile linked to this account")
        teacher = await Teacher.get(current.user.teacher_id)
        if teacher is None:
            raise NotFoundError("Teacher profile not found")
        section = await Section.get(section_id)
        if section is None:
            raise NotFoundError(f"Section {section_id} not found")
        if section.class_id not in teacher.assigned_class_ids:
            raise PermissionDeniedError("You are not assigned to this class/grade")


def _compute_counts(records: list) -> tuple[int, dict[str, int], float]:
    counts = {s.value: 0 for s in AttendanceStatus}
    for r in records:
        counts[r.status.value] += 1
    total = len(records)
    effective_present = (
        counts[AttendanceStatus.PRESENT.value]
        + counts[AttendanceStatus.LATE.value]
        + 0.5 * counts[AttendanceStatus.HALF_DAY.value]
    )
    percentage = round(effective_present / total * 100, 2) if total else 0.0
    return total, counts, percentage


def to_student_attendance_out(doc: StudentAttendance) -> StudentAttendanceOut:
    return StudentAttendanceOut(
        id=str(doc.id),
        school_id=doc.school_id,
        section_id=doc.section_id,
        student_id=doc.student_id,
        date=doc.date,
        status=doc.status,
        marked_by=doc.marked_by,
        remarks=doc.remarks,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


def to_staff_attendance_out(doc: StaffAttendance) -> StaffAttendanceOut:
    return StaffAttendanceOut(
        id=str(doc.id),
        school_id=doc.school_id,
        teacher_id=doc.teacher_id,
        date=doc.date,
        status=doc.status,
        marked_by=doc.marked_by,
        remarks=doc.remarks,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


# ---------------------------------------------------------------------------
# Student attendance
# ---------------------------------------------------------------------------


async def mark_student_attendance(
    current: CurrentUser, payload: StudentAttendanceBulkMarkRequest
) -> list[StudentAttendanceOut]:
    if current.role not in _MARK_STUDENT_ROLES:
        raise PermissionDeniedError("Only teachers or school admins/principals can mark attendance")

    await _verify_teacher_section_access(current, payload.section_id)

    results: list[StudentAttendance] = []
    for item in payload.records:
        student = await Student.get(item.student_id)
        if student is None or student.school_id != current.school_id:
            raise NotFoundError(f"Student {item.student_id} not found")

        existing = await StudentAttendance.find_one(
            StudentAttendance.student_id == item.student_id,
            StudentAttendance.date == payload.date,
        )
        if existing is not None:
            existing.status = item.status
            existing.remarks = item.remarks
            existing.section_id = payload.section_id
            existing.marked_by = current.id
            existing.updated_at = utcnow()
            await existing.save()
            results.append(existing)
            continue

        doc = StudentAttendance(
            school_id=current.school_id,
            section_id=payload.section_id,
            student_id=item.student_id,
            date=payload.date,
            status=item.status,
            marked_by=current.id,
            remarks=item.remarks,
        )
        try:
            await doc.insert()
        except DuplicateKeyError:
            # Lost a race against a concurrent mark for the same (student, date) — update instead.
            existing = await StudentAttendance.find_one(
                StudentAttendance.student_id == item.student_id,
                StudentAttendance.date == payload.date,
            )
            if existing is None:
                raise
            existing.status = item.status
            existing.remarks = item.remarks
            existing.section_id = payload.section_id
            existing.marked_by = current.id
            existing.updated_at = utcnow()
            await existing.save()
            doc = existing
        results.append(doc)

    return [to_student_attendance_out(d) for d in results]


async def _parent_child_ids(current: CurrentUser) -> list[str]:
    if not current.user.guardian_id:
        raise PermissionDeniedError("No guardian profile linked to this account")
    guardian = await Guardian.get(current.user.guardian_id)
    if guardian is None:
        raise NotFoundError("Guardian profile not found")
    return guardian.student_ids


async def list_student_attendance(
    current: CurrentUser,
    section_id: str | None,
    student_id: str | None,
    date_from: date | None,
    date_to: date | None,
    params: PageParams,
) -> PageResponse[StudentAttendanceOut]:
    filters = [StudentAttendance.school_id == current.school_id]

    if current.role == Role.STUDENT:
        if not current.user.student_id:
            raise PermissionDeniedError("No student profile linked to this account")
        filters.append(StudentAttendance.student_id == current.user.student_id)
    elif current.role == Role.PARENT:
        child_ids = await _parent_child_ids(current)
        if student_id:
            if student_id not in child_ids:
                raise PermissionDeniedError("Not a linked child")
            filters.append(StudentAttendance.student_id == student_id)
        else:
            filters.append(In(StudentAttendance.student_id, child_ids))
    elif current.role in (Role.TEACHER, Role.SCHOOL_ADMIN, Role.PRINCIPAL):
        if student_id:
            filters.append(StudentAttendance.student_id == student_id)
    else:
        raise PermissionDeniedError("Not allowed to view student attendance")

    if section_id:
        filters.append(StudentAttendance.section_id == section_id)
    if date_from:
        filters.append(StudentAttendance.date >= date_from)
    if date_to:
        filters.append(StudentAttendance.date <= date_to)

    query = StudentAttendance.find(*filters)
    total = await query.count()
    records = (
        await StudentAttendance.find(*filters)
        .sort(-StudentAttendance.date)
        .skip(params.skip)
        .limit(params.page_size)
        .to_list()
    )
    return PageResponse(
        items=[to_student_attendance_out(r) for r in records],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


async def student_attendance_summary(
    current: CurrentUser,
    section_id: str | None,
    student_id: str | None,
    date_from: date,
    date_to: date,
) -> list[StudentAttendanceSummaryItem]:
    filters = [
        StudentAttendance.school_id == current.school_id,
        StudentAttendance.date >= date_from,
        StudentAttendance.date <= date_to,
    ]

    if current.role == Role.STUDENT:
        if not current.user.student_id:
            raise PermissionDeniedError("No student profile linked to this account")
        filters.append(StudentAttendance.student_id == current.user.student_id)
    elif current.role == Role.PARENT:
        child_ids = await _parent_child_ids(current)
        if student_id:
            if student_id not in child_ids:
                raise PermissionDeniedError("Not a linked child")
            filters.append(StudentAttendance.student_id == student_id)
        else:
            filters.append(In(StudentAttendance.student_id, child_ids))
    elif current.role in (Role.TEACHER, Role.SCHOOL_ADMIN, Role.PRINCIPAL):
        if student_id:
            filters.append(StudentAttendance.student_id == student_id)
        elif section_id:
            filters.append(StudentAttendance.section_id == section_id)
    else:
        raise PermissionDeniedError("Not allowed to view student attendance")

    records = await StudentAttendance.find(*filters).to_list()

    grouped: dict[str, list] = {}
    for r in records:
        grouped.setdefault(r.student_id, []).append(r)

    summaries = []
    for sid, recs in grouped.items():
        total, counts, pct = _compute_counts(recs)
        summaries.append(
            StudentAttendanceSummaryItem(
                student_id=sid, total_days=total, counts=counts, percentage_present=pct
            )
        )
    return sorted(summaries, key=lambda s: s.student_id)


# ---------------------------------------------------------------------------
# Staff attendance
# ---------------------------------------------------------------------------


async def mark_staff_attendance(
    current: CurrentUser, payload: StaffAttendanceBulkMarkRequest
) -> list[StaffAttendanceOut]:
    if current.role not in _MARK_STAFF_ROLES:
        raise PermissionDeniedError("Only school admins/principals can mark staff attendance")

    results: list[StaffAttendance] = []
    for item in payload.records:
        teacher = await Teacher.get(item.teacher_id)
        if teacher is None or teacher.school_id != current.school_id:
            raise NotFoundError(f"Teacher {item.teacher_id} not found")

        existing = await StaffAttendance.find_one(
            StaffAttendance.teacher_id == item.teacher_id,
            StaffAttendance.date == payload.date,
        )
        if existing is not None:
            existing.status = item.status
            existing.remarks = item.remarks
            existing.marked_by = current.id
            existing.updated_at = utcnow()
            await existing.save()
            results.append(existing)
            continue

        doc = StaffAttendance(
            school_id=current.school_id,
            teacher_id=item.teacher_id,
            date=payload.date,
            status=item.status,
            marked_by=current.id,
            remarks=item.remarks,
        )
        try:
            await doc.insert()
        except DuplicateKeyError:
            existing = await StaffAttendance.find_one(
                StaffAttendance.teacher_id == item.teacher_id,
                StaffAttendance.date == payload.date,
            )
            if existing is None:
                raise
            existing.status = item.status
            existing.remarks = item.remarks
            existing.marked_by = current.id
            existing.updated_at = utcnow()
            await existing.save()
            doc = existing
        results.append(doc)

    return [to_staff_attendance_out(d) for d in results]


async def list_staff_attendance(
    current: CurrentUser,
    teacher_id: str | None,
    date_from: date | None,
    date_to: date | None,
    params: PageParams,
) -> PageResponse[StaffAttendanceOut]:
    filters = [StaffAttendance.school_id == current.school_id]

    if current.role == Role.TEACHER:
        if not current.user.teacher_id:
            raise PermissionDeniedError("No teacher profile linked to this account")
        filters.append(StaffAttendance.teacher_id == current.user.teacher_id)
    elif current.role in (Role.SCHOOL_ADMIN, Role.PRINCIPAL):
        if teacher_id:
            filters.append(StaffAttendance.teacher_id == teacher_id)
    else:
        raise PermissionDeniedError("Not allowed to view staff attendance")

    if date_from:
        filters.append(StaffAttendance.date >= date_from)
    if date_to:
        filters.append(StaffAttendance.date <= date_to)

    total = await StaffAttendance.find(*filters).count()
    records = (
        await StaffAttendance.find(*filters)
        .sort(-StaffAttendance.date)
        .skip(params.skip)
        .limit(params.page_size)
        .to_list()
    )
    return PageResponse(
        items=[to_staff_attendance_out(r) for r in records],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


async def staff_attendance_summary(
    current: CurrentUser,
    teacher_id: str | None,
    date_from: date,
    date_to: date,
) -> list[StaffAttendanceSummaryItem]:
    filters = [
        StaffAttendance.school_id == current.school_id,
        StaffAttendance.date >= date_from,
        StaffAttendance.date <= date_to,
    ]

    if current.role == Role.TEACHER:
        if not current.user.teacher_id:
            raise PermissionDeniedError("No teacher profile linked to this account")
        filters.append(StaffAttendance.teacher_id == current.user.teacher_id)
    elif current.role in (Role.SCHOOL_ADMIN, Role.PRINCIPAL):
        if teacher_id:
            filters.append(StaffAttendance.teacher_id == teacher_id)
    else:
        raise PermissionDeniedError("Not allowed to view staff attendance")

    records = await StaffAttendance.find(*filters).to_list()

    grouped: dict[str, list] = {}
    for r in records:
        grouped.setdefault(r.teacher_id, []).append(r)

    summaries = []
    for tid, recs in grouped.items():
        total, counts, pct = _compute_counts(recs)
        summaries.append(
            StaffAttendanceSummaryItem(
                teacher_id=tid, total_days=total, counts=counts, percentage_present=pct
            )
        )
    return sorted(summaries, key=lambda s: s.teacher_id)
