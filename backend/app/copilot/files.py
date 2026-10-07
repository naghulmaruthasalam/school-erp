"""History of documents the Copilot generated for a user, stored in the normal file storage (S3 or local disk).
Only the owner can list, download or delete them. Each kind is capped (oldest pruned first)."""
import logging
import re
import uuid

from app.core.config import get_settings
from app.core.deps import CurrentUser
from app.core.exceptions import AppError, NotFoundError, PermissionDeniedError
from app.core.s3 import delete_object, read_bytes, upload_bytes
from app.models.copilot import CopilotFile

logger = logging.getLogger("copilot.files")

KINDS = ("worksheet", "lesson_plan", "question_paper", "answer_key", "grading_report")
KEEP_PER_KIND = 20


def _safe_name(title: str, ext: str) -> str:
    stem = re.sub(r"[^A-Za-z0-9._-]+", "_", title).strip("._") or "document"
    return f"{stem[:60]}.{ext}"


async def save_generated(
    current: CurrentUser, kind: str, title: str, data: bytes, ext: str, content_type: str, meta: dict | None = None
) -> CopilotFile:
    if kind not in KINDS:
        raise ValueError(f"unknown file kind {kind!r}")
    key = f"{current.school_id}/copilot/{current.id}/{kind}/{uuid.uuid4().hex}.{ext}"
    try:
        upload_bytes(key, data, content_type)
    except Exception as exc:  # noqa: BLE001
        logger.error("Saving generated file failed: %s", type(exc).__name__)
        raise AppError(502, "File storage is unavailable. Check the S3 / storage configuration.") from exc
    record = CopilotFile(
        school_id=current.school_id, user_id=current.id, kind=kind, title=title, filename=_safe_name(title, ext),
        content_type=content_type, size_bytes=len(data), storage_key=key, meta=meta or {},
    )
    await record.insert()
    await _prune(current, kind)
    return record


async def _prune(current: CurrentUser, kind: str) -> None:
    rows = await (
        CopilotFile.find(CopilotFile.school_id == current.school_id, CopilotFile.user_id == current.id, CopilotFile.kind == kind)
        .sort(-CopilotFile.created_at)
        .to_list()
    )
    for old in rows[KEEP_PER_KIND:]:
        try:
            delete_object(old.storage_key)
        except Exception:  # noqa: BLE001 - a missing object must not block the history
            logger.warning("Could not delete stored file %s", old.storage_key)
        await old.delete()


async def list_files(current: CurrentUser, kind: str | None = None) -> list[CopilotFile]:
    query = [CopilotFile.school_id == current.school_id, CopilotFile.user_id == current.id]
    if kind:
        query.append(CopilotFile.kind == kind)
    return await CopilotFile.find(*query).sort(-CopilotFile.created_at).to_list()


async def get_owned(current: CurrentUser, file_id: str) -> CopilotFile:
    record = await CopilotFile.get(file_id) if len(file_id) == 24 else None
    if record is None or record.school_id != current.school_id:
        raise NotFoundError("File not found")
    if record.user_id != current.id:
        raise PermissionDeniedError("You don't have access to this file")
    return record


async def read_owned(current: CurrentUser, file_id: str) -> tuple[CopilotFile, bytes]:
    record = await get_owned(current, file_id)
    try:
        return record, read_bytes(record.storage_key)
    except Exception as exc:  # noqa: BLE001
        raise NotFoundError("The stored file is no longer available") from exc


async def delete_owned(current: CurrentUser, file_id: str) -> None:
    record = await get_owned(current, file_id)
    try:
        delete_object(record.storage_key)
    except Exception:  # noqa: BLE001
        logger.warning("Could not delete stored file %s", record.storage_key)
    await record.delete()


def file_info(record: CopilotFile) -> dict:
    return {
        "id": str(record.id), "kind": record.kind, "title": record.title, "filename": record.filename,
        "content_type": record.content_type, "size_bytes": record.size_bytes, "created_at": record.created_at,
        "meta": record.meta,
    }
