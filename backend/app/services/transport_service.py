"""Transport service."""
from typing import Any

from app.core.deps import CurrentUser
from app.core.enums import Role
from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.models.transport import Route, StudentTransport, Vehicle, VehicleStatus
from app.schemas.common import PageParams, PageResponse

ADMIN_ROLES = (Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL)


def vehicle_to_out(v: Vehicle) -> dict[str, Any]:
    return {
        "id": str(v.id),
        "school_id": v.school_id,
        "vehicle_no": v.vehicle_no,
        "vehicle_type": v.vehicle_type,
        "capacity": v.capacity,
        "driver_name": v.driver_name,
        "driver_phone": v.driver_phone,
        "driver_license": v.driver_license,
        "helper_name": v.helper_name,
        "helper_phone": v.helper_phone,
        "status": v.status,
        "insurance_expiry": v.insurance_expiry.isoformat() if v.insurance_expiry else None,
        "fitness_expiry": v.fitness_expiry.isoformat() if v.fitness_expiry else None,
    }


def route_to_out(r: Route) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "school_id": r.school_id,
        "route_name": r.route_name,
        "route_code": r.route_code,
        "vehicle_id": r.vehicle_id,
        "vehicle_no": r.vehicle_no,
        "stops": r.stops,
        "is_active": r.is_active,
    }


def assignment_to_out(a: StudentTransport) -> dict[str, Any]:
    return {
        "id": str(a.id),
        "school_id": a.school_id,
        "student_id": a.student_id,
        "student_name": a.student_name,
        "student_class": a.student_class,
        "route_id": a.route_id,
        "route_name": a.route_name,
        "stop_name": a.stop_name,
        "pickup_point": a.pickup_point,
        "drop_point": a.drop_point,
        "monthly_fee": a.monthly_fee,
        "academic_year_id": a.academic_year_id,
        "is_active": a.is_active,
    }


async def add_vehicle(
    current: CurrentUser,
    vehicle_no: str,
    vehicle_type: str,
    capacity: int,
    driver_name: str,
    driver_phone: str,
    **kwargs,
) -> dict[str, Any]:
    if current.role not in ADMIN_ROLES:
        raise PermissionDeniedError()

    v = Vehicle(
        school_id=current.school_id,
        vehicle_no=vehicle_no,
        vehicle_type=vehicle_type,
        capacity=capacity,
        driver_name=driver_name,
        driver_phone=driver_phone,
        **kwargs,
    )
    await v.insert()
    return vehicle_to_out(v)


async def list_vehicles(
    current: CurrentUser,
    status: str | None = None,
    params: PageParams | None = None,
) -> PageResponse[dict[str, Any]]:
    params = params or PageParams()
    query = Vehicle.find(Vehicle.school_id == current.school_id)

    if status:
        query = query.find(Vehicle.status == status)

    total = await query.count()
    vehicles = await query.skip(params.skip).limit(params.page_size).to_list()

    return PageResponse(
        items=[vehicle_to_out(v) for v in vehicles],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


async def add_route(
    current: CurrentUser,
    route_name: str,
    route_code: str,
    vehicle_id: str | None = None,
    stops: list[dict] | None = None,
) -> dict[str, Any]:
    if current.role not in ADMIN_ROLES:
        raise PermissionDeniedError()

    vehicle_no = None
    if vehicle_id:
        v = await Vehicle.get(vehicle_id)
        if v:
            vehicle_no = v.vehicle_no

    route = Route(
        school_id=current.school_id,
        route_name=route_name,
        route_code=route_code,
        vehicle_id=vehicle_id,
        vehicle_no=vehicle_no,
        stops=stops or [],
    )
    await route.insert()
    return route_to_out(route)


async def list_routes(
    current: CurrentUser,
    active_only: bool = True,
    params: PageParams | None = None,
) -> PageResponse[dict[str, Any]]:
    params = params or PageParams()
    query = Route.find(Route.school_id == current.school_id)

    if active_only:
        query = query.find(Route.is_active == True)

    total = await query.count()
    routes = await query.skip(params.skip).limit(params.page_size).to_list()

    return PageResponse(
        items=[route_to_out(r) for r in routes],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


async def assign_student(
    current: CurrentUser,
    student_id: str,
    student_name: str,
    student_class: str,
    route_id: str,
    stop_name: str,
    academic_year_id: str,
    monthly_fee: float = 0,
    **kwargs,
) -> dict[str, Any]:
    if current.role not in ADMIN_ROLES:
        raise PermissionDeniedError()

    route = await Route.get(route_id)
    if not route or route.school_id != current.school_id:
        raise NotFoundError("Route not found")

    assignment = StudentTransport(
        school_id=current.school_id,
        student_id=student_id,
        student_name=student_name,
        student_class=student_class,
        route_id=route_id,
        route_name=route.route_name,
        stop_name=stop_name,
        academic_year_id=academic_year_id,
        monthly_fee=monthly_fee,
        **kwargs,
    )
    await assignment.insert()
    return assignment_to_out(assignment)


async def list_assignments(
    current: CurrentUser,
    route_id: str | None = None,
    student_id: str | None = None,
    params: PageParams | None = None,
) -> PageResponse[dict[str, Any]]:
    params = params or PageParams()
    query = StudentTransport.find(StudentTransport.school_id == current.school_id, StudentTransport.is_active == True)

    if route_id:
        query = query.find(StudentTransport.route_id == route_id)
    if student_id:
        query = query.find(StudentTransport.student_id == student_id)

    total = await query.count()
    assignments = await query.skip(params.skip).limit(params.page_size).to_list()

    return PageResponse(
        items=[assignment_to_out(a) for a in assignments],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


async def get_transport_stats(current: CurrentUser) -> dict[str, Any]:
    total_vehicles = await Vehicle.find(Vehicle.school_id == current.school_id).count()
    active_vehicles = await Vehicle.find(
        Vehicle.school_id == current.school_id,
        Vehicle.status == VehicleStatus.ACTIVE,
    ).count()

    total_routes = await Route.find(Route.school_id == current.school_id, Route.is_active == True).count()
    total_students = await StudentTransport.find(
        StudentTransport.school_id == current.school_id,
        StudentTransport.is_active == True,
    ).count()

    return {
        "total_vehicles": total_vehicles,
        "active_vehicles": active_vehicles,
        "total_routes": total_routes,
        "students_using_transport": total_students,
    }
