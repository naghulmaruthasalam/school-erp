"""Connect a school to its curriculum file (JSON, CSV or a ZIP of them behind a link), keep it in sync, and load it
into the syllabus. Only the school's admin or principal manages the source; the Copilot and the Class -> Subject ->
Chapter browser then read the syllabus like any other.
"""
import asyncio
import base64
import hashlib
import io
import ipaddress
import logging
import re
import socket
import zipfile
from datetime import timedelta, timezone
from urllib.parse import unquote, urlparse

import httpx
from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings
from app.core.deps import CurrentUser
from app.core.enums import Role
from app.core.exceptions import AppError, NotFoundError, PermissionDeniedError, ValidationAppError
from app.models.base import utcnow
from app.models.curriculum_source import CurriculumSource
from app.services import syllabus_import_service as importer

logger = logging.getLogger("curriculum.source")

_MANAGE_ROLES = (Role.SCHOOL_ADMIN, Role.PRINCIPAL)
_ALLOWED_TARGETS = {"class", "subject", "chapter", "topics", "description", "content", "order"}
MAX_ZIP_FILES = 200
_transport: httpx.AsyncBaseTransport | None = None  # tests plug a fake transport in here


# ------------------------------------------------------------------ secrets

def _fernet() -> Fernet:
    digest = hashlib.sha256(("curriculum-source:" + get_settings().jwt_secret_key).encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def _encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def _decrypt(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken:
        raise ValidationAppError("The saved API key can't be read any more. Enter it again and save.") from None


# ------------------------------------------------------------------ url safety + fetch

def _check_url(url: str) -> str:
    parsed = urlparse(url.strip())
    allow_private = get_settings().curriculum_allow_private_urls
    if parsed.scheme not in ("https", "http") or not parsed.hostname:
        raise ValidationAppError("Enter a full link starting with https://")
    if parsed.scheme == "http" and not allow_private:
        raise ValidationAppError("Use an https:// link")
    if parsed.username or parsed.password:
        raise ValidationAppError("Don't put a user name or password in the link; use the API key field")
    if not allow_private:
        try:
            infos = socket.getaddrinfo(parsed.hostname, parsed.port or 443, proto=socket.IPPROTO_TCP)
        except socket.gaierror:
            raise ValidationAppError(f"Couldn't find the server '{parsed.hostname}'") from None
        for info in infos:
            ip = ipaddress.ip_address(info[4][0])
            if not ip.is_global:
                raise ValidationAppError("That address points to a private or internal network, which isn't allowed")
    return url.strip()


async def fetch(url: str, api_key: str | None, header: str) -> tuple[bytes, str]:
    """(bytes, file name). The link is checked, redirects aren't followed, the size is capped."""
    url = await asyncio.to_thread(_check_url, url)
    settings = get_settings()
    limit = settings.curriculum_fetch_max_mb * 1024 * 1024
    headers = {"Accept": "application/json, text/csv, application/zip, */*"}
    if api_key:
        name = (header or "Authorization").strip()
        headers[name] = f"Bearer {api_key}" if name.lower() == "authorization" and " " not in api_key else api_key
    try:
        async with httpx.AsyncClient(timeout=settings.curriculum_fetch_timeout_seconds, follow_redirects=False, transport=_transport) as client:
            async with client.stream("GET", url, headers=headers) as resp:
                if 300 <= resp.status_code < 400:
                    raise ValidationAppError("The link redirects somewhere else. Use the final link instead.")
                if resp.status_code in (401, 403):
                    raise AppError(502, f"The source refused access (HTTP {resp.status_code}). Check the API key, or that a pre-signed link hasn't expired.")
                if resp.status_code == 404:
                    raise AppError(502, "Nothing was found at that link (HTTP 404).")
                if resp.status_code >= 400:
                    raise AppError(502, f"The source answered with an error (HTTP {resp.status_code}).")
                chunks, size = [], 0
                async for chunk in resp.aiter_bytes():
                    size += len(chunk)
                    if size > limit:
                        raise ValidationAppError(f"The file is larger than {settings.curriculum_fetch_max_mb} MB")
                    chunks.append(chunk)
                disposition = resp.headers.get("content-disposition", "")
    except httpx.TimeoutException:
        raise AppError(502, "The source took too long to answer.") from None
    except httpx.HTTPError as exc:
        raise AppError(502, f"Couldn't reach the source ({type(exc).__name__}).") from None
    match = re.search(r'filename\*?=(?:UTF-8\'\')?"?([^";]+)', disposition)
    name = unquote(match.group(1)) if match else unquote(urlparse(url).path.rsplit("/", 1)[-1]) or "curriculum"
    return b"".join(chunks), name


# ------------------------------------------------------------------ parsing a whole download

def parse_download(name: str, data: bytes, field_map: dict, value_map: dict) -> tuple[list, list[str], dict]:
    """(rows, problems, info). ZIPs are opened; every .json/.csv inside is read."""
    rows: list = []
    problems: list[str] = []
    info = {"files": [], "skipped": []}
    if data[:2] == b"PK":
        try:
            zf = zipfile.ZipFile(io.BytesIO(data))
        except zipfile.BadZipFile:
            raise ValidationAppError("That ZIP file is damaged") from None
        entries = [e for e in zf.infolist() if not e.is_dir() and not e.filename.startswith("__MACOSX") and e.filename.lower().endswith((".json", ".csv"))]
        if len(entries) > MAX_ZIP_FILES:
            raise ValidationAppError(f"Too many files in the ZIP (limit {MAX_ZIP_FILES})")
        if sum(e.file_size for e in entries) > get_settings().curriculum_fetch_max_mb * 1024 * 1024 * 3:
            raise ValidationAppError("The ZIP expands to too much data")
        for e in entries:
            try:
                r, p = importer.parse_rows(e.filename, zf.read(e), field_map, value_map)
            except ValidationAppError as exc:
                info["skipped"].append(f"{e.filename}: {exc.detail}")
                continue
            if not r:  # e.g. a subjects/mapping file that sits next to the chapters
                info["skipped"].append(f"{e.filename}: no chapter records ({'; '.join(p[:1]) or 'empty'})")
                continue
            rows += r
            problems += [f"{e.filename}: {x}" for x in p]
            info["files"].append(e.filename)
        if not entries:
            raise ValidationAppError("The ZIP has no .json or .csv files")
    else:
        r, p = importer.parse_rows(name, data, field_map, value_map)
        rows, problems = r, p
        info["files"].append(name)
    if not rows:
        hint = "; ".join(problems[:3]) or "no chapter records were found"
        raise ValidationAppError(f"Nothing could be read from the source: {hint}")
    return rows, problems, info


# ------------------------------------------------------------------ settings

def _clean_maps(field_map: dict | None, value_map: dict | None) -> tuple[dict, dict]:
    fm = {str(k): str(v) for k, v in (field_map or {}).items()}
    bad = [v for v in fm.values() if v not in _ALLOWED_TARGETS]
    if bad:
        raise ValidationAppError(f"Field mapping can only point to: {', '.join(sorted(_ALLOWED_TARGETS))}")
    vm = {k: {str(a): str(b) for a, b in (v or {}).items()} for k, v in (value_map or {}).items() if k in ("class", "subject")}
    return fm, vm


def _require_manager(current: CurrentUser) -> None:
    if current.role not in _MANAGE_ROLES:
        raise PermissionDeniedError("Only the school admin or principal can manage the curriculum source")


def to_out(src: CurriculumSource | None) -> dict:
    if src is None:
        return {"configured": False}
    return {
        "configured": True, "url": src.url, "has_api_key": bool(src.api_key_encrypted), "api_key_header": src.api_key_header,
        "field_map": src.field_map, "value_map": src.value_map, "create_missing": src.create_missing, "mode": src.mode,
        "auto_sync_minutes": src.auto_sync_minutes, "last_synced_at": src.last_synced_at, "last_status": src.last_status,
        "last_message": src.last_message, "last_totals": src.last_totals,
    }


async def get_source(school_id: str) -> CurriculumSource | None:
    return await CurriculumSource.find_one(CurriculumSource.school_id == school_id)


async def read(current: CurrentUser) -> dict:
    _require_manager(current)
    return to_out(await get_source(current.school_id))


async def save(current: CurrentUser, payload: dict) -> dict:
    _require_manager(current)
    url = await asyncio.to_thread(_check_url, payload["url"])
    fm, vm = _clean_maps(payload.get("field_map"), payload.get("value_map"))
    minutes = int(payload.get("auto_sync_minutes") or 0)
    if minutes and not 15 <= minutes <= 10080:
        raise ValidationAppError("Auto-sync must be every 15 minutes to 7 days")
    src = await get_source(current.school_id) or CurriculumSource(school_id=current.school_id, url=url)
    if src.url != url:
        src.last_hash = None  # a different file: load it even if the bytes happen to match
    src.url = url
    key = payload.get("api_key")
    if key is not None:  # None = keep the saved key, "" = remove it
        src.api_key_encrypted = _encrypt(key.strip()) if key.strip() else None
    src.api_key_header = (payload.get("api_key_header") or "Authorization").strip()
    src.field_map, src.value_map = fm, vm
    src.create_missing = bool(payload.get("create_missing", True))
    src.mode = "replace" if payload.get("mode") == "replace" else "merge"
    src.auto_sync_minutes = minutes
    src.updated_by = str(current.user.id)
    src.updated_at = utcnow()
    await src.save()
    return to_out(src)


async def remove(current: CurrentUser) -> None:
    _require_manager(current)
    src = await get_source(current.school_id)
    if src is None:
        raise NotFoundError("No curriculum source is connected")
    await src.delete()


# ------------------------------------------------------------------ test + sync

async def _run(src_like: dict, school_id: str, user_id: str, *, dry_run: bool, force: bool, stored: CurriculumSource | None) -> dict:
    data, name = await fetch(src_like["url"], src_like["api_key"], src_like["api_key_header"])
    digest = hashlib.sha256(data + repr((src_like["field_map"], src_like["value_map"], src_like["mode"], src_like["create_missing"])).encode()).hexdigest()
    if not dry_run and not force and stored and stored.last_hash == digest:
        return {"unchanged": True, "dry_run": False, "message": "No changes since the last sync", "fetched_bytes": len(data)}
    rows, problems, info = parse_download(name, data, src_like["field_map"], src_like["value_map"])
    report = await importer.run_import(
        school_id, user_id, name, b"", dry_run=dry_run, create_missing=src_like["create_missing"], mode=src_like["mode"],
        rows_override=(rows, problems),
    )
    report.update({"unchanged": False, "fetched_bytes": len(data), "source_files": info["files"], "skipped_files": info["skipped"],
                   "records_read": len(rows), "_hash": digest})
    return report


async def test(current: CurrentUser, payload: dict) -> dict:
    """Fetch and preview using the form's values (falls back to the saved key when the form leaves it blank)."""
    _require_manager(current)
    stored = await get_source(current.school_id)
    fm, vm = _clean_maps(payload.get("field_map"), payload.get("value_map"))
    key = payload.get("api_key")
    api_key = key.strip() if key else (_decrypt(stored.api_key_encrypted) if stored and key is None else None)
    report = await _run(
        {"url": payload["url"], "api_key": api_key, "api_key_header": payload.get("api_key_header") or "Authorization",
         "field_map": fm, "value_map": vm, "mode": "replace" if payload.get("mode") == "replace" else "merge",
         "create_missing": bool(payload.get("create_missing", True))},
        current.school_id, str(current.user.id), dry_run=True, force=True, stored=None,
    )
    report.pop("_hash", None)
    return report


async def sync(school_id: str, user_id: str, *, force: bool = False) -> dict:
    src = await get_source(school_id)
    if src is None:
        raise NotFoundError("No curriculum source is connected. Save the link first.")
    try:
        report = await _run(
            {"url": src.url, "api_key": _decrypt(src.api_key_encrypted), "api_key_header": src.api_key_header,
             "field_map": src.field_map, "value_map": src.value_map, "mode": src.mode, "create_missing": src.create_missing},
            school_id, user_id, dry_run=False, force=force, stored=src,
        )
    except AppError as exc:
        src.last_status, src.last_message, src.last_synced_at = "error", exc.detail, utcnow()
        await src.save()
        raise
    digest = report.pop("_hash", None)
    src.last_synced_at = utcnow()
    if report.get("unchanged"):
        src.last_status, src.last_message = "unchanged", report["message"]
    else:
        src.last_hash = digest
        src.last_status = "ok"
        t = report["totals"]
        src.last_totals = t
        src.last_message = f"{t['chapters_added']} chapters added, {t['chapters_updated']} updated" + (f", {len(report['problems'])} problems" if report["problems"] else "")
    await src.save()
    return report


async def sync_as(current: CurrentUser, *, force: bool) -> dict:
    _require_manager(current)
    return await sync(current.school_id, str(current.user.id), force=force)


async def sync_due() -> None:
    """Run every source whose auto-sync interval has passed (called by the background loop)."""
    now = utcnow()
    for src in await CurriculumSource.find(CurriculumSource.auto_sync_minutes > 0).to_list():
        last = src.last_synced_at
        if last is not None and last.tzinfo is None:  # Mongo returns naive UTC
            last = last.replace(tzinfo=timezone.utc)
        if last is not None and now - last < timedelta(minutes=src.auto_sync_minutes):
            continue
        try:
            await sync(src.school_id, src.updated_by or "auto-sync")
        except Exception as exc:  # noqa: BLE001 - one school's bad link mustn't stop the others
            logger.warning("Curriculum auto-sync failed for school %s: %s", src.school_id, getattr(exc, "detail", type(exc).__name__))


async def auto_sync_loop() -> None:
    while True:
        await asyncio.sleep(300)
        try:
            await sync_due()
        except Exception:  # noqa: BLE001
            logger.exception("Curriculum auto-sync loop error")
