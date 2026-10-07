from dataclasses import dataclass
from datetime import datetime

from pydantic import BaseModel, Field

from app.core.enums import SyllabusStatus
from app.models.base import TenantDocument


class ChapterText(BaseModel):
    """A chapter's text in another language (the chapter's own fields are the English text)."""
    name: str | None = None
    description: str | None = None
    topics: list[str] = Field(default_factory=list)
    content: str | None = None


@dataclass
class LocalizedChapter:
    name: str
    description: str | None
    topics: list[str]
    content: str | None
    content_language: str | None  # the language the notes are actually in (may differ from the one asked for)
    languages: list[str]  # languages this chapter has notes in


class Chapter(BaseModel):
    name: str
    description: str | None = None
    order: int
    video_url: str | None = None  # S3 presigned URL or external video link
    video_s3_key: str | None = None  # S3 object key for generating fresh URLs
    duration_minutes: int | None = None
    topics: list[str] = Field(default_factory=list)  # sub-topics inside the chapter
    content: str | None = None  # study notes / textbook text for the chapter (what the Copilot reads)
    translations: dict[str, ChapterText] = Field(default_factory=dict)  # e.g. {"ar": ...}; same chapter, other language

    def localized(self, lang: str) -> LocalizedChapter:
        """This chapter in `lang`, falling back field by field to the other language when a translation is missing."""
        tr = self.translations.get(lang) if lang != "en" else None
        notes = {"en": (self.content or "").strip(), **{k: (v.content or "").strip() for k, v in self.translations.items()}}
        languages = [k for k, v in notes.items() if v]
        served = lang if notes.get(lang) else next((k for k in ("en", *self.translations) if notes.get(k)), None)
        text = notes.get(served) if served else None
        if tr is None:
            return LocalizedChapter(self.name, self.description, list(self.topics), text or None, served, languages)
        return LocalizedChapter(
            tr.name or self.name, tr.description or self.description, list(tr.topics or self.topics), text or None, served, languages,
        )

    def names(self) -> set[str]:
        return {n.strip().lower() for n in (self.name, *(t.name for t in self.translations.values() if t.name)) if n}

    def matches(self, name: str | None) -> bool:
        return bool(name) and name.strip().lower() in self.names()


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
