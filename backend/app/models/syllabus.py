from datetime import datetime

from pydantic import BaseModel, Field

from app.core.enums import SyllabusStatus
from app.models.base import TenantDocument


class Chapter(BaseModel):
    name: str
    description: str | None = None
    order: int


class Syllabus(TenantDocument):
    academic_year_id: str
    class_id: str
    subject_id: str
    title: str
    description: str | None = None
    chapters: list[Chapter] = Field(default_factory=list)
    status: SyllabusStatus = SyllabusStatus.PUBLISHED
    document_ids: list[str] = Field(default_factory=list)
    created_by: str  # user_id of creator

    class Settings:
        name = "syllabus"
        indexes = ["school_id", "academic_year_id", "class_id", "subject_id"]
