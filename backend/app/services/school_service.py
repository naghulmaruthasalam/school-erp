import secrets
import string
from datetime import datetime
from typing import Any

from app.core.audit import record_audit
from app.core.enums import Role
from app.core.exceptions import ConflictError, NotFoundError
from app.core.tenant_db import set_current_tenant
from app.models.audit_log import AuditLog
from app.models.base import utcnow
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.common import PageParams, PageResponse
from app.schemas.school import SchoolCreateRequest, SchoolCreateResponse, SchoolOut, SchoolUpdateRequest
from app.services.user_provisioning import provision_user_account


def generate_school_code() -> str:
    year = datetime.now().year
    random_part = "".join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    return f"SCH-{year}-{random_part}"


def to_school_out(tenant: Tenant) -> SchoolOut:
    return SchoolOut(
        id=str(tenant.id),
        name=tenant.name,
        code=tenant.code,
        address=tenant.address,
        city=tenant.city,
        state=tenant.state,
        country=tenant.country,
        postal_code=tenant.postal_code,
        phone=tenant.phone,
        email=tenant.email,
        logo_document_id=tenant.logo_document_id,
        academic_year_start_month=tenant.academic_year_start_month,
        is_active=tenant.is_active,
        created_at=tenant.created_at,
        updated_at=tenant.updated_at,
    )


async def create_school(payload: SchoolCreateRequest) -> SchoolCreateResponse:
    school_code = payload.code if payload.code else generate_school_code()

    existing = await Tenant.find_one(Tenant.code == school_code)
    while existing is not None:
        school_code = generate_school_code()
        existing = await Tenant.find_one(Tenant.code == school_code)

    tenant = Tenant(
        name=payload.name,
        code=school_code,
        address=payload.address,
        city=payload.city,
        state=payload.state,
        country=payload.country,
        postal_code=payload.postal_code,
        phone=payload.phone,
        email=payload.email,
        academic_year_start_month=payload.academic_year_start_month,
    )
    await tenant.insert()

    try:
        admin_user = await provision_user_account(
            school_id=str(tenant.id),
            role=Role.SCHOOL_ADMIN,
            full_name=payload.admin_full_name,
            email=payload.admin_email,
            phone=payload.admin_phone,
            password=payload.admin_password,
        )
    except ValueError as exc:
        raise ConflictError(str(exc)) from exc

    return SchoolCreateResponse(
        school=to_school_out(tenant),
        admin_user_id=str(admin_user.id),
        admin_email=admin_user.email,
    )


async def list_schools(params: PageParams) -> PageResponse[SchoolOut]:
    total = await Tenant.find().count()
    tenants = await Tenant.find().skip(params.skip).limit(params.page_size).to_list()
    return PageResponse(
        items=[to_school_out(t) for t in tenants],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


async def get_school(school_id: str) -> SchoolOut:
    tenant = await Tenant.get(school_id)
    if tenant is None:
        raise NotFoundError("School not found")
    return to_school_out(tenant)


async def update_school(school_id: str, payload: SchoolUpdateRequest, actor_user_id: str) -> SchoolOut:
    tenant = await Tenant.get(school_id)
    if tenant is None:
        raise NotFoundError("School not found")

    data = payload.model_dump(exclude_unset=True)
    was_active = tenant.is_active

    for field, value in data.items():
        setattr(tenant, field, value)
    tenant.updated_at = utcnow()
    await tenant.save()

    if "is_active" in data and data["is_active"] != was_active:
        await record_audit(
            school_id=str(tenant.id),
            actor_user_id=actor_user_id,
            action="school.deactivated" if not data["is_active"] else "school.reactivated",
            entity_type="Tenant",
            entity_id=str(tenant.id),
            details={"is_active": data["is_active"]},
        )

    return to_school_out(tenant)


async def get_platform_stats() -> dict[str, Any]:
    total_schools = await Tenant.find().count()
    active_schools = await Tenant.find(Tenant.is_active == True).count()
    total_users = await User.find().count()
    active_users = await User.find(User.is_active == True).count()

    return {
        "total_schools": total_schools,
        "active_schools": active_schools,
        "inactive_schools": total_schools - active_schools,
        "total_users": total_users,
        "active_users": active_users,
    }


async def get_users_by_role() -> list[dict[str, Any]]:
    pipeline = [
        {"$group": {"_id": "$role", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    results = await User.aggregate(pipeline).to_list()
    return [{"role": r["_id"], "count": r["count"]} for r in results]


async def get_recent_audit_logs(limit: int = 50) -> list[dict[str, Any]]:
    logs = await AuditLog.find().sort("-created_at").limit(limit).to_list()
    result = []
    for log in logs:
        tenant = await Tenant.get(log.school_id) if log.school_id else None
        user = await User.get(log.actor_user_id) if log.actor_user_id else None
        result.append({
            "id": str(log.id),
            "school_name": tenant.name if tenant else "Platform",
            "actor_name": user.full_name if user else "Unknown",
            "actor_email": user.email if user else None,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "details": log.details,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })
    return result


async def get_school_stats(school_id: str) -> dict[str, Any]:
    from app.models.student import Student
    from app.models.teacher import Teacher
    from app.models.guardian import Guardian
    from app.models.admission import Admission
    from app.models.academic import Class

    # Set tenant context to query the correct database
    set_current_tenant(school_id)

    total_students = await Student.find(Student.school_id == school_id).count()
    total_teachers = await Teacher.find(Teacher.school_id == school_id).count()
    total_parents = await Guardian.find(Guardian.school_id == school_id).count()
    total_admissions = await Admission.find(Admission.school_id == school_id).count()
    active_classes = await Class.find(Class.school_id == school_id).count()

    return {
        "total_students": total_students,
        "total_teachers": total_teachers,
        "total_parents": total_parents,
        "total_admissions": total_admissions,
        "active_classes": active_classes,
    }
