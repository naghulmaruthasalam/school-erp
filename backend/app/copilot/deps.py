"""FastAPI dependencies shared by every Copilot router."""
import logging
from contextlib import asynccontextmanager

from fastapi import Depends

from app.copilot.profiles import get_profile
from app.core.config import get_settings
from app.core.deps import CurrentUser, require_tenant_user
from app.core.enums import Role
from app.copilot import llm
from app.core.exceptions import AppError, PermissionDeniedError


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


logger = logging.getLogger("copilot.api")


@asynccontextmanager
async def guard_llm(what: str):
    """Turn model failures into clean API errors: 503 when no key is configured, 502 when the model call fails."""
    try:
        yield
    except llm.LLMNotConfigured as exc:
        raise AppError(503, str(exc)) from exc
    except llm.LLMError as exc:
        logger.warning("Copilot %s failed: %s", what, exc)
        raise AppError(502, "The AI service is unavailable right now. Please try again in a moment.") from exc
