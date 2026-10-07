from datetime import datetime

from pydantic import BaseModel, Field

from app.core.enums import SyllabusStatus
from app.models.base import TenantDocument


class Chapter(BaseModel):
    name: str
    description: str | None = None
    order: int
    video_url: str | None = None  # S3 presigned URL or external video link
    video_s3_key: str | None = None  # S3 object key for generating fresh URLs
    duration_minutes: int | None = None
    topics: list[str] = Field(default_factory=list)  # sub-topics inside the chapter
    content: str | None = None  # study notes / textbook text for the chapter (what the Copilot reads)


class Syllabus(TenantDocument):
    academic_year_id: str
    class_id: str
    subject_id: str
    title: str
    description: str | None = None
    status: SyllabusStatus = SyllabusStatus.PUBLISHED
    chapters: list[Chapter] = Field(default_factory=list)
    document_ids: list[str] = Field(default_factory=list)
    created_by: str  # user_id of creator

    class Settings:
        name = "syllabus"
        indexes = ["school_id", "academic_year_id", "class_id", "subject_id"]
