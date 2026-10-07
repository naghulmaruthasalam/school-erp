from app.core.enums import DocumentModule
from app.models.base import TenantDocument


class Document(TenantDocument):
    module: DocumentModule
    s3_key: str
    content_type: str
    size_bytes: int
    original_filename: str
    uploaded_by: str  # User id
    linked_entity_type: str | None = None  # e.g. "student", "teacher", "homework"
    linked_entity_id: str | None = None
    category: str = "General"  # document-manager category (Circular, Policy, Form...)

    class Settings:
        name = "documents"
        indexes = ["school_id", "linked_entity_type", "linked_entity_id"]
