from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from urllib.parse import quote

from fastapi import Response
from fastapi.responses import PlainTextResponse, RedirectResponse
from pydantic import BaseModel, Field

from app.core.deps import CurrentUser, require_tenant_user
from app.core.enums import DocumentModule, Role, SyllabusStatus
from app.core.lang import Lang, get_lang, normalize_lang
from app.models.syllabus import ChapterText
from app.core.s3 import build_object_key, generate_presigned_url_with_log, upload_bytes_with_log
from app.schemas.common import PageParams, PageResponse
from app.schemas.document import PresignedUrlOut
from app.schemas.syllabus import (
    SyllabusCreateRequest,
    SyllabusDocumentOut,
    SyllabusOut,
    SyllabusUpdateRequest,
)
from app.services import curriculum_service, curriculum_source_service, syllabus_import_service, syllabus_service, upload_service

router = APIRouter(prefix="/syllabus", tags=["syllabus"])


@router.post("", response_model=SyllabusOut, status_code=201)
async def create_syllabus(
    payload: SyllabusCreateRequest,
    current: CurrentUser = Depends(require_tenant_user),
    lang: Lang = Depends(get_lang),
) -> SyllabusOut:
    return await syllabus_service.create_syllabus(current, payload, lang)


@router.get("", response_model=PageResponse[SyllabusOut])
async def list_syllabus(
    class_id: str | None = None,
    subject_id: str | None = None,
    academic_year_id: str | None = None,
    status: SyllabusStatus | None = None,
    params: PageParams = Depends(),
    current: CurrentUser = Depends(require_tenant_user),
    lang: Lang = Depends(get_lang),
) -> PageResponse[SyllabusOut]:
    return await syllabus_service.list_syllabus(current, class_id, subject_id, academic_year_id, params, status, lang)


# Fixed paths first, so "documents", "tree" and "import" are never read as a syllabus id.


@router.get("/tree")
async def syllabus_tree(current: CurrentUser = Depends(require_tenant_user), lang: Lang = Depends(get_lang)) -> dict:
    """Class -> subject -> chapter outline for the browser (scoped to what the user may see), in the caller's language."""
    return await syllabus_service.get_tree(current, lang)


class SourceIn(BaseModel):
    url: str = Field(max_length=2000)
    api_key: str | None = Field(default=None, max_length=2000)  # omitted = keep the saved key, "" = remove it
    api_key_header: str = Field(default="Authorization", max_length=100)
    field_map: dict[str, str] = Field(default_factory=dict)
    value_map: dict[str, dict[str, str]] = Field(default_factory=dict)
    create_missing: bool = True
    mode: str = "merge"
    auto_sync_minutes: int = 0


@router.get("/source")
async def get_source(current: CurrentUser = Depends(require_tenant_user)) -> dict:
    """The school's curriculum source (a link to the syllabus file). The API key is never returned."""
    return await curriculum_source_service.read(current)


@router.put("/source")
async def save_source(payload: SourceIn, current: CurrentUser = Depends(require_tenant_user)) -> dict:
    return await curriculum_source_service.save(current, payload.model_dump())


@router.delete("/source", status_code=204)
async def delete_source(current: CurrentUser = Depends(require_tenant_user)) -> None:
    await curriculum_source_service.remove(current)


@router.post("/source/test")
async def test_source(payload: SourceIn, current: CurrentUser = Depends(require_tenant_user)) -> dict:
    """Fetch the link and preview what a sync would do. Nothing is saved."""
    return await curriculum_source_service.test(current, payload.model_dump())


@router.post("/source/sync")
async def sync_source(force: bool = False, current: CurrentUser = Depends(require_tenant_user)) -> dict:
    """Load the saved source into the syllabus now (skipped when the file is unchanged, unless force=true)."""
    return await curriculum_source_service.sync_as(current, force=force)


@router.post("/sync-curriculum")
async def sync_curriculum(
    dry_run: bool = True, create_missing: bool = False, current: CurrentUser = Depends(require_tenant_user)
) -> dict:
    """Load the textbook library (both languages) into this school's syllabus. Preview first (dry_run=true), then apply."""
    if current.role not in (Role.TEACHER, Role.SCHOOL_ADMIN, Role.PRINCIPAL):
        raise HTTPException(status_code=403, detail="Only teachers or school admins/principals can load the curriculum")
    return await curriculum_service.sync_to_syllabus(current.school_id, str(current.user.id), dry_run=dry_run, create_missing=create_missing)


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
    lang: Lang = Depends(get_lang),
) -> SyllabusOut:
    return await syllabus_service.get_syllabus(current, syllabus_id, lang)


@router.get("/{syllabus_id}/chapters/{chapter_index}/pdf")
async def chapter_pdf(
    syllabus_id: str,
    chapter_index: int,
    download: bool = False,
    current: CurrentUser = Depends(require_tenant_user),
    lang: Lang = Depends(get_lang),
) -> Response:
    """The chapter's notes from the database as a PDF to read (inline) or save (?download=true)."""
    data, name = await syllabus_service.chapter_pdf(current, syllabus_id, chapter_index, lang)
    disposition = "attachment" if download else "inline"
    return Response(data, media_type="application/pdf",
                    headers={"Content-Disposition": f"{disposition}; filename=\"chapter.pdf\"; filename*=UTF-8''{quote(name)}"})


@router.patch("/{syllabus_id}", response_model=SyllabusOut)
async def update_syllabus(
    syllabus_id: str,
    payload: SyllabusUpdateRequest,
    current: CurrentUser = Depends(require_tenant_user),
    lang: Lang = Depends(get_lang),
) -> SyllabusOut:
    return await syllabus_service.update_syllabus(current, syllabus_id, payload, lang)


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
    language: str = Form("en"),
    current: CurrentUser = Depends(require_tenant_user),
) -> dict:
    """Upload a video for a chapter, for one language ("en" = the chapter's own video, "ar" = the Arabic one). Students watch
    the video of the language they use in the app."""
    syllabus = await syllabus_service.get_syllabus_model(current, syllabus_id)

    if chapter_index < 0 or chapter_index >= len(syllabus.chapters):
        raise HTTPException(status_code=404, detail="Chapter not found")

    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video")

    data = await file.read()
    key = build_object_key(current.school_id, DocumentModule.SYLLABUS_DOCUMENT, file.filename or "video.mp4")

    await upload_bytes_with_log(key, data, file.content_type, current.school_id, current.id)

    video_url = await generate_presigned_url_with_log(key, school_id=current.school_id, user_id=current.id)

    chapter = syllabus.chapters[chapter_index]
    if normalize_lang(language) == "ar":
        tr = chapter.translations.setdefault("ar", ChapterText())
        tr.video_s3_key, tr.video_url = key, None
    else:
        chapter.video_s3_key, chapter.video_url = key, None
    await syllabus.save()

    return {"video_url": video_url, "s3_key": key, "language": normalize_lang(language)}
