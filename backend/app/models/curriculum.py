"""Curriculum content model for syllabus and teacher copilot features."""
from datetime import datetime
from typing import Optional

from beanie import Document
from pydantic import BaseModel, Field

from app.models.base import utcnow


class PageContent(BaseModel):
    page_number: int
    text: str


class CurriculumMetadata(BaseModel):
    curriculum: str | None = None
    semester: str | None = None
    grade_level: str | None = None
    content_type: str | None = None


class CurriculumResource(BaseModel):
    """Attached resource (video, PDF, image) for a curriculum unit."""
    resource_type: str  # video, pdf, image, audio
    title: str
    description: str | None = None
    document_id: str | None = None  # S3 document ID
    url: str | None = None  # External URL
    duration_seconds: int | None = None  # For video/audio
    file_size_bytes: int | None = None


class CurriculumUnit(Document):
    """Stores textbook/curriculum content for grades and subjects."""

    school_id: str | None = None

    grade: int = Field(default=0)
    subject: str
    language: str = "en"

    unit_number: int
    unit_title_ar: str | None = None
    unit_title_en: str | None = None

    source_zip: str | None = None
    source_file: str | None = None
    total_pages: int = 0
    file_size_bytes: int = 0
    content_hash_md5: str | None = None

    full_text: str = ""
    pages: list[PageContent] = Field(default_factory=list)
    resources: list[CurriculumResource] = Field(default_factory=list)

    metadata: CurriculumMetadata | None = None

    # Set when this unit is a machine translation of the same unit in the other language (an original has none of these).
    translated_from: str | None = None  # "en" or "ar": the language it was translated from
    translation_status: str | None = None  # needs_review (a check found something) | ai_checked (checked, nothing found) | reviewed (a person approved it)
    translation_source_hash: str | None = None  # hash of the source text it was made from; a changed source means it is out of date
    translation_flags: list[str] = Field(default_factory=list)  # what the automatic checks found
    translated_at: datetime | None = None
    reviewed_by: str | None = None
    reviewed_at: datetime | None = None

    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "curriculum_units"
        indexes = [
            "school_id",
            "grade",
            "subject",
            "unit_number",
            [("grade", 1), ("subject", 1)],
            [("grade", 1), ("subject", 1), ("unit_number", 1)],
            [("school_id", 1), ("grade", 1), ("subject", 1)],
        ]

