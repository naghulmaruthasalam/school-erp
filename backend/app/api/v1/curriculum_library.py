from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Query, UploadFile
from pydantic import BaseModel, Field

from app.core.deps import CurrentUser, get_current_user
from app.core.enums import Role
from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationAppError
from app.models.curriculum import CurriculumUnit
from app.models.translation_job import TranslationJob
from app.services import curriculum_library as lib
from app.services.academic_keys import detect_language, subject_key
from app.services.curriculum_service import group_by_unit, load_units

router = APIRouter(prefix="/curriculum-library", tags=["curriculum-library"])
MANAGERS = (Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.SUPER_ADMIN)
REVIEWERS = (*MANAGERS, Role.TEACHER)
MAX_BYTES = 40 * 1024 * 1024


def _need(current: CurrentUser, roles) -> None:
    if current.role not in roles:
        raise PermissionDeniedError("You are not allowed to do that")


class TranslateIn(BaseModel):
    grade: int | None = Field(default=None, ge=1, le=12)
    subject: str | None = None
    unit_number: int | None = None
    target: str = "ar"  # ar | en | both
    force: bool = False


class UnitEdit(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    full_text: str | None = None
    approve: bool = False


@router.get("")
async def library(grade: int | None = Query(None, ge=1, le=12), current: CurrentUser = Depends(get_current_user)) -> dict:
    """Std 1-12: the units in the library and which languages each has (with each translation's status)."""
    _need(current, REVIEWERS)
    return await lib.overview(current.school_id, grade)


@router.post("/ingest")
async def ingest(file: UploadFile = File(...), shared: bool = Form(False), current: CurrentUser = Depends(get_current_user)) -> dict:
    """Load textbook units (NDJSON or JSON) for any grade 1-12. The language of each record is detected from its text.
    The units belong to your school (a super admin's belong to every school)."""
    _need(current, MANAGERS)
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValidationAppError("That file is too large (limit 40 MB)")
    records, problems = lib.parse_records(file.filename or "units.ndjson", data)
    report = await lib.ingest_records(records, None if current.role == Role.SUPER_ADMIN else current.school_id)
    report["problems"] = [*problems, *report["problems"]]
    return report


@router.post("/translate", status_code=202)
async def translate(payload: TranslateIn, background: BackgroundTasks, current: CurrentUser = Depends(get_current_user)) -> dict:
    """Translate the units in scope that exist in one language only, into the other. Runs in the background; poll /jobs/{id}."""
    _need(current, MANAGERS)
    if payload.target not in ("ar", "en", "both"):
        raise ValidationAppError("target must be ar, en or both")
    job = await lib.start_job(current.school_id, str(current.user.id), grade=payload.grade, subject=payload.subject,
                              unit_number=payload.unit_number, target=payload.target, force=payload.force)
    background.add_task(lib.run_job, str(job.id))
    return {"job_id": str(job.id), "status": job.status}


def _job_out(j: TranslationJob) -> dict:
    return {"id": str(j.id), "status": j.status, "total": j.total, "translated": j.translated, "skipped": j.skipped, "failed": j.failed,
            "messages": j.messages[-30:], "target": j.target, "grade": j.grade, "finished_at": j.finished_at.isoformat() if j.finished_at else None}


@router.get("/jobs/{job_id}")
async def job(job_id: str, current: CurrentUser = Depends(get_current_user)) -> dict:
    _need(current, REVIEWERS)
    j = await TranslationJob.get(job_id) if len(job_id) == 24 else None
    if j is None or (j.school_id != current.school_id and current.role != Role.SUPER_ADMIN):
        raise NotFoundError("Job not found")
    return _job_out(j)


@router.get("/unit")
async def unit(grade: int = Query(..., ge=1, le=12), subject: str = Query(...), unit_number: int = Query(...), current: CurrentUser = Depends(get_current_user)) -> dict:
    """Both language editions of one unit, for side-by-side review."""
    _need(current, REVIEWERS)
    groups = group_by_unit(await load_units(current.school_id, grade, subject))
    group = next((g for (gr, sk, n), g in groups.items() if n == unit_number and sk == subject_key(subject)), None)
    if not group:
        raise NotFoundError("Unit not found")

    def out(u: CurriculumUnit | None):
        return None if u is None else {
            "id": str(u.id), "title": u.unit_title_ar if detect_language(u.full_text, u.language) == "ar" else u.unit_title_en, "full_text": u.full_text,
            "source": "translation" if u.translated_from else "original", "status": u.translation_status or "original", "flags": u.translation_flags,
            "translated_from": u.translated_from, "reviewed_at": u.reviewed_at.isoformat() if u.reviewed_at else None,
        }
    return {"grade": grade, "subject": next(iter(group.values())).subject, "unit_number": unit_number, "en": out(group.get("en")), "ar": out(group.get("ar"))}


@router.put("/units/{unit_id}")
async def edit_unit(unit_id: str, payload: UnitEdit, current: CurrentUser = Depends(get_current_user)) -> dict:
    """Correct a translation (title and/or text) and optionally approve it. Corrections reach the syllabus chapters."""
    _need(current, REVIEWERS)
    u = await CurriculumUnit.get(unit_id) if len(unit_id) == 24 else None
    if u is None or (u.school_id and u.school_id != current.school_id and current.role != Role.SUPER_ADMIN):
        raise NotFoundError("Unit not found")
    previous = u.full_text
    lang = detect_language(u.full_text, u.language)
    if payload.full_text is not None:
        if not payload.full_text.strip():
            raise ValidationAppError("The text cannot be empty")
        u.full_text = payload.full_text.strip()
        u.content_hash_md5 = lib._hash(u.full_text)  # noqa: SLF001
    if payload.title is not None:
        if lang == "ar":
            u.unit_title_ar = payload.title.strip()
        else:
            u.unit_title_en = payload.title.strip()
    if u.translated_from and (payload.approve or payload.full_text is not None):
        u.translation_status = "reviewed"
        u.translation_flags = []
        u.reviewed_by = str(current.user.id)
        u.reviewed_at = lib._now()  # noqa: SLF001
    u.updated_at = lib._now()  # noqa: SLF001
    await u.save()
    applied = await lib.apply_to_syllabi(current.school_id, u, previous) if current.school_id and payload.full_text is not None else 0
    return {"id": str(u.id), "status": u.translation_status or "original", "syllabi_updated": applied}
