from fastapi import APIRouter, Depends, File, UploadFile, HTTPException

from app.core.deps import CurrentUser, require_tenant_user
from app.core.enums import DocumentModule
from app.core.s3 import build_object_key, upload_bytes_with_log, generate_presigned_url_with_log
from app.schemas.common import PageParams, PageResponse
from app.schemas.syllabus import (
    SyllabusCreateRequest,
    SyllabusOut,
    SyllabusUpdateRequest,
)
from app.services import syllabus_service

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
    status: str | None = None,
    params: PageParams = Depends(),
    current: CurrentUser = Depends(require_tenant_user),
) -> PageResponse[SyllabusOut]:
    return await syllabus_service.list_syllabus(current, class_id, subject_id, academic_year_id, status, params)


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


@router.post("/{syllabus_id}/chapters/{chapter_index}/video")
async def upload_chapter_video(
    syllabus_id: str,
    chapter_index: int,
    file: UploadFile = File(...),
    current: CurrentUser = Depends(require_tenant_user),
) -> dict:
    """Upload video for a specific chapter. Stores in S3 and updates chapter's video_url."""
    syllabus = await syllabus_service.get_syllabus_model(current, syllabus_id)

    if chapter_index < 0 or chapter_index >= len(syllabus.chapters):
        raise HTTPException(status_code=404, detail="Chapter not found")

    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video")

    data = await file.read()
    key = build_object_key(current.school_id, DocumentModule.SYLLABUS, file.filename or "video.mp4")

    await upload_bytes_with_log(key, data, file.content_type, current.school_id, current.id)

    video_url = await generate_presigned_url_with_log(key, school_id=current.school_id, user_id=current.id)

    syllabus.chapters[chapter_index].video_s3_key = key
    syllabus.chapters[chapter_index].video_url = video_url
    await syllabus.save()

    return {"video_url": video_url, "s3_key": key}
