import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import CurrentUser, get_current_user
from app.core.enums import Role
from app.schemas.auth import (
    ChangePasswordRequest,
    DemoLoginRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshRequest,
    ResetPasswordRequest,
    ResetPasswordWithOtpRequest,
    TokenResponse,
    UserOut,
    VerifyOtpRequest,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

_otp_store: dict[str, tuple[str, datetime]] = {}
OTP_EXPIRY_MINUTES = 10


def _generate_otp() -> str:
    return "".join([str(secrets.randbelow(10)) for _ in range(6)])


def _store_otp(username: str, school_code: str | None) -> str:
    key = f"{username}:{school_code or ''}"
    otp = _generate_otp()
    _otp_store[key] = (otp, datetime.utcnow() + timedelta(minutes=OTP_EXPIRY_MINUTES))
    return otp


def _verify_otp(username: str, school_code: str | None, otp: str) -> bool:
    key = f"{username}:{school_code or ''}"
    stored = _otp_store.get(key)
    if not stored:
        return False
    stored_otp, expiry = stored
    if datetime.utcnow() > expiry:
        del _otp_store[key]
        return False
    if stored_otp != otp:
        return False
    del _otp_store[key]
    return True


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest) -> TokenResponse:
    return await auth_service.login(payload.username, payload.password, payload.school_code)


@router.post("/demo-login", response_model=TokenResponse)
async def demo_login(payload: DemoLoginRequest) -> TokenResponse:
    return await auth_service.demo_login(payload.role)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(payload: RefreshRequest) -> TokenResponse:
    return await auth_service.refresh_access_token(payload.refresh_token)


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest) -> dict:
    otp = _store_otp(payload.username, payload.school_code)
    result = await auth_service.request_password_reset(payload.username, payload.school_code, otp)
    return result


@router.post("/verify-otp")
async def verify_otp(payload: VerifyOtpRequest) -> dict[str, bool]:
    key = f"{payload.username}:{payload.school_code or ''}"
    stored = _otp_store.get(key)
    if not stored:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    stored_otp, expiry = stored
    if datetime.utcnow() > expiry:
        del _otp_store[key]
        raise HTTPException(status_code=400, detail="OTP has expired")
    if stored_otp != payload.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    return {"valid": True}


@router.post("/reset-password-otp", status_code=204)
async def reset_password_with_otp(payload: ResetPasswordWithOtpRequest) -> None:
    if not _verify_otp(payload.username, payload.school_code, payload.otp):
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")
    if payload.new_password != payload.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    await auth_service.reset_password_by_username(payload.username, payload.new_password, payload.school_code)


@router.post("/reset-password", status_code=204)
async def reset_password(payload: ResetPasswordRequest) -> None:
    await auth_service.reset_password(payload.token, payload.new_password)


@router.post("/change-password", status_code=204)
async def change_password(
    payload: ChangePasswordRequest,
    current: CurrentUser = Depends(get_current_user),
) -> None:
    await auth_service.change_password(current.user, payload.current_password, payload.new_password)


@router.get("/me", response_model=UserOut)
async def me(current: CurrentUser = Depends(get_current_user)) -> UserOut:
    return auth_service.to_user_out(current.user)
