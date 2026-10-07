from datetime import datetime

import pymongo
from beanie import Document, Indexed
from pydantic import Field

from app.core.enums import Role
from app.models.base import utcnow


class User(Document):
    """Unified auth identity for every role. school_id is None only for SUPER_ADMIN."""

    school_id: str | None = None
    username: str | None = None  # Student admission_no / Teacher emp_id / email for admins
    email: str | None = None  # Optional email for notifications
    hashed_password: str
    role: Role
    full_name: str
    phone: str | None = None
    is_active: bool = True
    must_change_password: bool = False

    # Exactly one of these is set, matching `role`.
    student_id: str | None = None
    teacher_id: str | None = None
    guardian_id: str | None = None

    last_login_at: datetime | None = None
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)

    class Settings:
        name = "users"
        indexes = [
            pymongo.IndexModel(
                [("school_id", pymongo.ASCENDING), ("username", pymongo.ASCENDING)],
                unique=True,
                name="uniq_school_username",
                partialFilterExpression={"username": {"$type": "string"}},
            ),
        ]
