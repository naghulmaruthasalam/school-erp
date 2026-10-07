"""Curriculum API - query textbook/syllabus content by grade, subject, chapter."""
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, HTTPException
from pydantic import BaseModel

from app.core.deps import CurrentUser, require_tenant_user
from app.core.enums import DocumentModule, Role
from app.models.curriculum import CurriculumUnit, CurriculumResource
from app.schemas.common import PageParams, PageResponse
from app.services import upload_service

router = APIRouter(prefix="/curriculum", tags=["curriculum"])

STAFF_ROLES = {Role.TEACHER, Role.SCHOOL_ADMIN, Role.PRINCIPAL}


@router.get("/grades")
async def list_grades(
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Get list of available grades."""
    pipeline = [
        {"$group": {"_id": "$grade"}},
        {"$sort": {"_id": 1}},
    ]
    result = await CurriculumUnit.aggregate(pipeline).to_list()
    grades = sorted([r["_id"] for r in result if r["_id"]])
    return {"grades": grades}


@router.get("/subjects")
async def list_subjects(
    grade: int | None = Query(None),
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Get list of available subjects, optionally filtered by grade."""
    match_stage = {}
    if grade:
        match_stage["grade"] = grade

    pipeline = [
        {"$match": match_stage} if match_stage else {"$match": {}},
        {"$group": {"_id": "$subject"}},
        {"$sort": {"_id": 1}},
    ]
    result = await CurriculumUnit.aggregate(pipeline).to_list()
    subjects = sorted([r["_id"] for r in result if r["_id"]])
    return {"subjects": subjects}


@router.get("/chapters")
async def list_chapters(
    grade: int,
    subject: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Get list of chapters/units for a grade and subject (deduplicated)."""
    units = await CurriculumUnit.find(
        CurriculumUnit.grade == grade,
        CurriculumUnit.subject == subject,
    ).sort(CurriculumUnit.unit_number).to_list()

    seen = set()
    chapters = []
    for u in units:
        if u.unit_number not in seen:
            seen.add(u.unit_number)
            chapters.append({
                "unit_number": u.unit_number,
                "title_en": u.unit_title_en,
                "title_ar": u.unit_title_ar,
                "total_pages": u.total_pages,
            })
    return {"chapters": chapters, "total": len(chapters)}


@router.get("/content")
async def get_content(
    grade: int,
    subject: str,
    unit_number: int | None = Query(None),
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Get curriculum content for teacher copilot features."""

    filters = [
        CurriculumUnit.grade == grade,
        CurriculumUnit.subject == subject,
    ]
    if unit_number:
        filters.append(CurriculumUnit.unit_number == unit_number)

    units = await CurriculumUnit.find(*filters).sort(CurriculumUnit.unit_number).to_list()

    if not units:
        return {"content": None, "message": "No content found"}

    if unit_number:
        unit = units[0]
        return {
            "grade": unit.grade,
            "subject": unit.subject,
            "unit_number": unit.unit_number,
            "title_en": unit.unit_title_en,
            "title_ar": unit.unit_title_ar,
            "full_text": unit.full_text,
            "pages": [{"page_number": p.page_number, "text": p.text} for p in unit.pages],
            "metadata": unit.metadata.model_dump() if unit.metadata else None,
        }

    return {
        "grade": grade,
        "subject": subject,
        "units": [
            {
                "unit_number": u.unit_number,
                "title_en": u.unit_title_en,
                "title_ar": u.unit_title_ar,
                "total_pages": u.total_pages,
            }
            for u in units
        ],
    }


@router.get("/search")
async def search_content(
    q: str = Query(..., min_length=2),
    grade: int | None = Query(None),
    subject: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Search curriculum content by text."""

    filters = []
    if grade:
        filters.append(CurriculumUnit.grade == grade)
    if subject:
        filters.append(CurriculumUnit.subject == subject)

    units = await CurriculumUnit.find(
        *filters,
        {"$or": [
            {"full_text": {"$regex": q, "$options": "i"}},
            {"unit_title_en": {"$regex": q, "$options": "i"}},
            {"unit_title_ar": {"$regex": q, "$options": "i"}},
        ]},
    ).skip((page - 1) * page_size).limit(page_size).to_list()

    results = [
        {
            "id": str(u.id),
            "grade": u.grade,
            "subject": u.subject,
            "unit_number": u.unit_number,
            "title_en": u.unit_title_en,
            "title_ar": u.unit_title_ar,
            "snippet": u.full_text[:300] + "..." if len(u.full_text) > 300 else u.full_text,
        }
        for u in units
    ]

    return {"results": results, "page": page, "page_size": page_size}


class CreateUnitRequest(BaseModel):
    grade: int
    subject: str
    unit_number: int
    unit_title_en: str
    unit_title_ar: str | None = None
    full_text: str = ""


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
    unit = await CurriculumUnit.find_one(
        CurriculumUnit.grade == grade,
        CurriculumUnit.subject == subject,
        CurriculumUnit.unit_number == unit_number,
    )

    if not unit:
        return {"resources": []}

    resources = []
    for r in unit.resources:
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
        "resources": resources,
    }
