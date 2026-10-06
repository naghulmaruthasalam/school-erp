from dataclasses import dataclass

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer

from app.core.enums import Role
from app.core.exceptions import PermissionDeniedError, UnauthorizedError
from app.core.security import TokenType, decode_token
from app.core.tenant_db import set_current_tenant
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    """Authenticated identity for the request. Always use `.school_id` for tenant
    scoping — never trust a school_id supplied in the request body/query."""

    id: str
    school_id: str | None
    role: Role
    user: User


async def get_current_user(token: str | None = Depends(oauth2_scheme)) -> CurrentUser:
    if not token:
        raise UnauthorizedError()
    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise UnauthorizedError(str(exc)) from exc

    if payload.get("type") != TokenType.ACCESS.value:
        raise UnauthorizedError("Wrong token type")

    user_id = payload.get("sub")
    user = await User.get(user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("User not found or inactive")

    # Set the tenant database context for this request
    set_current_tenant(user.school_id)

    return CurrentUser(id=str(user.id), school_id=user.school_id, role=Role(user.role), user=user)


def require_roles(*roles: Role):
    async def _dep(current: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if current.role not in roles:
            raise PermissionDeniedError(f"Requires one of roles: {', '.join(r.value for r in roles)}")
        return current

    return _dep


async def require_tenant_user(current: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    """Any authenticated user belonging to a school (i.e. not SUPER_ADMIN)."""
    if current.school_id is None:
        raise PermissionDeniedError("This action requires a school-scoped account")
    return current
