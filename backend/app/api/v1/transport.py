"""Transport API endpoints."""
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.core.deps import CurrentUser, get_current_user
from app.schemas.common import PageParams, PageResponse
from app.services import transport_service

router = APIRouter(prefix="/transport", tags=["Transport"])


class VehicleCreate(BaseModel):
    vehicle_no: str
    vehicle_type: str
    capacity: int
    driver_name: str
    driver_phone: str
    driver_license: str | None = None
    helper_name: str | None = None
    helper_phone: str | None = None
    insurance_expiry: date | None = None
    fitness_expiry: date | None = None


class RouteCreate(BaseModel):
    route_name: str
    route_code: str
    vehicle_id: str | None = None
    stops: list[dict] | None = None


class StudentAssignment(BaseModel):
    student_id: str
    student_name: str
    student_class: str
    route_id: str
    stop_name: str
    academic_year_id: str
    monthly_fee: float = 0
    pickup_point: str | None = None
    drop_point: str | None = None


@router.post("/vehicles")
async def add_vehicle(
    payload: VehicleCreate,
    current: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return await transport_service.add_vehicle(current, **payload.model_dump())


@router.get("/vehicles")
async def list_vehicles(
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current: CurrentUser = Depends(get_current_user),
) -> PageResponse[dict[str, Any]]:
    return await transport_service.list_vehicles(
        current,
        status=status,
        params=PageParams(page=page, page_size=page_size),
    )


@router.post("/routes")
async def add_route(
    payload: RouteCreate,
    current: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return await transport_service.add_route(
        current,
        route_name=payload.route_name,
        route_code=payload.route_code,
        vehicle_id=payload.vehicle_id,
        stops=payload.stops,
    )


@router.get("/routes")
async def list_routes(
    active_only: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current: CurrentUser = Depends(get_current_user),
) -> PageResponse[dict[str, Any]]:
    return await transport_service.list_routes(
        current,
        active_only=active_only,
        params=PageParams(page=page, page_size=page_size),
    )


@router.post("/assignments")
async def assign_student(
    payload: StudentAssignment,
    current: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return await transport_service.assign_student(current, **payload.model_dump())


@router.get("/assignments")
async def list_assignments(
    route_id: str | None = Query(None),
    student_id: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current: CurrentUser = Depends(get_current_user),
) -> PageResponse[dict[str, Any]]:
    return await transport_service.list_assignments(
        current,
        route_id=route_id,
        student_id=student_id,
        params=PageParams(page=page, page_size=page_size),
    )


@router.get("/stats")
async def get_transport_stats(
    current: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return await transport_service.get_transport_stats(current)
