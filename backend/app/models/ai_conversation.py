from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.models.base import TenantDocument, utcnow


class ConversationMessage(BaseModel):
    role: Literal["user", "model", "tool"]
    content: str
    tool_calls: list[dict[str, Any]] | None = None
    timestamp: datetime = Field(default_factory=utcnow)


class AIConversation(TenantDocument):
    user_id: str
    role: str  # Role of the user at time of conversation (STUDENT/PARENT/...)
    messages: list[ConversationMessage] = Field(default_factory=list)

    class Settings:
        name = "ai_conversations"
        indexes = ["school_id", "user_id"]
