from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, model_validator


class SchoolCreateRequest(BaseModel):
    # Tenant (school) fields
    name: str
    code: str | None = Field(default=None, description="Unique short code (auto-generated if not provided)")
    address: str | None = None
    city: str | None = None
    state: str | None = None
    country: str = "India"
    postal_code: str | None = None
    phone: str | None = None
    email: str | None = None
    academic_year_start_month: int = Field(default=6, ge=1, le=12)

    # First SCHOOL_ADMIN user to provision for this school
    admin_full_name: str
    admin_email: EmailStr
    admin_phone: str | None = None
    admin_password: str = Field(min_length=8, description="Admin password (min 8 chars)")
    admin_confirm_password: str

    @model_validator(mode="after")
    def passwords_match(self):
        if self.admin_password != self.admin_confirm_password:
            raise ValueError("Passwords do not match")
        return self


class SchoolUpdateRequest(BaseModel):
    name: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    postal_code: str | None = None
    phone: str | None = None
    email: str | None = None
    academic_year_start_month: int | None = Field(default=None, ge=1, le=12)
    logo_document_id: str | None = None
    is_active: bool | None = None


class SchoolOut(BaseModel):
    id: str
    name: str
    code: str
    address: str | None = None
    city: str | None = None
    state: str | None = None
    country: str
    postal_code: str | None = None
    phone: str | None = None
    email: str | None = None
    logo_document_id: str | None = None
    academic_year_start_month: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class SchoolCreateResponse(BaseModel):
    school: SchoolOut
    admin_user_id: str
    admin_email: EmailStr
