"""Curriculum API - query textbook/syllabus content by grade, subject, chapter."""
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, HTTPException
from pydantic import BaseModel

from app.core.deps import CurrentUser, require_tenant_user
from app.core.enums import DocumentModule, Role
from app.core.lang import Lang, get_lang
from app.models.curriculum import CurriculumUnit, CurriculumResource
from app.schemas.common import PageParams, PageResponse
from app.services import curriculum_service, upload_service

router = APIRouter(prefix="/curriculum", tags=["curriculum"])

STAFF_ROLES = {Role.TEACHER, Role.SCHOOL_ADMIN, Role.PRINCIPAL}


@router.get("/grades")
async def list_grades(
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Get list of available grades."""
    units = await curriculum_service.load_units(current.school_id)
    return {"grades": sorted({u.grade for u in units if u.grade})}


@router.get("/subjects")
async def list_subjects(
    grade: int | None = Query(None),
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Get list of available subjects (one entry per subject, however the textbook files name it), optionally for a grade."""
    units = await curriculum_service.load_units(current.school_id, grade)
    return {"subjects": sorted(curriculum_service.subject_display(units).values())}


@router.get("/chapters")
async def list_chapters(
    grade: int,
    subject: str,
    current: CurrentUser = Depends(require_tenant_user),
    lang: Lang = Depends(get_lang),
) -> dict[str, Any]:
    """Chapters/units of a grade and subject: one entry per unit, titled and sourced in the caller's language."""
    units = await curriculum_service.load_units(current.school_id, grade, subject)
    chapters = [
        {**curriculum_service.describe(group, lang)}
        for group in curriculum_service.group_by_unit(units).values()
    ]
    return {"chapters": chapters, "total": len(chapters), "language": lang}


@router.get("/content")
async def get_content(
    grade: int,
    subject: str,
    unit_number: int | None = Query(None),
    current: CurrentUser = Depends(require_tenant_user),
    lang: Lang = Depends(get_lang),
) -> dict[str, Any]:
    """Curriculum content for a grade + subject (+ unit), in the caller's language when that edition exists."""
    units = await curriculum_service.load_units(current.school_id, grade, subject)
    groups = curriculum_service.group_by_unit(units)
    if unit_number is not None:
        groups = {k: g for k, g in groups.items() if k[2] == unit_number}
    if not groups:
        return {"content": None, "message": "No content found"}

    if unit_number is not None:
        group = next(iter(groups.values()))
        unit, served = curriculum_service.pick(group, lang)
        return {
            **curriculum_service.describe(group, lang),
            "grade": unit.grade,
            "subject": unit.subject,
            "requested_language": lang,
            "full_text": unit.full_text,
            "pages": [{"page_number": p.page_number, "text": p.text} for p in unit.pages],
            "metadata": unit.metadata.model_dump() if unit.metadata else None,
        }

    return {
        "grade": grade,
        "subject": subject,
        "language": lang,
        "units": [curriculum_service.describe(g, lang) for g in groups.values()],
    }


@router.get("/search")
async def search_content(
    q: str = Query(..., min_length=2),
    grade: int | None = Query(None),
    subject: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    current: CurrentUser = Depends(require_tenant_user),
    lang: Lang = Depends(get_lang),
) -> dict[str, Any]:
    """Search textbook text; hits in the caller's language come first."""
    needle = q.strip().lower()
    units = await curriculum_service.load_units(current.school_id, grade, subject)
    hits = [
        u for u in units
        if needle in (u.full_text or "").lower() or needle in (u.unit_title_en or "").lower() or needle in (u.unit_title_ar or "").lower()
    ]
    hits.sort(key=lambda u: (curriculum_service.unit_language(u) != lang, u.grade, u.subject, u.unit_number))
    window = hits[(page - 1) * page_size: page * page_size]
    results = [
        {
            "id": str(u.id), "grade": u.grade, "subject": u.subject, "unit_number": u.unit_number,
            "title": curriculum_service.title_in({curriculum_service.unit_language(u): u}, lang),
            "title_en": u.unit_title_en, "title_ar": curriculum_service.titles({"x": u})[1],
            "language": curriculum_service.unit_language(u),
            "snippet": u.full_text[:300] + "..." if len(u.full_text) > 300 else u.full_text,
        }
        for u in window
    ]
    return {"results": results, "page": page, "page_size": page_size, "total": len(hits)}


class CreateUnitRequest(BaseModel):
    grade: int
    subject: str
    unit_number: int
    unit_title_en: str
    unit_title_ar: str | None = None
    full_text: str = ""
    language: str = "en"  # the language the text is in; the same unit can be added once per language


@router.post("/units")
async def create_unit(
    req: CreateUnitRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Create a new curriculum unit."""
    if current.role not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="Staff only")

    existing = await CurriculumUnit.find_one(
        CurriculumUnit.grade == req.grade,
        CurriculumUnit.subject == req.subject,
        CurriculumUnit.unit_number == req.unit_number,
        CurriculumUnit.language == req.language,
    )
    if existing:
        raise HTTPException(status_code=409, detail="Unit already exists")

    unit = CurriculumUnit(
        school_id=current.school_id,
        grade=req.grade,
        subject=req.subject,
        unit_number=req.unit_number,
        unit_title_en=req.unit_title_en,
        unit_title_ar=req.unit_title_ar,
        full_text=req.full_text,
        language=req.language,
    )
    await unit.insert()
    return {"id": str(unit.id), "message": "Unit created"}


@router.post("/units/{grade}/{subject}/{unit_number}/resources")
async def upload_resource(
    grade: int,
    subject: str,
    unit_number: int,
    file: UploadFile = File(...),
    title: str = Form(...),
    resource_type: str = Form("video"),
    description: str = Form(None),
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Upload a resource (video, PDF, etc.) to a curriculum unit."""
    if current.role not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="Staff only")

    unit = await CurriculumUnit.find_one(
        CurriculumUnit.grade == grade,
        CurriculumUnit.subject == subject,
        CurriculumUnit.unit_number == unit_number,
    )

    if not unit:
        unit = CurriculumUnit(
            school_id=current.school_id,
            grade=grade,
            subject=subject,
            unit_number=unit_number,
            unit_title_en=f"{subject} - Chapter {unit_number}",
        )
        await unit.insert()

    doc = await upload_service.upload_document(
        current, file, DocumentModule.OTHER, "curriculum", str(unit.id)
    )

    resource = CurriculumResource(
        resource_type=resource_type,
        title=title,
        description=description,
        document_id=doc.id,
        file_size_bytes=doc.size_bytes,
    )

    unit.resources.append(resource)
    await unit.save()

    return {
        "message": "Resource uploaded",
        "document_id": doc.id,
        "unit_id": str(unit.id),
    }


@router.get("/units/{grade}/{subject}/{unit_number}/resources")
async def get_resources(
    grade: int,
    subject: str,
    unit_number: int,
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Get all resources for a curriculum unit."""
    # a unit exists once per language edition; videos and files belong to the unit, not to one edition
    units = [u for u in await curriculum_service.load_units(current.school_id, grade, subject) if u.unit_number == unit_number]
    if not units:
        return {"resources": []}
    unit = units[0]

    resources = []
    for r in (r for u in units for r in u.resources):
        res_data = r.model_dump()
        if r.document_id:
            try:
                url = await upload_service.get_document_url(current, r.document_id)
                res_data["url"] = url
            except Exception:
                res_data["url"] = None
        resources.append(res_data)

    return {
        "grade": grade,
        "subject": subject,
        "unit_number": unit_number,
        "title": unit.unit_title_en,
        "title_ar": curriculum_service.titles({"x": unit})[1],
        "resources": resources,
    }
