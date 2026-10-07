from pydantic import BaseModel

from app.core.enums import Role


class LoginRequest(BaseModel):
    username: str  # Student ID / Teacher ID / Admin email
    password: str
    school_code: str | None = None


class DemoLoginRequest(BaseModel):
    role: Role


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    username: str  # Student ID / Teacher ID / Admin email
    school_code: str | None = None


class VerifyOtpRequest(BaseModel):
    username: str
    otp: str
    school_code: str | None = None


class ResetPasswordWithOtpRequest(BaseModel):
    username: str
    otp: str
    new_password: str
    confirm_password: str
    school_code: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class UserOut(BaseModel):
    id: str
    school_id: str | None
    username: str | None = None  # Student ID / Teacher ID / Admin email
    email: str | None = None
    role: Role
    full_name: str
    phone: str | None = None
    student_id: str | None = None
    teacher_id: str | None = None
    guardian_id: str | None = None
