"""Copilot API: role-aware study + teaching assistant (see app/copilot/__init__.py)."""
import json
import logging

from fastapi import APIRouter, Depends
from fastapi.responses import Response, StreamingResponse

from app.copilot import files, grounding, llm, service, sessions
from app.copilot.deps import copilot_user
from app.copilot.features import FEATURES
from app.copilot.off_topic import LANGUAGES
from app.copilot.profiles import Profile, get_profile
from app.core.config import get_settings
from app.core.deps import CurrentUser, get_current_user, require_tenant_user
from app.core.exceptions import AppError, NotFoundError, PermissionDeniedError, ValidationAppError
from app.models.copilot import CopilotSession
from app.schemas.copilot import (
    MessageRequest,
    SessionOut,
    SessionSummary,
    StartSessionRequest,
    ToolRequest,
)

router = APIRouter(prefix="/copilot", tags=["copilot"])
logger = logging.getLogger(__name__)


def _profile(current: CurrentUser) -> Profile:
    return get_profile(current.role)  # copilot_user guarantees it exists


def _label(session: CopilotSession, context_label: str | None = None) -> str | None:
    c = session.context
    return context_label or c.get("label")


def _session_out(session: CopilotSession) -> SessionOut:
    return SessionOut(
        id=str(session.id),
        mode=session.mode,
        title=session.title,
        language=session.language,
        context=session.context,
        label=session.context.get("label"),
        messages=[{"role": m.role, "content": m.content, "at": m.at} for m in session.messages],
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


@router.get("/profile")
async def my_profile(current: CurrentUser = Depends(get_current_user)) -> dict:
    """What this role's Copilot looks like: persona, modes, quick actions and tools (with their form specs).
    Answers {"enabled": false} (not an error) when the Copilot isn't switched on for this user's role, so the
    app simply shows no Copilot button."""
    profile = get_profile(current.role)
    if current.role.value not in get_settings().copilot_roles or profile is None:
        return {"enabled": False, "role": current.role.value}
    if current.school_id is None:
        # The platform owner (super admin) has no school: one chat about platform data, no saved sessions or tools.
        return {
            "enabled": True, "platform": True, "role": current.role.value, "title": profile.title, "tagline": profile.tagline,
            "modes": ["school"], "default_mode": "school", "quick_actions": profile.quick_actions, "tools": [],
            "languages": LANGUAGES, "ai_configured": llm.is_configured(),
        }
    modes = ["school"] + (["study"] if profile.study_enabled else [])
    return {
        "enabled": True,
        "role": current.role.value,
        "title": profile.title,
        "tagline": profile.tagline,
        "modes": modes,
        "default_mode": "study" if profile.study_enabled else "school",
        "quick_actions": profile.quick_actions,
        "tools": [FEATURES[k].spec() for k in profile.tools if k in FEATURES],
        "languages": LANGUAGES,
        "ai_configured": llm.is_configured(),
    }


@router.get("/context")
async def my_context(current: CurrentUser = Depends(copilot_user)) -> dict:
    """Classes -> subjects -> chapters this user can study or teach (and a parent's children)."""
    return await grounding.context_options(current)


# ------------------------------------------------------------------ sessions

@router.post("/sessions", response_model=SessionOut, status_code=201)
async def start_session(payload: StartSessionRequest, current: CurrentUser = Depends(copilot_user)) -> SessionOut:
    profile = _profile(current)
    context: dict = {}
    study_ctx = None
    if payload.mode == "study":
        if not profile.study_enabled:
            raise ValidationAppError("Study help isn't available for your role")
        class_id = payload.class_id
        if class_id is None:
            allowed, child = await grounding.allowed_class_ids(current, payload.student_id)
            if allowed is not None and len(allowed) == 1:
                class_id = next(iter(allowed))
        if class_id is None:
            raise ValidationAppError("Choose a class first")
        study_ctx = await grounding.build_study_context(
            current, class_id, payload.subject_id, payload.chapter, payload.student_id
        )
        context = {
            "class_id": study_ctx.class_id,
            "subject_id": study_ctx.subject_id,
            "chapter": study_ctx.chapter,
            "student_id": study_ctx.student_id,
            "label": study_ctx.label,
        }
    session = await sessions.create_session(
        current, payload.mode, payload.language, context, service.welcome_message(profile, payload.mode, study_ctx)
    )
    return _session_out(session)


@router.get("/sessions", response_model=list[SessionSummary])
async def list_my_sessions(current: CurrentUser = Depends(copilot_user)) -> list[SessionSummary]:
    return [
        SessionSummary(
            id=str(s.id), mode=s.mode, title=s.title, label=s.context.get("label"),
            message_count=len(s.messages), updated_at=s.updated_at,
        )
        for s in await sessions.list_sessions(current)
    ]


@router.get("/sessions/{session_id}", response_model=SessionOut)
async def get_session(session_id: str, current: CurrentUser = Depends(copilot_user)) -> SessionOut:
    return _session_out(await sessions.get_owned(current, session_id))


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(session_id: str, current: CurrentUser = Depends(copilot_user)) -> None:
    await sessions.delete_session(current, session_id)


@router.post("/sessions/{session_id}/messages")
async def send_message(session_id: str, payload: MessageRequest, current: CurrentUser = Depends(copilot_user)) -> dict:
    session = await sessions.get_owned(current, session_id)
    return await service.send_message(current, _profile(current), session, payload.message)


@router.post("/sessions/{session_id}/messages/stream")
async def stream_message(session_id: str, payload: MessageRequest, current: CurrentUser = Depends(copilot_user)):
    """Same as /messages but streamed as Server-Sent Events:
    data: {"type":"chunk","text":"..."} ... then data: {"type":"done","title":"..."}"""
    session = await sessions.get_owned(current, session_id)
    profile = _profile(current)
    message = payload.message

    async def events():
        try:
            async for kind, value in service.stream_message(current, profile, session, message):
                body = {"type": "chunk", "text": value} if kind == "chunk" else {"type": "done", "title": value}
                yield f"data: {json.dumps(body)}\n\n"
        except AppError as exc:
            yield f"data: {json.dumps({'type': 'error', 'detail': exc.detail})}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ------------------------------------------------------------------ tools

@router.post("/tools/{key}")
async def run_tool(key: str, payload: ToolRequest, current: CurrentUser = Depends(copilot_user)) -> dict:
    profile = _profile(current)
    feature = FEATURES.get(key)
    if feature is None or key not in profile.tools:
        raise NotFoundError("Unknown tool")
    study_ctx = None
    if feature.needs_context:
        c = payload.context
        if not c.class_id:
            raise ValidationAppError("Choose a class first")
        study_ctx = await grounding.build_study_context(
            current, c.class_id, c.subject_id, c.chapter, c.student_id, require_subject=feature.require_subject
        )
        if feature.require_chapter and not study_ctx.chapter:
            raise ValidationAppError("Choose a chapter first")
    await sessions.enforce_rate_limit(current, get_settings().copilot_messages_per_minute)
    params = {**payload.params, "language": payload.language}
    try:
        return await feature.handler(current, study_ctx, params)
    except llm.LLMNotConfigured as exc:
        raise AppError(503, str(exc)) from exc
    except llm.LLMError as exc:
        logger.warning("Copilot tool %s failed: %s", key, exc)
        raise AppError(502, "The AI service is unavailable right now. Please try again in a moment.") from exc
    except ValueError as exc:  # pydantic validation of the tool's own params
        raise ValidationAppError(str(exc)) from exc


# ------------------------------------------------------------------ generated files (history)

@router.get("/files")
async def list_my_files(kind: str | None = None, current: CurrentUser = Depends(copilot_user)) -> list[dict]:
    """Documents the Copilot generated for this user (PDFs / text), newest first."""
    return [files.file_info(f) for f in await files.list_files(current, kind)]


@router.get("/files/{file_id}/download")
async def download_file(file_id: str, current: CurrentUser = Depends(copilot_user)) -> Response:
    record, data = await files.read_owned(current, file_id)
    return Response(
        content=data,
        media_type=record.content_type,
        headers={"Content-Disposition": f'attachment; filename="{record.filename}"', "X-Content-Type-Options": "nosniff"},
    )


@router.delete("/files/{file_id}", status_code=204)
async def delete_file(file_id: str, current: CurrentUser = Depends(copilot_user)) -> None:
    await files.delete_owned(current, file_id)
