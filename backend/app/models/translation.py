"""Cache of machine translations of short pieces of dynamic content (names, titles, notices) shown in the UI."""
from datetime import datetime

from beanie import Document
from pydantic import Field

from app.models.base import utcnow


class TranslationCache(Document):
    key: str  # sha1 of target + source text
    target: str  # "ar" or "en"
    source: str
    translated: str
    created_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "translation_cache"
        indexes = ["key"]
