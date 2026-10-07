"""User management endpoints for Super Admin."""
from typing import Any

from fastapi import APIRouter, Depends

from app.core.deps import CurrentUser, require_roles
from app.core.enums import Role
from app.core.exceptions import NotFoundError
from app.core.security import hash_password
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.common import PageParams, PageResponse

router = APIRouter(prefix="/users", tags=["users"])

_super_admin_only = require_roles(Role.SUPER_ADMIN)


class UserOut:
    pass


@router.get("")
async def list_users(
    school_id: str | None = None,
    role: str | None = None,
    search: str | None = None,
    params: PageParams = Depends(),
    current: CurrentUser = Depends(_super_admin_only),
) -> dict[str, Any]:
    """List all users across all schools (Super Admin only)."""
    query = User.find()

    if school_id:
        query = query.find(User.school_id == school_id)
    if role:
        query = query.find(User.role == role)
    if search:
        query = query.find({"$or": [
            {"email": {"$regex": search, "$options": "i"}},
            {"full_name": {"$regex": search, "$options": "i"}},
        ]})

    total = await query.count()
    users = await query.skip(params.skip).limit(params.page_size).to_list()

    # Get school names
    school_ids = list(set(u.school_id for u in users if u.school_id))
    schools = await Tenant.find({"_id": {"$in": school_ids}}).to_list() if school_ids else []
    school_map = {str(s.id): s.name for s in schools}

    items = []
    for u in users:
        items.append({
            "id": str(u.id),
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role,
            "school_id": u.school_id,
            "school_name": school_map.get(u.school_id) if u.school_id else None,
            "is_active": u.is_active,
            "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        })

    return {
        "items": items,
        "total": total,
        "page": params.page,
        "page_size": params.page_size,
    }


@router.get("/{user_id}")
async def get_user(
    user_id: str,
    current: CurrentUser = Depends(_super_admin_only),
) -> dict[str, Any]:
    """Get user details (Super Admin only)."""
    user = await User.get(user_id)
    if not user:
        raise NotFoundError("User not found")

    school_name = None
    if user.school_id:
        tenant = await Tenant.get(user.school_id)
        school_name = tenant.name if tenant else None

    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "role": user.role,
        "school_id": user.school_id,
        "school_name": school_name,
        "is_active": user.is_active,
        "must_change_password": user.must_change_password,
        "student_id": user.student_id,
        "teacher_id": user.teacher_id,
        "guardian_id": user.guardian_id,
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


@router.patch("/{user_id}")
async def update_user(
    user_id: str,
    payload: dict[str, Any],
    current: CurrentUser = Depends(_super_admin_only),
) -> dict[str, Any]:
    """Update user (Super Admin only)."""
    user = await User.get(user_id)
    if not user:
        raise NotFoundError("User not found")

    if "full_name" in payload:
        user.full_name = payload["full_name"]
    if "phone" in payload:
        user.phone = payload["phone"]
    if "is_active" in payload:
        user.is_active = payload["is_active"]
    if "password" in payload and payload["password"]:
        user.hashed_password = hash_password(payload["password"])
        user.must_change_password = True

    await user.save()

    return {"message": "User updated successfully", "id": str(user.id)}


@router.delete("/{user_id}")
async def deactivate_user(
    user_id: str,
    current: CurrentUser = Depends(_super_admin_only),
) -> dict[str, str]:
    """Deactivate user (Super Admin only). Does not delete."""
    user = await User.get(user_id)
    if not user:
        raise NotFoundError("User not found")

    user.is_active = False
    await user.save()

    return {"message": "User deactivated successfully"}


@router.post("/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    payload: dict[str, str],
    current: CurrentUser = Depends(_super_admin_only),
) -> dict[str, str]:
    """Reset user password (Super Admin only)."""
    user = await User.get(user_id)
    if not user:
        raise NotFoundError("User not found")

    new_password = payload.get("password", "TempPass123!")
    user.hashed_password = hash_password(new_password)
    user.must_change_password = True
    await user.save()

    return {"message": "Password reset successfully"}
