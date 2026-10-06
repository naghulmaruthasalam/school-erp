from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import PlainTextResponse, RedirectResponse

from app.core.deps import CurrentUser, require_tenant_user
from app.core.enums import SyllabusStatus
from app.schemas.common import PageParams, PageResponse
from app.schemas.document import PresignedUrlOut
from app.schemas.syllabus import (
    SyllabusCreateRequest,
    SyllabusDocumentOut,
    SyllabusOut,
    SyllabusUpdateRequest,
)
from app.services import syllabus_import_service, syllabus_service, upload_service

router = APIRouter(prefix="/syllabus", tags=["syllabus"])


@router.post("", response_model=SyllabusOut, status_code=201)
async def create_syllabus(
    payload: SyllabusCreateRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> SyllabusOut:
    return await syllabus_service.create_syllabus(current, payload)


@router.get("", response_model=PageResponse[SyllabusOut])
async def list_syllabus(
    class_id: str | None = None,
    subject_id: str | None = None,
    academic_year_id: str | None = None,
    status: SyllabusStatus | None = None,
    params: PageParams = Depends(),
    current: CurrentUser = Depends(require_tenant_user),
) -> PageResponse[SyllabusOut]:
    return await syllabus_service.list_syllabus(current, class_id, subject_id, academic_year_id, params, status)


# Fixed paths first, so "documents", "tree" and "import" are never read as a syllabus id.


@router.get("/tree")
async def syllabus_tree(current: CurrentUser = Depends(require_tenant_user)) -> dict:
    """Class -> subject -> chapter outline for the browser (scoped to what the user may see)."""
    return await syllabus_service.get_tree(current)


@router.get("/import/template", response_class=PlainTextResponse)
async def import_template(current: CurrentUser = Depends(require_tenant_user)) -> PlainTextResponse:
    return PlainTextResponse(
        syllabus_import_service.TEMPLATE_CSV, media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="syllabus-template.csv"'},
    )


@router.post("/import")
async def import_syllabus(
    file: UploadFile = File(...),
    dry_run: bool = Form(True),
    create_missing: bool = Form(False),
    mode: str = Form("merge"),
    current: CurrentUser = Depends(require_tenant_user),
) -> dict:
    """Load a CSV/JSON curriculum. Preview first (dry_run=true), then run it again with dry_run=false."""
    data = await file.read(syllabus_import_service.MAX_BYTES + 1)
    if len(data) > syllabus_import_service.MAX_BYTES:
        from app.core.exceptions import ValidationAppError

        raise ValidationAppError("That file is too large (limit 5 MB)")
    return await syllabus_import_service.import_curriculum(
        current, file.filename or "upload.csv", data, dry_run=dry_run, create_missing=create_missing, mode=mode
    )


@router.get("/documents/{document_id}/url", response_model=PresignedUrlOut)
async def syllabus_document_url(
    document_id: str, current: CurrentUser = Depends(require_tenant_user)
) -> PresignedUrlOut:
    return PresignedUrlOut(url=await upload_service.get_document_url(current, document_id))


@router.get("/documents/{document_id}/download")
async def download_syllabus_document(document_id: str, current: CurrentUser = Depends(require_tenant_user)):
    return RedirectResponse(url=await upload_service.get_document_url(current, document_id))


@router.post("/{syllabus_id}/documents", response_model=SyllabusDocumentOut, status_code=201)
async def upload_syllabus_document(
    syllabus_id: str,
    file: UploadFile = File(...),
    current: CurrentUser = Depends(require_tenant_user),
) -> SyllabusDocumentOut:
    return await syllabus_service.attach_document(current, syllabus_id, file)


@router.get("/{syllabus_id}", response_model=SyllabusOut)
async def get_syllabus(
    syllabus_id: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> SyllabusOut:
    return await syllabus_service.get_syllabus(current, syllabus_id)


@router.patch("/{syllabus_id}", response_model=SyllabusOut)
async def update_syllabus(
    syllabus_id: str,
    payload: SyllabusUpdateRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> SyllabusOut:
    return await syllabus_service.update_syllabus(current, syllabus_id, payload)


@router.delete("/{syllabus_id}", status_code=204)
async def delete_syllabus(
    syllabus_id: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> None:
    await syllabus_service.delete_syllabus(current, syllabus_id)
