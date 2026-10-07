from app.core.deps import CurrentUser
from beanie import PydanticObjectId
from beanie.operators import In
from fastapi import UploadFile

from app.core.enums import DocumentModule, Role, SyllabusStatus
from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.models.base import utcnow
from app.models.document import Document
from app.models.guardian import Guardian
from app.models.student import Student
from app.models.syllabus import Chapter, Syllabus
from app.schemas.common import PageParams, PageResponse
from app.schemas.syllabus import (
    ChapterOut,
    SyllabusDocumentOut,
    SyllabusCreateRequest,
    SyllabusOut,
    SyllabusUpdateRequest,
)

_STAFF_WRITE_ROLES = (Role.TEACHER, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.SUPER_ADMIN)


def to_syllabus_out(doc: Syllabus, documents: dict[str, Document] | None = None) -> SyllabusOut:
    documents = documents or {}
    attached = [
        SyllabusDocumentOut(
            id=str(d.id), filename=d.original_filename, content_type=d.content_type, size_bytes=d.size_bytes
        )
        for d in (documents.get(i) for i in doc.document_ids)
        if d is not None
    ]
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
            ChapterOut(id=f"{doc.id}-{i}", syllabus_id=str(doc.id), name=c.name, description=c.description, order=c.order,
                       topics=c.topics, content=c.content, video_url=c.video_url, duration_minutes=c.duration_minutes)
            for i, c in enumerate(doc.chapters)
        ],
        chapters_count=len(doc.chapters),
        document_ids=doc.document_ids,
        documents=attached,
        created_by=doc.created_by,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


async def _outs(docs: list[Syllabus]) -> list[SyllabusOut]:
    """Serialise syllabus documents together with their attached files (one lookup for the whole list)."""
    ids: list[PydanticObjectId] = []
    for d in docs:
        for i in d.document_ids:
            try:
                ids.append(PydanticObjectId(i))
            except Exception:
                continue
    found = {str(x.id): x for x in await Document.find(In(Document.id, ids)).to_list()} if ids else {}
    return [to_syllabus_out(d, found) for d in docs]


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
        chapters=[
            Chapter(name=c.name, description=c.description, order=c.order, topics=c.topics, content=c.content,
                    video_url=c.video_url, duration_minutes=c.duration_minutes)
            for c in payload.chapters
        ],
        status=payload.status,
        document_ids=payload.document_ids,
        created_by=str(current.user.id),
    )
    await syllabus.insert()
    return (await _outs([syllabus]))[0]


async def list_syllabus(
    current: CurrentUser,
    class_id: str | None,
    subject_id: str | None,
    academic_year_id: str | None,
    params: PageParams,
    status: SyllabusStatus | None = None,
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
    return PageResponse(items=await _outs(records), total=total, page=params.page, page_size=params.page_size)


async def _get_syllabus_or_404(current: CurrentUser, syllabus_id: str) -> Syllabus:
    syllabus = await Syllabus.get(syllabus_id)
    if syllabus is None or syllabus.school_id != current.school_id:
        raise NotFoundError("Syllabus not found")
    return syllabus


async def _check_syllabus_read_access(current: CurrentUser, syllabus: Syllabus) -> None:
    if current.role in (Role.STUDENT, Role.PARENT) and syllabus.status != SyllabusStatus.PUBLISHED:
        raise NotFoundError("Syllabus not found")
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
    return (await _outs([syllabus]))[0]


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
            # The existing editor only knows name/description/order: keep the topics and notes a chapter already has.
            previous = {c.name.strip().lower(): c for c in syllabus.chapters}
            rebuilt = []
            for c in value:
                old = previous.get(c["name"].strip().lower())
                rebuilt.append(
                    Chapter(
                        name=c["name"], description=c.get("description"), order=c["order"],
                        topics=c["topics"] if "topics" in c else (old.topics if old else []),
                        content=c["content"] if "content" in c else (old.content if old else None),
                        video_url=c["video_url"] if "video_url" in c else (old.video_url if old else None),
                        duration_minutes=c["duration_minutes"] if "duration_minutes" in c else (old.duration_minutes if old else None),
                    )
                )
            syllabus.chapters = rebuilt
        elif field in ("title", "status") and value is None:
            continue
        else:
            setattr(syllabus, field, value)
    syllabus.updated_at = utcnow()
    await syllabus.save()
    return (await _outs([syllabus]))[0]


async def delete_syllabus(current: CurrentUser, syllabus_id: str) -> None:
    if current.role not in _STAFF_WRITE_ROLES:
        raise PermissionDeniedError("Only teachers or school admins/principals can delete syllabus")
    syllabus = await _get_syllabus_or_404(current, syllabus_id)
    await syllabus.delete()


async def attach_document(current: CurrentUser, syllabus_id: str, file: UploadFile) -> SyllabusDocumentOut:
    """Upload a file and attach it to a syllabus."""
    from app.services import upload_service

    if current.role not in _STAFF_WRITE_ROLES:
        raise PermissionDeniedError("Only teachers or school admins/principals can upload syllabus documents")
    syllabus = await _get_syllabus_or_404(current, syllabus_id)
    doc = await upload_service.upload_document(
        current, file, DocumentModule.SYLLABUS_DOCUMENT, "syllabus", str(syllabus.id)
    )
    syllabus.document_ids.append(doc.id)
    syllabus.updated_at = utcnow()
    await syllabus.save()
    return SyllabusDocumentOut(
        id=doc.id, filename=doc.original_filename, content_type=doc.content_type, size_bytes=doc.size_bytes
    )


async def get_tree(current: CurrentUser) -> dict:
    """Class -> subject -> chapter outline the user may browse (students/parents see published syllabi of their class only)."""
    from app.copilot.grounding import allowed_class_ids
    from app.models.academic import Class, Subject

    class_ids, _ = await allowed_class_ids(current)
    classes = await Class.find(Class.school_id == current.school_id).sort(+Class.order).to_list()
    if class_ids is not None:
        classes = [c for c in classes if str(c.id) in class_ids]
    syllabi = await Syllabus.find(Syllabus.school_id == current.school_id).to_list()
    if current.role in (Role.STUDENT, Role.PARENT):
        syllabi = [s for s in syllabi if s.status == SyllabusStatus.PUBLISHED]
    subjects = {str(s.id): s for s in await Subject.find(Subject.school_id == current.school_id).to_list()}

    out = []
    for c in classes:
        subs = []
        for syl in sorted((s for s in syllabi if s.class_id == str(c.id)), key=lambda s: subjects[s.subject_id].name if s.subject_id in subjects else ""):
            subject = subjects.get(syl.subject_id)
            if subject is None:
                continue
            subs.append({
                "id": syl.subject_id, "name": subject.name, "syllabus_id": str(syl.id), "title": syl.title,
                "status": syl.status,
                "chapters": [
                    {"id": f"{syl.id}-{i}", "name": ch.name, "description": ch.description, "order": ch.order,
                     "topics": ch.topics, "has_content": bool((ch.content or "").strip())}
                    for i, ch in sorted(enumerate(syl.chapters), key=lambda p: p[1].order)
                ],
            })
        out.append({"id": str(c.id), "name": c.name, "subjects": subs})
    return {"classes": out}
