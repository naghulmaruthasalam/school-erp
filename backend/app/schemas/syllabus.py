from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field

from app.core.enums import SyllabusStatus


class SyllabusStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"


class ChapterIn(BaseModel):
    id: str | None = None  # echoed back by the editor; chapters are stored by position
    name: str
    description: str | None = None
    order: int
    video_url: str | None = None
    duration_minutes: int | None = None
    topics: list[str] = Field(default_factory=list)
    content: str | None = None


class ChapterOut(BaseModel):
    id: str
    syllabus_id: str
    key: str | None = None  # the chapter's stored (English) name: stable across languages, what homework/papers are filed under
    name: str
    description: str | None = None
    order: int
    video_url: str | None = None
    duration_minutes: int | None = None
    topics: list[str] = Field(default_factory=list)
    content: str | None = None
    content_language: str | None = None  # language the notes are in (differs from the one asked for when only the other exists)
    languages: list[str] = Field(default_factory=list)  # languages this chapter has notes in
    video_language: str | None = None  # language of the video_url shown (the other one's when only that exists)
    video_languages: list[str] = Field(default_factory=list)


class SyllabusDocumentOut(BaseModel):
    id: str
    filename: str
    content_type: str | None = None
    size_bytes: int | None = None


class SyllabusCreateRequest(BaseModel):
    academic_year_id: str
    class_id: str
    subject_id: str
    title: str
    description: str | None = None
    status: SyllabusStatus = SyllabusStatus.DRAFT
    chapters: list[ChapterIn] = Field(default_factory=list)
    document_ids: list[str] = Field(default_factory=list)


class SyllabusUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    status: SyllabusStatus | None = None
    chapters: list[ChapterIn] | None = None
    document_ids: list[str] | None = None


class SyllabusOut(BaseModel):
    id: str
    school_id: str
    academic_year_id: str
    class_id: str
    subject_id: str
    title: str
    description: str | None = None
    status: SyllabusStatus
    chapters: list[ChapterOut] = Field(default_factory=list)
    chapters_count: int = 0
    document_ids: list[str] = Field(default_factory=list)
    documents: list[SyllabusDocumentOut] = Field(default_factory=list)
    created_by: str
    created_at: datetime
    updated_at: datetime
