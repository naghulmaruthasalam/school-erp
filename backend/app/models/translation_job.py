"""A background run that translates textbook units into the other language, with progress the UI can poll."""
from datetime import datetime

from beanie import Document
from pydantic import Field

from app.models.base import utcnow


class TranslationJob(Document):
    school_id: str | None = None  # None: started by a platform super admin (applies to every school)
    created_by: str
    grade: int | None = None
    subject: str | None = None
    unit_number: int | None = None
    target: str = "ar"  # ar | en | both
    force: bool = False
    status: str = "queued"  # queued | running | done | failed
    total: int = 0
    translated: int = 0
    skipped: int = 0
    failed: int = 0
    messages: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utcnow)
    finished_at: datetime | None = None

    class Settings:
        name = "translation_jobs"
        indexes = ["school_id", "created_at"]
