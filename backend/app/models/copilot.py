from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.models.base import TenantDocument, utcnow


class CopilotMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    at: datetime = Field(default_factory=utcnow)


class CopilotSession(TenantDocument):
    """One Copilot conversation. Owned by a single user; only the owner can read or continue it."""

    user_id: str
    role: str
    mode: Literal["study", "school"]
    title: str | None = None
    language: str = "English"
    # study mode: class_id / subject_id / chapter (+ student_id when a parent asks about a child)
    context: dict[str, Any] = Field(default_factory=dict)
    messages: list[CopilotMessage] = Field(default_factory=list)
    ai_conversation_id: str | None = None  # school mode: id of the ERP-assistant conversation

    class Settings:
        name = "copilot_sessions"
        indexes = ["school_id", "user_id"]


class CopilotFile(TenantDocument):
    """A document the Copilot generated for a user (worksheet / lesson plan / question paper / answer key /
    grading report). The bytes live in the normal file storage (S3 or local disk); this is the history row."""

    user_id: str
    kind: str  # worksheet | lesson_plan | question_paper | answer_key | grading_report
    title: str
    filename: str
    content_type: str
    size_bytes: int
    storage_key: str
    meta: dict[str, Any] = Field(default_factory=dict)

    class Settings:
        name = "copilot_files"
        indexes = ["school_id", "user_id", "kind"]
