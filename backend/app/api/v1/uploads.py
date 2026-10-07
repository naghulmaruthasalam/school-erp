import mimetypes
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, RedirectResponse

from app.core.deps import CurrentUser, require_tenant_user
from app.core.enums import DocumentModule
from app.core.s3 import LOCAL_UPLOADS_DIR, verify_local_signature
from app.schemas.common import PageParams, PageResponse
from app.schemas.document import DocumentOut, PresignedUrlOut
from app.services import upload_service

router = APIRouter(prefix="/uploads", tags=["uploads"])

# NOTE: the fixed paths (/documents..., /local/...) are declared before /{document_id}
# so FastAPI never mistakes the literal "documents" for a document id.


@router.post("", response_model=DocumentOut, status_code=201)
async def create_upload(
    file: UploadFile = File(...),
    module: DocumentModule = Form(...),
    linked_entity_type: str | None = Form(None),
    linked_entity_id: str | None = Form(None),
    current: CurrentUser = Depends(require_tenant_user),
) -> DocumentOut:
    return await upload_service.upload_document(current, file, module, linked_entity_type, linked_entity_id)


# --- Document manager (categories) ---------------------------------------------------------


@router.post("/documents", response_model=dict[str, Any], status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form("General"),
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Upload a school document into a category."""
    doc = await upload_service.upload_document(
        current, file, DocumentModule.OTHER, "school", current.school_id, category=category
    )
    return {
        **doc.model_dump(mode="json"),
        "uploaded_by_name": current.user.full_name,
    }


@router.get("/documents", response_model=PageResponse[dict[str, Any]])
async def list_documents(
    category: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    current: CurrentUser = Depends(require_tenant_user),
) -> PageResponse[dict[str, Any]]:
    """List the school's documents, optionally filtered by category."""
    return await upload_service.list_documents(current, PageParams(page=page, page_size=page_size), category)


@router.get("/documents/{document_id}/download")
async def download_document(
    document_id: str,
    current: CurrentUser = Depends(require_tenant_user),
):
    """Redirect to a short-lived link for the file."""
    url = await upload_service.get_document_url(current, document_id)
    return RedirectResponse(url=url)


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(
    document_id: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> None:
    await upload_service.delete_document(current, document_id)


@router.get("/local/{filename}")
async def serve_local_file(filename: str, expires: int = Query(...), sig: str = Query(...)):
    """Serves locally stored files when S3 isn't configured. Access needs a link signed by the API
    (the local equivalent of an S3 presigned URL), so files can't be fetched by guessing names."""
    if not verify_local_signature(filename, expires, sig):
        raise HTTPException(status_code=403, detail="This file link is invalid or has expired")

    base = LOCAL_UPLOADS_DIR.resolve()
    file_path = (base / filename).resolve()
    if base not in file_path.parents or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    return FileResponse(file_path, media_type=content_type)


# --- Single documents by id -----------------------------------------------------------------


@router.get("/{document_id}", response_model=DocumentOut)
async def get_upload(
    document_id: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> DocumentOut:
    return await upload_service.get_document(current, document_id)


@router.get("/{document_id}/url", response_model=PresignedUrlOut)
async def get_upload_url(
    document_id: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> PresignedUrlOut:
    url = await upload_service.get_document_url(current, document_id)
    return PresignedUrlOut(url=url)


@router.delete("/{document_id}", status_code=204)
async def delete_upload(
    document_id: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> None:
    await upload_service.delete_document(current, document_id)
