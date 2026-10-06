"""Transport management models."""
from datetime import date
from enum import Enum

from pydantic import Field

from app.models.base import TenantDocument


class VehicleStatus(str, Enum):
    ACTIVE = "ACTIVE"
    MAINTENANCE = "MAINTENANCE"
    INACTIVE = "INACTIVE"


class Vehicle(TenantDocument):
    """School transport vehicle."""

    vehicle_no: str
    vehicle_type: str  # BUS, VAN, etc.
    capacity: int
    driver_name: str
    driver_phone: str
    driver_license: str | None = None
    helper_name: str | None = None
    helper_phone: str | None = None

    status: VehicleStatus = VehicleStatus.ACTIVE

    insurance_expiry: date | None = None
    fitness_expiry: date | None = None

    class Settings:
        name = "transport_vehicles"
        indexes = ["school_id", "vehicle_no", "status"]


class Route(TenantDocument):
    """Transport route."""

    route_name: str
    route_code: str

    vehicle_id: str | None = None
    vehicle_no: str | None = None

    stops: list[dict] = Field(default_factory=list)  # [{name, pickup_time, drop_time, fare}]

    is_active: bool = True

    class Settings:
        name = "transport_routes"
        indexes = ["school_id", "route_code", "vehicle_id"]


class StudentTransport(TenantDocument):
    """Student transport assignment."""

    student_id: str
    student_name: str
    student_class: str

    route_id: str
    route_name: str
    stop_name: str

    pickup_point: str | None = None
    drop_point: str | None = None

    monthly_fee: float = 0

    academic_year_id: str
    is_active: bool = True

    class Settings:
        name = "student_transport"
        indexes = ["school_id", "student_id", "route_id", "academic_year_id"]
