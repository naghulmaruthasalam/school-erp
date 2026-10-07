from datetime import datetime

from pydantic import BaseModel

from app.core.enums import DocumentModule


class DocumentOut(BaseModel):
    id: str
    school_id: str
    module: DocumentModule
    content_type: str
    size_bytes: int
    original_filename: str
    uploaded_by: str
    linked_entity_type: str | None = None
    linked_entity_id: str | None = None
    url: str
    created_at: datetime
    updated_at: datetime


class PresignedUrlOut(BaseModel):
    url: str
