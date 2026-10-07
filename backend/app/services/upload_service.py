from typing import Any

from fastapi import UploadFile

from app.core.deps import CurrentUser
from app.core.enums import STAFF_ROLES, DocumentModule, Role
from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationAppError
from app.core.s3 import build_object_key, delete_object, generate_presigned_get_url, upload_bytes
from app.models.document import Document
from app.models.guardian import Guardian
from app.schemas.common import PageParams, PageResponse
from app.schemas.document import DocumentOut

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


def to_document_out(document: Document, url: str) -> DocumentOut:
    return DocumentOut(
        id=str(document.id),
        school_id=document.school_id,
        module=document.module,
        content_type=document.content_type,
        size_bytes=document.size_bytes,
        original_filename=document.original_filename,
        uploaded_by=document.uploaded_by,
        linked_entity_type=document.linked_entity_type,
        linked_entity_id=document.linked_entity_id,
        url=url,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


async def _is_authorized_for_link(
    current: CurrentUser, linked_entity_type: str | None, linked_entity_id: str | None
) -> bool:
    """Whether `current` is plausibly authorized to attach/access a document
    linked to (linked_entity_type, linked_entity_id). Staff are handled by
    callers before reaching here."""
    if linked_entity_type is None or linked_entity_id is None:
        return False
    if linked_entity_type != "student":
        return False
    if current.role == Role.STUDENT:
        return linked_entity_id == current.user.student_id
    if current.role == Role.PARENT:
        if not current.user.guardian_id:
            return False
        guardian = await Guardian.get(current.user.guardian_id)
        if guardian is None:
            return False
        return linked_entity_id in guardian.student_ids
    return False


async def _check_upload_permission(
    current: CurrentUser, linked_entity_type: str | None, linked_entity_id: str | None
) -> None:
    if linked_entity_type is None and linked_entity_id is None:
        return  # unlinked upload - any authenticated tenant user may create one
    if current.role in STAFF_ROLES:
        return
    if not await _is_authorized_for_link(current, linked_entity_type, linked_entity_id):
        raise PermissionDeniedError("You are not authorized to attach a document to this entity")


async def _check_read_permission(current: CurrentUser, document: Document) -> None:
    if current.role in STAFF_ROLES:
        return
    if document.uploaded_by == current.id:
        return
    if not await _is_authorized_for_link(current, document.linked_entity_type, document.linked_entity_id):
        raise PermissionDeniedError("You are not authorized to access this document")


async def _check_delete_permission(current: CurrentUser, document: Document) -> None:
    if current.role in STAFF_ROLES:
        return
    if document.uploaded_by == current.id:
        return
    raise PermissionDeniedError("You are not authorized to delete this document")


async def _get_document_in_school(school_id: str, document_id: str) -> Document:
    document = await Document.get(document_id)
    if document is None or document.school_id != school_id:
        raise NotFoundError("Document not found")
    return document


async def upload_document(
    current: CurrentUser,
    file: UploadFile,
    module: DocumentModule,
    linked_entity_type: str | None,
    linked_entity_id: str | None,
) -> DocumentOut:
    await _check_upload_permission(current, linked_entity_type, linked_entity_id)

    data = await file.read()
    if len(data) > MAX_FILE_SIZE_BYTES:
        raise ValidationAppError("File exceeds the maximum allowed size of 10MB")

    filename = file.filename or "upload"
    content_type = file.content_type or "application/octet-stream"

    key = build_object_key(current.school_id, module, filename)
    upload_bytes(key, data, content_type)

    document = Document(
        school_id=current.school_id,
        module=module,
        s3_key=key,
        content_type=content_type,
        size_bytes=len(data),
        original_filename=filename,
        uploaded_by=current.id,
        linked_entity_type=linked_entity_type,
        linked_entity_id=linked_entity_id,
    )
    await document.insert()

    url = generate_presigned_get_url(key)
    return to_document_out(document, url)


async def get_document(current: CurrentUser, document_id: str) -> DocumentOut:
    document = await _get_document_in_school(current.school_id, document_id)
    await _check_read_permission(current, document)
    url = generate_presigned_get_url(document.s3_key)
    return to_document_out(document, url)


async def get_document_url(current: CurrentUser, document_id: str) -> str:
    document = await _get_document_in_school(current.school_id, document_id)
    await _check_read_permission(current, document)
    return generate_presigned_get_url(document.s3_key)


async def delete_document(current: CurrentUser, document_id: str) -> None:
    document = await _get_document_in_school(current.school_id, document_id)
    await _check_delete_permission(current, document)
    delete_object(document.s3_key)
    await document.delete()


async def list_documents(
    current: CurrentUser,
    params: PageParams | None = None,
) -> PageResponse[dict[str, Any]]:
    """List all documents for the school."""
    params = params or PageParams()

    query = Document.find(Document.school_id == current.school_id)
    total = await query.count()
    documents = await query.sort(-Document.created_at).skip(params.skip).limit(params.page_size).to_list()

    items = []
    for doc in documents:
        items.append({
            "id": str(doc.id),
            "filename": doc.s3_key.split("/")[-1] if doc.s3_key else "",
            "original_filename": doc.original_filename,
            "content_type": doc.content_type,
            "size": doc.size_bytes,
            "category": "General",  # Default category
            "uploaded_by": doc.uploaded_by,
            "uploaded_by_name": doc.uploaded_by,  # Would need to lookup user
            "created_at": doc.created_at.isoformat() if doc.created_at else "",
        })

    return PageResponse(
        items=items,
        total=total,
        page=params.page,
        page_size=params.page_size,
    )
