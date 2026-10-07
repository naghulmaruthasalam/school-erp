from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from app.core.deps import CurrentUser, require_tenant_user
from app.core.enums import DocumentModule
from app.core.s3 import LOCAL_UPLOADS_DIR
from app.schemas.common import PageParams, PageResponse
from app.schemas.document import DocumentOut, PresignedUrlOut
from app.services import upload_service

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("", response_model=DocumentOut, status_code=201)
async def create_upload(
    file: UploadFile = File(...),
    module: DocumentModule = Form(...),
    linked_entity_type: str | None = Form(None),
    linked_entity_id: str | None = Form(None),
    current: CurrentUser = Depends(require_tenant_user),
) -> DocumentOut:
    return await upload_service.upload_document(current, file, module, linked_entity_type, linked_entity_id)


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


# Document management endpoints (with category support)
@router.post("/documents", response_model=dict[str, Any], status_code=201)
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form("General"),
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Upload a document with category."""
    doc = await upload_service.upload_document(
        current, file, DocumentModule.OTHER, "school", current.school_id
    )
    # Add category to the response
    return {
        **doc.model_dump(),
        "category": category,
        "uploaded_by": str(current.user.id),
        "uploaded_by_name": current.user.full_name,
    }


@router.get("/documents", response_model=PageResponse[dict[str, Any]])
async def list_documents(
    category: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current: CurrentUser = Depends(require_tenant_user),
) -> PageResponse[dict[str, Any]]:
    """List all documents for the school."""
    docs = await upload_service.list_documents(current, PageParams(page=page, page_size=page_size))
    # Filter by category if provided (category stored in filename prefix)
    items = docs.items
    if category:
        items = [d for d in items if d.get("category", "General") == category]
    return PageResponse(
        items=items,
        total=len(items),
        page=page,
        page_size=page_size,
    )


@router.get("/documents/{document_id}/download")
async def download_document(
    document_id: str,
    current: CurrentUser = Depends(require_tenant_user),
):
    """Download a document."""
    doc = await upload_service.get_document(current, document_id)
    url = await upload_service.get_document_url(current, document_id)
    # Return redirect to the presigned URL
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=url)


@router.delete("/documents/{document_id}", status_code=204)
async def delete_document(
    document_id: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> None:
    """Delete a document."""
    await upload_service.delete_document(current, document_id)


@router.get("/local/{filename}")
async def serve_local_file(filename: str):
    """Serve locally stored files (development only)."""
    file_path = LOCAL_UPLOADS_DIR / filename
    if not file_path.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="File not found")

    import mimetypes
    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    return FileResponse(file_path, media_type=content_type)
