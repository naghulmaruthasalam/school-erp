"""Curriculum context for the Copilot, built from the school's own data.

What a chat or tool may be about is decided here, not by the client:
  student  -> their own class only
  parent   -> the class of one of their own children
  teacher  -> classes they teach (timetable / subject assignment / assigned classes)
  admin    -> any class in the school
The text sent to the model is the syllabus outline for that class+subject, the selected chapter, and the
text of documents attached to the syllabus (PDF / text), re-read on every message so it can't be swapped
by a tampered request.
"""
import io
import logging
from dataclasses import dataclass, field
from functools import lru_cache

from beanie.operators import In

from app.core.config import get_settings
from app.core.deps import CurrentUser
from app.core.enums import STAFF_ROLES, Role, SyllabusStatus
from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationAppError
from app.core.s3 import read_bytes
from app.models.academic import Class, ClassSubjectTeacher, Section, Subject, TimetableSlot
from app.models.document import Document
from app.models.student import Student
from app.models.syllabus import Syllabus
from app.models.teacher import Teacher
from app.services import student_service

logger = logging.getLogger("copilot.grounding")

TEXT_TYPES = {".txt", ".csv", ".md"}
MAX_DOC_BYTES = 8 * 1024 * 1024


@dataclass
class StudyContext:
    class_id: str
    class_name: str
    subject_id: str | None = None
    subject_name: str | None = None
    chapter: str | None = None
    student_id: str | None = None  # the child, when a parent is the user
    text: str = ""
    has_material: bool = False
    chapters: list[str] = field(default_factory=list)

    @property
    def label(self) -> str:
        parts = [self.class_name]
        if self.subject_name:
            parts.append(self.subject_name)
        if self.chapter:
            parts.append(self.chapter)
        return " · ".join(parts)


# ------------------------------------------------------------------ access

async def _teacher_class_ids(current: CurrentUser) -> set[str]:
    teacher_id = current.user.teacher_id
    if not teacher_id:
        return set()
    section_ids = await student_service._teacher_allowed_section_ids(current)  # same rule as the student list
    class_ids: set[str] = set()
    if section_ids:
        from beanie import PydanticObjectId

        sections = await Section.find(
            Section.school_id == current.school_id,
            In(Section.id, [PydanticObjectId(s) for s in section_ids if len(s) == 24]),
        ).to_list()
        class_ids.update(s.class_id for s in sections)
    teacher = await Teacher.get(teacher_id) if len(str(teacher_id)) == 24 else None
    if teacher is not None:
        class_ids.update(teacher.assigned_class_ids)
    return class_ids


async def allowed_class_ids(current: CurrentUser, student_id: str | None = None) -> tuple[set[str] | None, str | None]:
    """(class ids the user may use, child id for parents). None means every class in the school."""
    if current.role == Role.STUDENT:
        student = await student_service.get_own_profile(current)
        return {student.class_id}, None
    if current.role == Role.PARENT:
        children = await student_service.get_my_children(current)
        if student_id:
            child = next((c for c in children if str(c.id) == student_id), None)
            if child is None:
                raise PermissionDeniedError("That child is not linked to your account")
            return {child.class_id}, str(child.id)
        return {c.class_id for c in children}, None
    if current.role == Role.TEACHER:
        return await _teacher_class_ids(current), None
    if current.role in STAFF_ROLES or current.role == Role.PRINCIPAL:
        return None, None
    raise PermissionDeniedError()


# ------------------------------------------------------------------ options for the UI pickers

async def context_options(current: CurrentUser) -> dict:
    """Classes -> subjects -> chapters this user can study/teach, plus a parent's children."""
    class_ids, _ = await allowed_class_ids(current)
    classes_q = Class.find(Class.school_id == current.school_id)
    classes = await classes_q.sort(+Class.order).to_list()
    if class_ids is not None:
        classes = [c for c in classes if str(c.id) in class_ids]

    published_only = current.role in (Role.STUDENT, Role.PARENT)
    syllabi = await Syllabus.find(Syllabus.school_id == current.school_id).to_list()
    if published_only:
        syllabi = [s for s in syllabi if s.status == SyllabusStatus.PUBLISHED]
    subjects = {str(s.id): s for s in await Subject.find(Subject.school_id == current.school_id).to_list()}

    out_classes = []
    for c in classes:
        subs: dict[str, dict] = {}
        for syl in (s for s in syllabi if s.class_id == str(c.id)):
            subject = subjects.get(syl.subject_id)
            if subject is None:
                continue
            entry = subs.setdefault(syl.subject_id, {"id": syl.subject_id, "name": subject.name, "chapters": []})
            for ch in sorted(syl.chapters, key=lambda x: x.order):
                if ch.name not in entry["chapters"]:
                    entry["chapters"].append(ch.name)
        out_classes.append({"id": str(c.id), "name": c.name, "subjects": list(subs.values())})

    children = []
    if current.role == Role.PARENT:
        children = [
            {"id": str(c.id), "name": f"{c.first_name} {c.last_name}".strip(), "class_id": c.class_id}
            for c in await student_service.get_my_children(current)
        ]
    return {"classes": out_classes, "children": children}


# ------------------------------------------------------------------ document text

@lru_cache(maxsize=64)
def _extract_text(document_id: str, size: int, key: str, filename: str) -> str:
    name = filename.lower()
    data = read_bytes(key)
    if name.endswith(".pdf"):
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(data))
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    if any(name.endswith(ext) for ext in TEXT_TYPES):
        return data.decode("utf-8", errors="ignore")
    return ""


async def _document_text(school_id: str, document_ids: list[str]) -> str:
    chunks: list[str] = []
    for doc_id in document_ids:
        try:
            doc = await Document.get(doc_id)
        except Exception:  # noqa: BLE001 - bad id
            continue
        if doc is None or doc.school_id != school_id or doc.size_bytes > MAX_DOC_BYTES:
            continue
        try:
            text = _extract_text(str(doc.id), doc.size_bytes, doc.s3_key, doc.original_filename)
        except Exception as exc:  # noqa: BLE001 - unreadable/corrupt file: skip, don't fail the chat
            logger.warning("Could not read document %s: %s", doc_id, type(exc).__name__)
            continue
        if text.strip():
            chunks.append(f"[{doc.original_filename}]\n{text.strip()}")
    return "\n\n".join(chunks)


# ------------------------------------------------------------------ build

async def build_study_context(
    current: CurrentUser,
    class_id: str,
    subject_id: str | None = None,
    chapter: str | None = None,
    student_id: str | None = None,
    require_subject: bool = False,
) -> StudyContext:
    allowed, child_id = await allowed_class_ids(current, student_id)
    if allowed is not None and class_id not in allowed:
        raise PermissionDeniedError("You can't use that class with the Copilot")
    school_class = await Class.get(class_id) if len(class_id) == 24 else None
    if school_class is None or school_class.school_id != current.school_id:
        raise NotFoundError("Class not found")
    if require_subject and not subject_id:
        raise ValidationAppError("Choose a subject first")

    ctx = StudyContext(class_id=class_id, class_name=school_class.name, student_id=child_id, chapter=chapter or None)
    if not subject_id:
        return ctx

    subject = await Subject.get(subject_id) if len(subject_id) == 24 else None
    if subject is None or subject.school_id != current.school_id:
        raise NotFoundError("Subject not found")
    ctx.subject_id, ctx.subject_name = subject_id, subject.name

    syllabi = await Syllabus.find(
        Syllabus.school_id == current.school_id, Syllabus.class_id == class_id, Syllabus.subject_id == subject_id
    ).to_list()
    if current.role in (Role.STUDENT, Role.PARENT):
        syllabi = [s for s in syllabi if s.status == SyllabusStatus.PUBLISHED]

    parts: list[str] = []
    doc_ids: list[str] = []
    for syl in syllabi:
        parts.append(f"Syllabus: {syl.title}" + (f"\n{syl.description}" if syl.description else ""))
        chapters = sorted(syl.chapters, key=lambda c: c.order)
        if chapters:
            parts.append("Chapter outline:\n" + "\n".join(
                f"{i}. {c.name}" + (f" - {c.description}" if c.description else "") for i, c in enumerate(chapters, 1)
            ))
            ctx.chapters.extend(c.name for c in chapters if c.name not in ctx.chapters)
        if chapter:
            for c in chapters:
                if c.name.strip().lower() == chapter.strip().lower():
                    parts.append(f"Selected chapter: {c.name}" + (f"\n{c.description}" if c.description else ""))
        doc_ids.extend(d for d in syl.document_ids if d not in doc_ids)

    if chapter and ctx.chapters and chapter not in ctx.chapters:
        raise NotFoundError("That chapter isn't in this subject's syllabus")

    material = await _document_text(current.school_id, doc_ids)
    if material:
        parts.append("Reference material from the school's uploaded documents:\n" + material)
    ctx.has_material = bool(parts)
    ctx.text = "\n\n".join(parts)[: get_settings().copilot_max_context_chars]
    return ctx
