from datetime import date

from fastapi import APIRouter, Depends

from app.core.deps import CurrentUser, require_tenant_user
from app.schemas.attendance import (
    StaffAttendanceBulkMarkRequest,
    StaffAttendanceOut,
    StaffAttendanceSummaryItem,
    StudentAttendanceBulkMarkRequest,
    StudentAttendanceOut,
    StudentAttendanceSummaryItem,
)
from app.schemas.common import PageParams, PageResponse
from app.services import attendance_service

router = APIRouter(prefix="/attendance", tags=["attendance"])


# ---------------------------------------------------------------------------
# Student attendance
# ---------------------------------------------------------------------------


@router.post("/students", response_model=list[StudentAttendanceOut])
async def mark_student_attendance(
    payload: StudentAttendanceBulkMarkRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> list[StudentAttendanceOut]:
    return await attendance_service.mark_student_attendance(current, payload)


@router.get("/students", response_model=PageResponse[StudentAttendanceOut])
async def list_student_attendance(
    section_id: str | None = None,
    student_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    params: PageParams = Depends(),
    current: CurrentUser = Depends(require_tenant_user),
) -> PageResponse[StudentAttendanceOut]:
    return await attendance_service.list_student_attendance(
        current, section_id, student_id, date_from, date_to, params
    )


@router.get("/students/summary", response_model=list[StudentAttendanceSummaryItem])
async def student_attendance_summary(
    date_from: date,
    date_to: date,
    section_id: str | None = None,
    student_id: str | None = None,
    current: CurrentUser = Depends(require_tenant_user),
) -> list[StudentAttendanceSummaryItem]:
    return await attendance_service.student_attendance_summary(
        current, section_id, student_id, date_from, date_to
    )


# ---------------------------------------------------------------------------
# Staff attendance
# ---------------------------------------------------------------------------


@router.post("/staff", response_model=list[StaffAttendanceOut])
async def mark_staff_attendance(
    payload: StaffAttendanceBulkMarkRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> list[StaffAttendanceOut]:
    return await attendance_service.mark_staff_attendance(current, payload)


@router.get("/staff", response_model=PageResponse[StaffAttendanceOut])
async def list_staff_attendance(
    teacher_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    params: PageParams = Depends(),
    current: CurrentUser = Depends(require_tenant_user),
) -> PageResponse[StaffAttendanceOut]:
    return await attendance_service.list_staff_attendance(current, teacher_id, date_from, date_to, params)


@router.get("/staff/summary", response_model=list[StaffAttendanceSummaryItem])
async def staff_attendance_summary(
    date_from: date,
    date_to: date,
    teacher_id: str | None = None,
    current: CurrentUser = Depends(require_tenant_user),
) -> list[StaffAttendanceSummaryItem]:
    return await attendance_service.staff_attendance_summary(current, teacher_id, date_from, date_to)
