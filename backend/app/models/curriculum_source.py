from datetime import datetime
from typing import Any

from pydantic import Field

from app.models.base import TenantDocument


class CurriculumSource(TenantDocument):
    """Where a school's curriculum content lives (a link to a JSON/CSV/ZIP file, e.g. a pre-signed S3 URL)."""

    url: str
    api_key_encrypted: str | None = None  # never returned by the API
    api_key_header: str = "Authorization"  # "Authorization" sends "Bearer <key>"; anything else sends the raw key
    field_map: dict[str, str] = Field(default_factory=dict)  # source field -> class|subject|chapter|topics|description|content|order
    value_map: dict[str, dict[str, str]] = Field(default_factory=dict)  # {"class": {id: name}, "subject": {id: name}}
    create_missing: bool = True  # create classes/subjects that don't exist yet
    mode: str = "merge"  # merge | replace
    auto_sync_minutes: int = 0  # 0 = manual only
    last_hash: str | None = None
    last_synced_at: datetime | None = None
    last_status: str | None = None  # ok | unchanged | error
    last_message: str | None = None
    last_totals: dict[str, Any] = Field(default_factory=dict)
    updated_by: str | None = None

    class Settings:
        name = "curriculum_sources"
        indexes = ["school_id"]
