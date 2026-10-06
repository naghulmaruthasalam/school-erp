from typing import Any

from beanie import Document
from pydantic import Field

from app.models.base import utcnow


class CloudServiceLog(Document):
    """Tracks usage of cloud services (AWS, GCP, etc.) for auditing and billing."""

    service_provider: str  # "aws", "gcp"
    service_name: str  # "s3", "vertex_ai"
    operation: str  # "upload", "delete", "generate_content"
    school_id: str | None = None
    user_id: str | None = None
    timestamp: Any = Field(default_factory=utcnow)
    details: dict[str, Any] = Field(default_factory=dict)
    success: bool = True
    error_message: str | None = None

    class Settings:
        name = "cloud_service_logs"
        indexes = ["service_provider", "service_name", "school_id", "timestamp"]
