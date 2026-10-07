"""Persisted, owner-scoped Copilot sessions."""
from datetime import datetime, timedelta, timezone

from app.core.deps import CurrentUser
from app.core.exceptions import AppError, NotFoundError, PermissionDeniedError
from app.models.base import utcnow
from app.models.copilot import CopilotMessage, CopilotSession

MAX_MESSAGE_CHARS = 2000
MAX_SESSIONS_LISTED = 50


async def create_session(
    current: CurrentUser, mode: str, language: str, context: dict, welcome: str
) -> CopilotSession:
    session = CopilotSession(
        school_id=current.school_id,
        user_id=current.id,
        role=current.role.value,
        mode=mode,
        language=language,
        context=context,
        messages=[CopilotMessage(role="assistant", content=welcome)],
    )
    await session.insert()
    return session


async def get_owned(current: CurrentUser, session_id: str) -> CopilotSession:
    session = await CopilotSession.get(session_id) if len(session_id) == 24 else None
    if session is None or session.school_id != current.school_id:
        raise NotFoundError("Chat session not found")
    if session.user_id != current.id:
        raise PermissionDeniedError("You don't have access to this chat session")
    return session


async def list_sessions(current: CurrentUser) -> list[CopilotSession]:
    return await (
        CopilotSession.find(CopilotSession.school_id == current.school_id, CopilotSession.user_id == current.id)
        .sort(-CopilotSession.updated_at)
        .limit(MAX_SESSIONS_LISTED)
        .to_list()
    )


async def delete_session(current: CurrentUser, session_id: str) -> None:
    await (await get_owned(current, session_id)).delete()


async def enforce_rate_limit(current: CurrentUser, per_minute: int) -> None:
    """Counts the user's messages from the last minute across their sessions (works across replicas)."""
    cutoff = utcnow() - timedelta(minutes=1)
    recent = await CopilotSession.find(
        CopilotSession.school_id == current.school_id,
        CopilotSession.user_id == current.id,
        CopilotSession.updated_at >= cutoff,
    ).to_list()
    def aware(value: datetime) -> datetime:  # MongoDB hands datetimes back without a timezone (UTC)
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)

    count = sum(1 for s in recent for m in s.messages if m.role == "user" and aware(m.at) >= cutoff)
    if count >= per_minute:
        raise AppError(429, "You're sending messages too quickly. Please wait a moment and try again.")


async def append(session: CopilotSession, role: str, content: str) -> None:
    session.messages.append(CopilotMessage(role=role, content=content))
    session.updated_at = utcnow()
    await session.save()
