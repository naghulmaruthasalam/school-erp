from app.core.enums import Role
from app.core.exceptions import NotFoundError, UnauthorizedError, ValidationAppError
from app.core.security import (
    TokenType,
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.core.tenant_db import set_current_tenant
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.auth import TokenResponse, UserOut
from app.services.email_service import send_email


async def _find_user_for_login(username: str, school_code: str | None) -> User | None:
    """Find user by username or email (student ID, teacher ID, or email for admins)."""
    if school_code:
        tenant = await Tenant.find_one(Tenant.code == school_code, Tenant.is_active == True)  # noqa: E712
        if tenant is None:
            return None
        user = await User.find_one(User.school_id == str(tenant.id), User.username == username)
        if user is None:
            user = await User.find_one(User.school_id == str(tenant.id), User.email == username)
        return user
    user = await User.find_one(User.school_id == None, User.username == username)  # noqa: E711
    if user is None:
        user = await User.find_one(User.school_id == None, User.email == username)  # noqa: E711
    return user


async def login(username: str, password: str, school_code: str | None) -> TokenResponse:
    """Login using username (student ID / teacher ID / admin email) and password."""
    user = await _find_user_for_login(username, school_code)
    if user is None or not user.is_active or not verify_password(password, user.hashed_password):
        raise UnauthorizedError("Invalid username or password")

    # Set tenant context for any subsequent operations
    set_current_tenant(user.school_id)

    from app.models.base import utcnow

    user.last_login_at = utcnow()
    await user.save()

    access = create_access_token(str(user.id), user.school_id, user.role.value)
    refresh = create_refresh_token(str(user.id))
    return TokenResponse(access_token=access, refresh_token=refresh)


async def demo_login(role: Role) -> TokenResponse:
    """Demo login - returns read-only token for exploring the portal."""
    demo_user_id = f"demo-{role.value.lower()}"
    demo_school_id = "demo-school"
    access = create_access_token(demo_user_id, demo_school_id, role.value, is_demo=True)
    refresh = create_refresh_token(demo_user_id)
    return TokenResponse(access_token=access, refresh_token=refresh)


async def refresh_access_token(refresh_token: str) -> TokenResponse:
    try:
        payload = decode_token(refresh_token)
    except ValueError as exc:
        raise UnauthorizedError(str(exc)) from exc

    if payload.get("type") != TokenType.REFRESH.value:
        raise UnauthorizedError("Wrong token type")

    user = await User.get(payload["sub"])
    if user is None or not user.is_active:
        raise UnauthorizedError("User not found or inactive")

    access = create_access_token(str(user.id), user.school_id, user.role.value)
    new_refresh = create_refresh_token(str(user.id))
    return TokenResponse(access_token=access, refresh_token=new_refresh)


async def request_password_reset(username: str, school_code: str | None, otp: str | None = None) -> dict:
    """Request password reset. Returns info for admin-assisted reset if no email configured."""
    user = await _find_user_for_login(username, school_code)
    if user is None:
        return {"message": "If account exists, reset info has been processed"}

    if user.email and otp:
        await send_email(
            to=user.email,
            subject="Password Reset OTP - Cogniitec School ERP",
            body=f"Hi {user.full_name},\n\nYour OTP for password reset is: {otp}\n\n"
            f"This OTP expires in 10 minutes. If you did not request this, ignore this email.",
        )
        return {"message": "OTP sent to registered email"}
    elif user.email:
        token = create_password_reset_token(str(user.id))
        reset_link = f"https://app.cogniitec.example/reset-password?token={token}"
        await send_email(
            to=user.email,
            subject="Reset your Cogniitec School ERP password",
            body=f"Hi {user.full_name},\n\nUse this link to reset your password:\n{reset_link}\n\n"
            "This link expires in 1 hour. If you did not request this, ignore this email.",
        )
        return {"message": "Reset link sent to registered email"}
    else:
        return {"message": "No email configured. Contact school admin to reset password.", "needs_admin": True}


async def reset_password(token: str, new_password: str) -> None:
    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise UnauthorizedError("Invalid or expired reset link") from exc

    if payload.get("type") != TokenType.PASSWORD_RESET.value:
        raise UnauthorizedError("Wrong token type")

    user = await User.get(payload["sub"])
    if user is None:
        raise NotFoundError("User not found")

    if len(new_password) < 8:
        raise ValidationAppError("Password must be at least 8 characters")

    user.hashed_password = hash_password(new_password)
    user.must_change_password = False
    await user.save()


async def reset_password_by_username(username: str, new_password: str, school_code: str | None) -> None:
    """Admin-assisted password reset using username."""
    user = await _find_user_for_login(username, school_code)
    if user is None:
        raise NotFoundError("User not found")

    if len(new_password) < 8:
        raise ValidationAppError("Password must be at least 8 characters")

    user.hashed_password = hash_password(new_password)
    user.must_change_password = False
    await user.save()


async def change_password(user: User, current_password: str, new_password: str) -> None:
    if not verify_password(current_password, user.hashed_password):
        raise UnauthorizedError("Current password is incorrect")
    if len(new_password) < 8:
        raise ValidationAppError("Password must be at least 8 characters")
    user.hashed_password = hash_password(new_password)
    user.must_change_password = False
    await user.save()


def to_user_out(user: User) -> UserOut:
    return UserOut(
        id=str(user.id),
        school_id=user.school_id,
        username=user.username,
        email=user.email,
        role=Role(user.role),
        full_name=user.full_name,
        phone=user.phone,
        student_id=user.student_id,
        teacher_id=user.teacher_id,
        guardian_id=user.guardian_id,
    )
