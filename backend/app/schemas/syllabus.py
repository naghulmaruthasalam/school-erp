from datetime import datetime

from pydantic import BaseModel, Field


class ChapterIn(BaseModel):
    name: str
    description: str | None = None
    order: int


class ChapterOut(BaseModel):
    name: str
    description: str | None = None
    order: int


class SyllabusCreateRequest(BaseModel):
    academic_year_id: str
    class_id: str
    subject_id: str
    title: str
    description: str | None = None
    chapters: list[ChapterIn] = Field(default_factory=list)
    document_ids: list[str] = Field(default_factory=list)


class SyllabusUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
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
    chapters: list[ChapterOut] = Field(default_factory=list)
    document_ids: list[str] = Field(default_factory=list)
    created_by: str
    created_at: datetime
    updated_at: datetime
