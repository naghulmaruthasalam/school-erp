from app.core.audit import record_audit
from app.core.enums import Role
from app.core.exceptions import ConflictError, NotFoundError
from app.core.deps import CurrentUser
from app.core.security import hash_password
from app.models.base import utcnow
from app.models.teacher import Teacher
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.common import PageParams, PageResponse
from app.schemas.teacher import (
    TeacherCreateRequest,
    TeacherOut,
    TeacherSelfUpdateRequest,
    TeacherUpdateRequest,
)
from app.services.user_provisioning import provision_user_account, _generate_temp_password


async def generate_employee_no(school_id: str) -> str:
    """Generate simple employee number: {SHORT_CODE}-EMP-{SEQ}

    Uses first 3-4 chars of school name as prefix for easy identification.
    Example: BVB-EMP-001, DPS-EMP-042
    """
    tenant = await Tenant.get(school_id)
    if tenant:
        name_parts = tenant.name.upper().split()
        if len(name_parts) >= 2:
            prefix = "".join(p[0] for p in name_parts[:3])
        else:
            prefix = tenant.name.upper()[:3]
    else:
        prefix = "SCH"

    count = await Teacher.find(Teacher.school_id == school_id).count()
    seq = str(count + 1).zfill(3)
    return f"{prefix}-EMP-{seq}"


def to_teacher_out(teacher: Teacher) -> TeacherOut:
    return TeacherOut(
        id=str(teacher.id),
        school_id=teacher.school_id,
        employee_no=teacher.employee_no,
        first_name=teacher.first_name,
        last_name=teacher.last_name,
        full_name=teacher.full_name,
        dob=teacher.dob,
        gender=teacher.gender,
        phone=teacher.phone,
        email=teacher.email,
        address=teacher.address,
        qualifications=teacher.qualifications,
        subject_ids=teacher.subject_ids,
        assigned_class_ids=teacher.assigned_class_ids,
        joining_date=teacher.joining_date,
        status=teacher.status,
        photo_document_id=teacher.photo_document_id,
        document_ids=teacher.document_ids,
        created_at=teacher.created_at,
        updated_at=teacher.updated_at,
    )


async def _get_teacher_in_school(school_id: str, teacher_id: str) -> Teacher:
    teacher = await Teacher.get(teacher_id)
    if teacher is None or teacher.school_id != school_id:
        raise NotFoundError("Teacher not found")
    return teacher


async def create_teacher(school_id: str, payload: TeacherCreateRequest, actor_user_id: str) -> tuple[TeacherOut, dict | None]:
    # Always auto-generate employee number
    employee_no = await generate_employee_no(school_id)

    existing = await Teacher.find_one(Teacher.school_id == school_id, Teacher.employee_no == employee_no)
    if existing is not None:
        raise ConflictError(f"Employee number '{employee_no}' is already in use")

    teacher = Teacher(
        school_id=school_id,
        employee_no=employee_no,
        first_name=payload.first_name,
        last_name=payload.last_name,
        dob=payload.dob,
        gender=payload.gender,
        phone=payload.phone,
        email=payload.email,
        address=payload.address,
        qualifications=payload.qualifications,
        subject_ids=payload.subject_ids,
        assigned_class_ids=payload.assigned_class_ids,
        joining_date=payload.joining_date,
        status=payload.status,
    )
    await teacher.insert()

    credentials = None
    try:
        _, password = await provision_user_account(
            school_id=school_id,
            role=Role.TEACHER,
            full_name=teacher.full_name,
            username=employee_no,  # Login ID = Employee Number
            email=payload.email,
            phone=payload.phone,
            teacher_id=str(teacher.id),
        )
        credentials = {"username": employee_no, "password": password}
    except ValueError as exc:
        await teacher.delete()
        raise ConflictError(str(exc)) from exc

    await record_audit(
        school_id=school_id,
        actor_user_id=actor_user_id,
        action="teacher.created",
        entity_type="Teacher",
        entity_id=str(teacher.id),
    )

    return to_teacher_out(teacher), credentials


async def list_teachers(
    school_id: str,
    params: PageParams,
    name: str | None = None,
    subject_id: str | None = None,
    status: str | None = None,
) -> PageResponse[TeacherOut]:
    query = Teacher.find(Teacher.school_id == school_id)

    if status:
        query = query.find(Teacher.status == status)
    if subject_id:
        query = query.find(Teacher.subject_ids == subject_id)
    if name:
        pattern = {"$regex": name, "$options": "i"}
        query = query.find({"$or": [{"first_name": pattern}, {"last_name": pattern}, {"employee_no": pattern}]})

    total = await query.count()
    teachers = await query.skip(params.skip).limit(params.page_size).to_list()
    return PageResponse(
        items=[to_teacher_out(t) for t in teachers],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


async def get_teacher(school_id: str, teacher_id: str) -> TeacherOut:
    teacher = await _get_teacher_in_school(school_id, teacher_id)
    return to_teacher_out(teacher)


async def update_teacher(
    school_id: str, teacher_id: str, payload: TeacherUpdateRequest, actor_user_id: str
) -> TeacherOut:
    teacher = await _get_teacher_in_school(school_id, teacher_id)

    data = payload.model_dump(exclude_unset=True)

    if "employee_no" in data and data["employee_no"] != teacher.employee_no:
        clash = await Teacher.find_one(
            Teacher.school_id == school_id, Teacher.employee_no == data["employee_no"]
        )
        if clash is not None:
            raise ConflictError(f"Employee number '{data['employee_no']}' is already in use")

    was_status = teacher.status
    for field, value in data.items():
        setattr(teacher, field, value)
    teacher.updated_at = utcnow()
    await teacher.save()

    if "status" in data and data["status"] != was_status:
        await record_audit(
            school_id=school_id,
            actor_user_id=actor_user_id,
            action="teacher.status_changed",
            entity_type="Teacher",
            entity_id=str(teacher.id),
            details={"from": was_status.value, "to": teacher.status.value},
        )

    return to_teacher_out(teacher)


async def delete_teacher(school_id: str, teacher_id: str, actor_user_id: str) -> None:
    teacher = await _get_teacher_in_school(school_id, teacher_id)

    user = await User.find_one(User.school_id == school_id, User.teacher_id == str(teacher.id))
    if user is not None:
        user.is_active = False
        await user.save()

    await teacher.delete()

    await record_audit(
        school_id=school_id,
        actor_user_id=actor_user_id,
        action="teacher.deleted",
        entity_type="Teacher",
        entity_id=teacher_id,
    )


async def get_my_teacher_profile(current: CurrentUser) -> TeacherOut:
    if not current.user.teacher_id:
        raise NotFoundError("No teacher profile linked to this account")
    teacher = await _get_teacher_in_school(current.school_id, current.user.teacher_id)
    return to_teacher_out(teacher)


async def update_my_teacher_profile(current: CurrentUser, payload: TeacherSelfUpdateRequest) -> TeacherOut:
    if not current.user.teacher_id:
        raise NotFoundError("No teacher profile linked to this account")
    teacher = await _get_teacher_in_school(current.school_id, current.user.teacher_id)

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(teacher, field, value)
    teacher.updated_at = utcnow()
    await teacher.save()

    return to_teacher_out(teacher)


async def reset_teacher_password(school_id: str, teacher_id: str) -> dict:
    """Reset or create login credentials for a teacher."""
    teacher = await _get_teacher_in_school(school_id, teacher_id)

    # Check if user account exists
    existing_user = await User.find_one(
        User.school_id == school_id,
        User.teacher_id == teacher_id,
    )

    new_password = _generate_temp_password()

    if existing_user:
        # Reset existing password
        existing_user.hashed_password = hash_password(new_password)
        existing_user.must_change_password = True
        await existing_user.save()
    else:
        # Create new user account
        await provision_user_account(
            school_id=school_id,
            role=Role.TEACHER,
            full_name=teacher.full_name,
            username=teacher.employee_no,
            phone=teacher.phone,
            email=teacher.email,
            password=new_password,
            teacher_id=str(teacher.id),
        )

    return {"username": teacher.employee_no, "password": new_password}
