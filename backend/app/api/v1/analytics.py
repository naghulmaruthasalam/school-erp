from typing import Any

from fastapi import APIRouter, Depends

from app.core.deps import CurrentUser, require_roles
from app.core.enums import Role
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/attendance-trend")
async def get_attendance_trend(
    days: int = 14,
    current: CurrentUser = Depends(require_roles(Role.SCHOOL_ADMIN, Role.PRINCIPAL)),
) -> list[dict[str, Any]]:
    return await analytics_service.attendance_trend(current, days)


@router.get("/fee-collection")
async def get_fee_collection(
    months: int = 6,
    current: CurrentUser = Depends(require_roles(Role.SCHOOL_ADMIN, Role.PRINCIPAL)),
) -> list[dict[str, Any]]:
    return await analytics_service.fee_collection_monthly(current, months)


@router.get("/student-distribution")
async def get_student_distribution(
    current: CurrentUser = Depends(require_roles(Role.SCHOOL_ADMIN, Role.PRINCIPAL)),
) -> list[dict[str, Any]]:
    return await analytics_service.student_distribution_by_class(current)


@router.get("/attendance-daily")
async def get_attendance_daily(
    days: int = 7,
    current: CurrentUser = Depends(require_roles(Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.TEACHER)),
) -> list[dict[str, Any]]:
    return await analytics_service.attendance_present_absent_trend(current, days)


@router.get("/pending-fees")
async def get_pending_fees(
    current: CurrentUser = Depends(require_roles(Role.SCHOOL_ADMIN, Role.PRINCIPAL)),
) -> dict[str, Any]:
    return await analytics_service.pending_fees_summary(current)


@router.get("/teacher-workload")
async def get_teacher_workload(
    current: CurrentUser = Depends(require_roles(Role.SCHOOL_ADMIN, Role.PRINCIPAL)),
) -> list[dict[str, Any]]:
    return await analytics_service.teacher_workload(current)


@router.get("/admission-stats")
async def get_admission_stats(
    current: CurrentUser = Depends(require_roles(Role.SCHOOL_ADMIN, Role.PRINCIPAL)),
) -> dict[str, Any]:
    return await analytics_service.admission_stats(current)


@router.get("/leave-stats")
async def get_leave_stats(
    current: CurrentUser = Depends(require_roles(Role.SCHOOL_ADMIN, Role.PRINCIPAL)),
) -> dict[str, Any]:
    return await analytics_service.leave_stats(current)
