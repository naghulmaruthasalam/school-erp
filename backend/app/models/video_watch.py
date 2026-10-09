"""How often students have watched a chapter video to the end: one record per student, chapter and video language."""
from datetime import datetime

from app.models.base import TenantDocument


class VideoWatch(TenantDocument):
    syllabus_id: str
    chapter_key: str  # the chapter's (English) name, which is what identifies it across languages and re-ordering
    language: str  # "en" or "ar": the language of the video that was watched
    student_id: str
    views: int = 1  # completed watches (the video played to its end)
    first_at: datetime
    last_at: datetime

    class Settings:
        name = "video_watches"
        indexes = ["school_id", "syllabus_id", "student_id", [("school_id", 1), ("student_id", 1), ("syllabus_id", 1)]]
