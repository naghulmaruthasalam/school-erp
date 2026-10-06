"""FastAPI dependencies shared by every Copilot router."""
from fastapi import Depends

from app.copilot.profiles import get_profile
from app.core.config import get_settings
from app.core.deps import CurrentUser, require_tenant_user
from app.core.enums import Role
from app.core.exceptions import PermissionDeniedError


async def copilot_user(current: CurrentUser = Depends(require_tenant_user)) -> CurrentUser:
    """Any school user whose role has the Copilot enabled (COPILOT_ENABLED_ROLES)."""
    if current.role.value not in get_settings().copilot_roles or get_profile(current.role) is None:
        raise PermissionDeniedError("The Copilot isn't enabled for your role")
    return current


async def copilot_teacher(current: CurrentUser = Depends(copilot_user)) -> CurrentUser:
    """Teachers (and only teachers) for the teaching-only tools: question papers and answer-sheet grading."""
    if current.role != Role.TEACHER:
        raise PermissionDeniedError("This tool is for teachers")
    return current
