from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class StartSessionRequest(BaseModel):
    mode: Literal["study", "school"] = "study"
    language: str = Field(default="English", max_length=30)
    class_id: str | None = None
    subject_id: str | None = None
    chapter: str | None = Field(default=None, max_length=300)
    student_id: str | None = None  # parents: which child


class MessageRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    language: str | None = Field(default=None, max_length=30)  # "auto"/None: answer in the language of the message


class ToolContext(BaseModel):
    class_id: str | None = None
    subject_id: str | None = None
    chapter: str | None = Field(default=None, max_length=300)
    student_id: str | None = None


class ToolRequest(BaseModel):
    context: ToolContext = Field(default_factory=ToolContext)
    params: dict[str, Any] = Field(default_factory=dict)
    language: str = Field(default="English", max_length=30)


class MessageOut(BaseModel):
    role: str
    content: str
    at: datetime


class SessionOut(BaseModel):
    id: str
    mode: str
    title: str | None = None
    language: str
    context: dict[str, Any]
    label: str | None = None
    messages: list[MessageOut]
    created_at: datetime
    updated_at: datetime


class SessionSummary(BaseModel):
    id: str
    mode: str
    title: str | None = None
    label: str | None = None
    message_count: int
    updated_at: datetime


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1500)
    language: str = Field(default="English", max_length=30)
