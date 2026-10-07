from beanie.operators import In, Or, RegEx

from app.core.audit import record_audit
from app.core.deps import CurrentUser
from app.core.enums import Role, StudentStatus
from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationAppError
from app.models.academic import ClassSubjectTeacher, Section
from app.models.guardian import Guardian
from app.models.student import Student
from app.models.tenant import Tenant
from app.schemas.common import PageParams, PageResponse
from app.schemas.student import StudentCreateRequest, StudentOut, StudentStatusUpdateRequest, StudentUpdateRequest
from app.models.user import User
from app.core.security import hash_password
from app.services.user_provisioning import link_guardian_to_student, provision_user_account, _generate_temp_password

ADMIN_ROLES = (Role.SCHOOL_ADMIN, Role.PRINCIPAL)


def to_out(student: Student) -> StudentOut:
    return StudentOut(
        id=str(student.id),
        school_id=student.school_id,
        admission_no=student.admission_no,
        first_name=student.first_name,
        last_name=student.last_name,
        full_name=student.full_name,
        dob=student.dob,
        gender=student.gender,
        blood_group=student.blood_group,
        academic_year_id=student.academic_year_id,
        class_id=student.class_id,
        section_id=student.section_id,
        roll_number=student.roll_number,
        guardian_ids=student.guardian_ids,
        primary_guardian_id=student.primary_guardian_id,
        admission_date=student.admission_date,
        status=student.status,
        address=student.address,
        phone=student.phone,
        email=student.email,
        photo_document_id=student.photo_document_id,
        document_ids=student.document_ids,
        created_at=student.created_at,
        updated_at=student.updated_at,
    )


async def _teacher_allowed_section_ids(current: CurrentUser) -> set[str]:
    """Sections a TEACHER may see students in: sections they are the class
    teacher of, or sections they teach a subject in."""
    teacher_id = current.user.teacher_id
    if not teacher_id:
        return set()

    section_ids: set[str] = set()

    cst_rows = await ClassSubjectTeacher.find(
        ClassSubjectTeacher.school_id == current.school_id,
        ClassSubjectTeacher.teacher_id == teacher_id,
    ).to_list()
    section_ids.update(row.section_id for row in cst_rows)

    class_teacher_sections = await Section.find(
        Section.school_id == current.school_id,
        Section.class_teacher_id == teacher_id,
    ).to_list()
    section_ids.update(str(s.id) for s in class_teacher_sections)

    return section_ids


async def _generate_admission_no(school_id: str) -> str:
    """Generate simple admission number: {SHORT_CODE}-STU-{SEQ}

    Uses first 3-4 chars of school name as prefix for easy identification.
    Example: BVB-STU-001, DPS-STU-042
    """
    tenant = await Tenant.get(school_id)
    if tenant:
        # Use school name initials (first 3-4 chars, uppercase)
        name_parts = tenant.name.upper().split()
        if len(name_parts) >= 2:
            prefix = "".join(p[0] for p in name_parts[:3])  # First letter of each word
        else:
            prefix = tenant.name.upper()[:3]
    else:
        prefix = "SCH"

    count = await Student.find(Student.school_id == school_id).count()
    seq = str(count + 1).zfill(3)
    return f"{prefix}-STU-{seq}"


async def create_student(current: CurrentUser, payload: StudentCreateRequest) -> Student:
    if current.role not in ADMIN_ROLES:
        raise PermissionDeniedError()

    data = payload.model_dump()
    # Always auto-generate admission number
    data["admission_no"] = await _generate_admission_no(current.school_id)

    student = Student(school_id=current.school_id, **data)
    await student.insert()

    credentials = None
    # Auto-provision student login account using admission_no as username
    try:
        _, password = await provision_user_account(
            school_id=current.school_id,
            role=Role.STUDENT,
            full_name=student.full_name,
            username=student.admission_no,  # Login ID = Admission Number
            phone=student.phone,
            email=student.email,
            student_id=str(student.id),
        )
        credentials = {"username": student.admission_no, "password": password}
    except ValueError:
        pass  # User already exists

    return student, credentials


async def list_students(
    current: CurrentUser,
    class_id: str | None,
    section_id: str | None,
    status: StudentStatus | None,
    name: str | None,
    page_params: PageParams,
) -> PageResponse[StudentOut]:
    if current.role not in (*ADMIN_ROLES, Role.TEACHER):
        raise PermissionDeniedError()

    query = Student.find(Student.school_id == current.school_id)

    if current.role == Role.TEACHER:
        allowed = await _teacher_allowed_section_ids(current)
        if section_id is not None:
            if section_id not in allowed:
                # Teacher explicitly asked for a section they don't own — empty result, not an error.
                return PageResponse(items=[], total=0, page=page_params.page, page_size=page_params.page_size)
            query = query.find(Student.section_id == section_id)
        else:
            if not allowed:
                return PageResponse(items=[], total=0, page=page_params.page, page_size=page_params.page_size)
            query = query.find(In(Student.section_id, list(allowed)))
    elif section_id is not None:
        query = query.find(Student.section_id == section_id)

    if class_id is not None:
        query = query.find(Student.class_id == class_id)
    if status is not None:
        query = query.find(Student.status == status)
    if name:
        # Match against first or last name (case-insensitive substring).
        query = query.find(
            Or(RegEx(Student.first_name, name, options="i"), RegEx(Student.last_name, name, options="i"))
        )

    total = await query.count()
    students = await query.skip(page_params.skip).limit(page_params.page_size).to_list()
    return PageResponse(
        items=[to_out(s) for s in students],
        total=total,
        page=page_params.page,
        page_size=page_params.page_size,
    )


async def _authorize_read(current: CurrentUser, student: Student) -> None:
    if student.school_id != current.school_id:
        raise NotFoundError("Student not found")

    if current.role in ADMIN_ROLES:
        return
    if current.role == Role.TEACHER:
        allowed = await _teacher_allowed_section_ids(current)
        if student.section_id in allowed:
            return
        raise NotFoundError("Student not found")
    if current.role == Role.PARENT:
        if current.user.guardian_id and current.user.guardian_id in student.guardian_ids:
            return
        raise NotFoundError("Student not found")
    if current.role == Role.STUDENT:
        if current.user.student_id and str(student.id) == current.user.student_id:
            return
        raise NotFoundError("Student not found")
    raise NotFoundError("Student not found")


async def get_student(current: CurrentUser, student_id: str) -> Student:
    student = await Student.get(student_id)
    if student is None:
        raise NotFoundError("Student not found")
    await _authorize_read(current, student)
    return student


async def _get_for_admin(current: CurrentUser, student_id: str) -> Student:
    if current.role not in ADMIN_ROLES:
        raise PermissionDeniedError()
    student = await Student.get(student_id)
    if student is None or student.school_id != current.school_id:
        raise NotFoundError("Student not found")
    return student


async def update_student(current: CurrentUser, student_id: str, payload: StudentUpdateRequest) -> Student:
    student = await _get_for_admin(current, student_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(student, field, value)
    await student.save()
    return student


async def update_student_status(current: CurrentUser, student_id: str, payload: StudentStatusUpdateRequest) -> Student:
    student = await _get_for_admin(current, student_id)
    old_status = student.status
    student.status = payload.status
    await student.save()
    await record_audit(
        school_id=current.school_id,
        actor_user_id=current.id,
        action="student.status_changed",
        entity_type="Student",
        entity_id=str(student.id),
        details={"from": old_status.value, "to": payload.status.value, "note": payload.note},
    )
    return student


async def delete_student(current: CurrentUser, student_id: str) -> None:
    student = await _get_for_admin(current, student_id)
    await student.delete()


async def get_own_profile(current: CurrentUser) -> Student:
    if current.role != Role.STUDENT or not current.user.student_id:
        raise PermissionDeniedError()
    student = await Student.get(current.user.student_id)
    if student is None or student.school_id != current.school_id:
        raise NotFoundError("Student profile not found")
    return student


async def update_own_profile(current: CurrentUser, payload: StudentUpdateRequest) -> Student:
    student = await get_own_profile(current)
    allowed_fields = {"photo_document_id", "phone", "email", "address"}
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field in allowed_fields:
            setattr(student, field, value)
    await student.save()
    return student


async def get_my_children(current: CurrentUser) -> list[Student]:
    if current.role != Role.PARENT or not current.user.guardian_id:
        raise PermissionDeniedError()
    guardian = await Guardian.get(current.user.guardian_id)
    if guardian is None or guardian.school_id != current.school_id:
        return []
    students: list[Student] = []
    for sid in guardian.student_ids:
        student = await Student.get(sid)
        if student is not None and student.school_id == current.school_id:
            students.append(student)
    return students


async def link_guardian(current: CurrentUser, student_id: str, guardian_id: str, make_primary: bool) -> Student:
    student = await _get_for_admin(current, student_id)
    guardian = await Guardian.get(guardian_id)
    if guardian is None or guardian.school_id != current.school_id:
        raise ValidationAppError("Guardian not found for this school")
    await link_guardian_to_student(guardian_id, str(student.id), make_primary=make_primary)
    refreshed = await Student.get(student_id)
    assert refreshed is not None
    return refreshed


async def reset_student_password(current: CurrentUser, student_id: str) -> dict:
    """Reset or create login credentials for a student."""
    student = await _get_for_admin(current, student_id)

    # Check if user account exists
    existing_user = await User.find_one(
        User.school_id == current.school_id,
        User.student_id == student_id,
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
            school_id=current.school_id,
            role=Role.STUDENT,
            full_name=student.full_name,
            username=student.admission_no,
            phone=student.phone,
            email=student.email,
            password=new_password,
            student_id=str(student.id),
        )

    return {"username": student.admission_no, "password": new_password}
