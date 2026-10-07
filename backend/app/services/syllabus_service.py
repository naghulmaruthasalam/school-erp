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
from app.models.syllabus import Chapter, ChapterText, Syllabus
from app.services.academic_keys import equivalent_class_ids, subject_key
from app.schemas.common import PageParams, PageResponse
from app.schemas.syllabus import (
    ChapterOut,
    SyllabusDocumentOut,
    SyllabusCreateRequest,
    SyllabusOut,
    SyllabusUpdateRequest,
)

_STAFF_WRITE_ROLES = (Role.TEACHER, Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.SUPER_ADMIN)


def video_link(key: str | None, url: str | None) -> str | None:
    """A playable link: freshly signed from the stored object key (links expire), else the external URL."""
    if key:
        from app.core.s3 import generate_presigned_get_url

        return generate_presigned_get_url(key)
    return url


def _chapter_out(doc: Syllabus, i: int, c: Chapter, lang: str) -> ChapterOut:
    loc = c.localized(lang)
    tr = c.translations.get(loc.video_language or "") if loc.video_language and loc.video_language != "en" else None
    return ChapterOut(
        id=f"{doc.id}-{i}", syllabus_id=str(doc.id), key=c.name, name=loc.name, description=loc.description, order=c.order,
        topics=loc.topics, content=loc.content, video_url=video_link(loc.video_s3_key, loc.video_url),
        duration_minutes=(tr.duration_minutes if tr else c.duration_minutes),
        content_language=loc.content_language, languages=loc.languages,
        video_language=loc.video_language, video_languages=loc.video_languages,
    )


def to_syllabus_out(doc: Syllabus, documents: dict[str, Document] | None = None, lang: str = "en") -> SyllabusOut:
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
        chapters=[_chapter_out(doc, i, c, lang) for i, c in enumerate(doc.chapters)],
        chapters_count=len(doc.chapters),
        document_ids=doc.document_ids,
        documents=attached,
        created_by=doc.created_by,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


async def _outs(docs: list[Syllabus], lang: str = "en") -> list[SyllabusOut]:
    """Serialise syllabus documents together with their attached files (one lookup for the whole list)."""
    ids: list[PydanticObjectId] = []
    for d in docs:
        for i in d.document_ids:
            try:
                ids.append(PydanticObjectId(i))
            except Exception:
                continue
    found = {str(x.id): x for x in await Document.find(In(Document.id, ids)).to_list()} if ids else {}
    return [to_syllabus_out(d, found, lang) for d in docs]


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


async def create_syllabus(current: CurrentUser, payload: SyllabusCreateRequest, lang: str = "en") -> SyllabusOut:
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
    return (await _outs([syllabus], lang))[0]


async def _student_class_scope(current: CurrentUser) -> list[str]:
    """The student's class plus the equivalent records of the same grade, so duplicate class records don't hide a syllabus."""
    student = await _own_student(current)
    return await equivalent_class_ids(current.school_id, student.class_id)


async def _parent_class_scope(current: CurrentUser) -> list[str]:
    child_ids = await _guardian_student_ids(current)
    children = [c for c in [await Student.get(cid) for cid in child_ids] if c is not None]
    scope: list[str] = []
    for cid in {c.class_id for c in children}:
        scope.extend(i for i in await equivalent_class_ids(current.school_id, cid) if i not in scope)
    return scope


async def list_syllabus(
    current: CurrentUser,
    class_id: str | None,
    subject_id: str | None,
    academic_year_id: str | None,
    params: PageParams,
    status: SyllabusStatus | None = None,
    lang: str = "en",
) -> PageResponse[SyllabusOut]:
    from app.services.curriculum_service import ensure_synced

    await ensure_synced(current.school_id)
    filters: dict = {"school_id": current.school_id}

    if current.role == Role.STUDENT:
        filters["class_id"] = {"$in": await _student_class_scope(current)}
        filters["status"] = SyllabusStatus.PUBLISHED.value
    elif current.role == Role.PARENT:
        scope = await _parent_class_scope(current)
        if not scope:
            return PageResponse(items=[], total=0, page=params.page, page_size=params.page_size)
        if class_id:
            if class_id not in scope:
                raise PermissionDeniedError("Not one of your children's classes")
            filters["class_id"] = {"$in": await equivalent_class_ids(current.school_id, class_id)}
        else:
            filters["class_id"] = {"$in": scope}
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
    return PageResponse(items=await _outs(records, lang), total=total, page=params.page, page_size=params.page_size)


async def _get_syllabus_or_404(current: CurrentUser, syllabus_id: str) -> Syllabus:
    syllabus = await Syllabus.get(syllabus_id)
    if syllabus is None or syllabus.school_id != current.school_id:
        raise NotFoundError("Syllabus not found")
    return syllabus


async def _check_syllabus_read_access(current: CurrentUser, syllabus: Syllabus) -> None:
    if current.role in (Role.STUDENT, Role.PARENT) and syllabus.status != SyllabusStatus.PUBLISHED:
        raise NotFoundError("Syllabus not found")
    if current.role == Role.STUDENT:
        if syllabus.class_id not in await _student_class_scope(current):
            raise PermissionDeniedError("Not your class's syllabus")
    elif current.role == Role.PARENT:
        if syllabus.class_id not in await _parent_class_scope(current):
            raise PermissionDeniedError("Not your child's syllabus")


async def get_syllabus(current: CurrentUser, syllabus_id: str, lang: str = "en") -> SyllabusOut:
    syllabus = await _get_syllabus_or_404(current, syllabus_id)
    await _check_syllabus_read_access(current, syllabus)
    return (await _outs([syllabus], lang))[0]


async def get_syllabus_model(current: CurrentUser, syllabus_id: str) -> Syllabus:
    """Get raw syllabus model for internal updates (e.g., video upload)."""
    if current.role not in _STAFF_WRITE_ROLES:
        raise PermissionDeniedError("Only teachers or school admins/principals can modify syllabus")
    return await _get_syllabus_or_404(current, syllabus_id)


def _apply_video(old: Chapter, new: Chapter, c: dict, lang: str) -> None:
    """The editor echoes the video link it was shown. An uploaded video is changed only by uploading another (the link is
    signed and different on every read), and a link shown for one language is never written into the other language."""
    if "video_url" not in c and "duration_minutes" not in c:
        return
    shown = old.localized(lang)
    if shown.video_language != lang:  # what the editor holds is the other language's video: not an edit of this one
        return
    target = new if lang == "en" else new.translations.setdefault(lang, ChapterText())
    if target.video_s3_key:
        return
    if "video_url" in c and (c["video_url"] or None) != (shown.video_url or None):
        target.video_url = c["video_url"] or None
    if "duration_minutes" in c:
        target.duration_minutes = c["duration_minutes"]


def _rebuild_chapter(old: Chapter | None, c: dict, lang: str) -> Chapter:
    """Apply the editor's version of one chapter. In English it edits the chapter itself; in another language it edits
    only that language's text, and only the fields the user actually changed (so opening the editor in Arabic and saving
    never copies English text into the Arabic version, or the other way round)."""
    order = c["order"]
    if old is None:
        return Chapter(name=c["name"], description=c.get("description"), order=order, topics=c.get("topics") or [],
                       content=c.get("content"), video_url=c.get("video_url") if lang == "en" else None,
                       duration_minutes=c.get("duration_minutes") if lang == "en" else None,
                       translations={} if lang == "en" else {lang: ChapterText(video_url=c.get("video_url"))})
    new = old.model_copy(deep=True)
    new.order = order
    if lang == "en":
        new.name = c["name"]
        new.description = c.get("description")
        if "topics" in c:
            new.topics = c["topics"]
        if "content" in c:
            new.content = c["content"]
        _apply_video(old, new, c, lang)
        return new
    shown = old.localized(lang)
    tr = new.translations.get(lang) or ChapterText()
    if c["name"] != shown.name:
        tr.name = c["name"]
    if (c.get("description") or None) != (shown.description or None):
        tr.description = c.get("description")
    if "topics" in c and c["topics"] != shown.topics:
        tr.topics = c["topics"]
    if "content" in c and (c["content"] or None) != (shown.content or None):
        tr.content = c["content"]
    new.translations[lang] = tr
    _apply_video(old, new, c, lang)
    if not new.translations[lang].model_dump(exclude_defaults=True):
        del new.translations[lang]
    return new


async def update_syllabus(current: CurrentUser, syllabus_id: str, payload: SyllabusUpdateRequest, lang: str = "en") -> SyllabusOut:
    if current.role not in _STAFF_WRITE_ROLES:
        raise PermissionDeniedError("Only teachers or school admins/principals can update syllabus")
    syllabus = await _get_syllabus_or_404(current, syllabus_id)

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if field == "chapters" and value is not None:
            # Chapters are matched by the id the editor echoes back (its position), then by name in any language, so
            # the topics, notes and translations a chapter already has survive an edit that doesn't mention them.
            by_name = {n: c for c in syllabus.chapters for n in c.names()}
            rebuilt = []
            for c in value:
                old = None
                cid = str(c.get("id") or "")
                if cid.startswith(f"{syllabus.id}-") and cid.rsplit("-", 1)[1].isdigit():
                    pos = int(cid.rsplit("-", 1)[1])
                    old = syllabus.chapters[pos] if pos < len(syllabus.chapters) else None
                if old is None:
                    old = by_name.get(c["name"].strip().lower())
                rebuilt.append(_rebuild_chapter(old, c, lang))
            syllabus.chapters = rebuilt
        elif field in ("title", "status") and value is None:
            continue
        else:
            setattr(syllabus, field, value)
    syllabus.updated_at = utcnow()
    await syllabus.save()
    return (await _outs([syllabus], lang))[0]


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


def _best_per_subject(syllabi: list[Syllabus], subjects: dict) -> list[tuple[Syllabus, object]]:
    """One syllabus per subject: where several records cover the same subject (duplicates), keep the fullest one."""
    best: dict[str, tuple[Syllabus, object]] = {}
    for syl in syllabi:
        subject = subjects.get(syl.subject_id)
        if subject is None:
            continue
        key = subject_key(subject.name, getattr(subject, "code", None))
        cur = best.get(key)
        if cur is None or (len(syl.chapters), syl.updated_at) > (len(cur[0].chapters), cur[0].updated_at):
            best[key] = (syl, subject)
    return sorted(best.values(), key=lambda p: p[1].name)


async def find_chapter(school_id: str, section_id: str, subject_id: str, name: str | None) -> Chapter | None:
    """The syllabus chapter called `name` (in either language) for the class of this section and this subject, matching
    equivalent class/subject records too. None when the name is empty or isn't in the syllabus."""
    from app.models.academic import Section
    from app.services.academic_keys import equivalent_subject_ids

    if not name or len(section_id) != 24:
        return None
    section = await Section.get(section_id)
    if section is None or section.school_id != school_id:
        return None
    syllabi = await Syllabus.find({
        "school_id": school_id, "class_id": {"$in": await equivalent_class_ids(school_id, section.class_id)},
        "subject_id": {"$in": await equivalent_subject_ids(school_id, subject_id)},
    }).to_list()
    return next((ch for syl in syllabi for ch in syl.chapters if ch.matches(name)), None)


async def get_tree(current: CurrentUser, lang: str = "en") -> dict:
    """Class -> subject -> chapter outline the user may browse (students/parents see published syllabi of their class only)."""
    from app.copilot.grounding import allowed_class_ids
    from app.models.academic import Class, Subject

    from app.services.curriculum_service import ensure_synced

    await ensure_synced(current.school_id)  # textbook library -> syllabus for any class+subject that has none yet
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
        scope = set(await equivalent_class_ids(current.school_id, str(c.id))) if current.role in (Role.STUDENT, Role.PARENT) else {str(c.id)}
        subs = []
        mine = [s for s in syllabi if s.class_id in scope]
        if current.role in (Role.STUDENT, Role.PARENT):
            pairs = _best_per_subject(mine, subjects)
        else:  # staff see every syllabus (a draft can sit next to the published one)
            pairs = sorted(((s, subjects[s.subject_id]) for s in mine if s.subject_id in subjects), key=lambda p: p[1].name)
        for syl, subject in pairs:
            subs.append({
                "id": syl.subject_id, "name": subject.name, "syllabus_id": str(syl.id), "title": syl.title,
                "status": syl.status,
                "chapters": [
                    {"id": f"{syl.id}-{i}", "key": ch.name, "name": loc.name, "description": loc.description, "order": ch.order,
                     "topics": loc.topics, "has_content": bool(loc.content), "content_language": loc.content_language,
                     "languages": loc.languages, "has_video": bool(loc.video_s3_key or loc.video_url),
                     "video_language": loc.video_language}
                    for i, ch, loc in sorted(((i, ch, ch.localized(lang)) for i, ch in enumerate(syl.chapters)), key=lambda t: t[1].order)
                ],
            })
        out.append({"id": str(c.id), "name": c.name, "subjects": subs})
    return {"classes": out}
