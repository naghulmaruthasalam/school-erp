from app.core.deps import CurrentUser
from app.core.enums import Role
from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.models.base import utcnow
from app.models.guardian import Guardian
from app.models.student import Student
from app.models.syllabus import Chapter, Syllabus, SyllabusStatus
from app.schemas.common import PageParams, PageResponse
from app.schemas.syllabus import (
    ChapterOut,
    SyllabusCreateRequest,
    SyllabusOut,
    SyllabusUpdateRequest,
)

_STAFF_WRITE_ROLES = (Role.TEACHER, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.SUPER_ADMIN)


def to_syllabus_out(doc: Syllabus) -> SyllabusOut:
    return SyllabusOut(
        id=str(doc.id),
        school_id=doc.school_id,
        academic_year_id=doc.academic_year_id,
        class_id=doc.class_id,
        subject_id=doc.subject_id,
        title=doc.title,
        description=doc.description,
        status=doc.status,
        chapters=[
            ChapterOut(
                name=c.name,
                description=c.description,
                order=c.order,
                video_url=c.video_url,
                duration_minutes=c.duration_minutes,
            )
            for c in doc.chapters
        ],
        document_ids=doc.document_ids,
        created_by=doc.created_by,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


async def _guardian_student_ids(current: CurrentUser) -> list[str]:
    if not current.user.guardian_id:
        raise PermissionDeniedError("No guardian profile linked to this account")
    guardian = await Guardian.get(current.user.guardian_id)
    if guardian is None:
        raise NotFoundError("Guardian profile not found")
    return guardian.student_ids


async def _own_student(current: CurrentUser) -> Student:
    if not current.user.student_id:
        raise PermissionDeniedError("No student profile linked to this account")
    student = await Student.get(current.user.student_id)
    if student is None or student.school_id != current.school_id:
        raise PermissionDeniedError("No student profile linked to this account")
    return student


async def create_syllabus(current: CurrentUser, payload: SyllabusCreateRequest) -> SyllabusOut:
    if current.role not in _STAFF_WRITE_ROLES:
        raise PermissionDeniedError("Only teachers or school admins/principals can create syllabus")

    syllabus = Syllabus(
        school_id=current.school_id,
        academic_year_id=payload.academic_year_id,
        class_id=payload.class_id,
        subject_id=payload.subject_id,
        title=payload.title,
        description=payload.description,
        status=payload.status,
        chapters=[
            Chapter(
                name=c.name,
                description=c.description,
                order=c.order,
                video_url=c.video_url,
                duration_minutes=c.duration_minutes,
            )
            for c in payload.chapters
        ],
        document_ids=payload.document_ids,
        created_by=str(current.user.id),
    )
    await syllabus.insert()
    return to_syllabus_out(syllabus)


async def list_syllabus(
    current: CurrentUser,
    class_id: str | None,
    subject_id: str | None,
    academic_year_id: str | None,
    status: str | None,
    params: PageParams,
) -> PageResponse[SyllabusOut]:
    filters: dict = {"school_id": current.school_id}

    if current.role == Role.STUDENT:
        student = await _own_student(current)
        filters["class_id"] = student.class_id
        filters["status"] = SyllabusStatus.PUBLISHED.value
    elif current.role == Role.PARENT:
        child_ids = await _guardian_student_ids(current)
        children = [c for c in [await Student.get(cid) for cid in child_ids] if c is not None]
        child_class_ids = list({c.class_id for c in children})
        if not child_class_ids:
            return PageResponse(items=[], total=0, page=params.page, page_size=params.page_size)
        if class_id:
            if class_id not in child_class_ids:
                raise PermissionDeniedError("Not one of your children's classes")
            filters["class_id"] = class_id
        else:
            filters["class_id"] = {"$in": child_class_ids}
        filters["status"] = SyllabusStatus.PUBLISHED.value
    elif current.role in _STAFF_WRITE_ROLES:
        if class_id:
            filters["class_id"] = class_id
        if status:
            filters["status"] = status
    else:
        raise PermissionDeniedError("Not allowed to view syllabus")

    if subject_id:
        filters["subject_id"] = subject_id
    if academic_year_id:
        filters["academic_year_id"] = academic_year_id

    total = await Syllabus.find(filters).count()
    records = await Syllabus.find(filters).sort(-Syllabus.created_at).skip(params.skip).limit(params.page_size).to_list()
    return PageResponse(
        items=[to_syllabus_out(r) for r in records], total=total, page=params.page, page_size=params.page_size
    )


async def _get_syllabus_or_404(current: CurrentUser, syllabus_id: str) -> Syllabus:
    syllabus = await Syllabus.get(syllabus_id)
    if syllabus is None or syllabus.school_id != current.school_id:
        raise NotFoundError("Syllabus not found")
    return syllabus


async def _check_syllabus_read_access(current: CurrentUser, syllabus: Syllabus) -> None:
    if current.role == Role.STUDENT:
        student = await _own_student(current)
        if student.class_id != syllabus.class_id:
            raise PermissionDeniedError("Not your class's syllabus")
    elif current.role == Role.PARENT:
        child_ids = await _guardian_student_ids(current)
        children = [c for c in [await Student.get(cid) for cid in child_ids] if c is not None]
        if not any(c.class_id == syllabus.class_id for c in children):
            raise PermissionDeniedError("Not your child's syllabus")


async def get_syllabus(current: CurrentUser, syllabus_id: str) -> SyllabusOut:
    syllabus = await _get_syllabus_or_404(current, syllabus_id)
    await _check_syllabus_read_access(current, syllabus)
    return to_syllabus_out(syllabus)


async def get_syllabus_model(current: CurrentUser, syllabus_id: str) -> Syllabus:
    """Get raw syllabus model for internal updates (e.g., video upload)."""
    if current.role not in _STAFF_WRITE_ROLES:
        raise PermissionDeniedError("Only teachers or school admins/principals can modify syllabus")
    return await _get_syllabus_or_404(current, syllabus_id)


async def update_syllabus(current: CurrentUser, syllabus_id: str, payload: SyllabusUpdateRequest) -> SyllabusOut:
    if current.role not in _STAFF_WRITE_ROLES:
        raise PermissionDeniedError("Only teachers or school admins/principals can update syllabus")
    syllabus = await _get_syllabus_or_404(current, syllabus_id)

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if field == "chapters" and value is not None:
            syllabus.chapters = [
                Chapter(
                    name=c["name"],
                    description=c.get("description"),
                    order=c["order"],
                    video_url=c.get("video_url"),
                    duration_minutes=c.get("duration_minutes"),
                )
                for c in value
            ]
        else:
            setattr(syllabus, field, value)
    syllabus.updated_at = utcnow()
    await syllabus.save()
    return to_syllabus_out(syllabus)


async def delete_syllabus(current: CurrentUser, syllabus_id: str) -> None:
    if current.role not in _STAFF_WRITE_ROLES:
        raise PermissionDeniedError("Only teachers or school admins/principals can delete syllabus")
    syllabus = await _get_syllabus_or_404(current, syllabus_id)
    await syllabus.delete()
