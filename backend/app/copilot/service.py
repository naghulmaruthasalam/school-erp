"""Chat pipeline for the two Copilot modes.

study   curriculum-grounded tutoring/teaching assistant: gate -> grounding (re-read every message) -> model
school  questions about the user's own ERP data: handled by the ERP assistant (Gemini function-calling over
        the role's tools when GEMINI_API_KEY is set, otherwise the built-in rule-based assistant)
"""
import logging
from collections.abc import AsyncIterator

from app.copilot import llm, safety, sessions
from app.copilot.grounding import StudyContext, build_study_context
from app.copilot.off_topic import inappropriate_reply, off_topic_reply
from app.copilot.profiles import FORMAT_RULES, SAFETY_RULES, Profile
from app.core.config import get_settings
from app.core.deps import CurrentUser
from app.core.enums import Role
from app.core.exceptions import ValidationAppError
from app.models.copilot import CopilotMessage, CopilotSession

logger = logging.getLogger("copilot.service")

_UNAVAILABLE = "Sorry, I'm having trouble answering right now. Please try again in a moment."
_NOT_CONFIGURED = (
    "The study assistant isn't set up on this school's server yet (the AI key is missing). "
    "You can still ask about school data in the \"My school\" tab."
)


def welcome_message(profile: Profile, mode: str, ctx: StudyContext | None) -> str:
    if mode == "school":
        return f"Hi! I'm your {profile.title}. Ask me about your own school information, for example attendance, homework, timetable or results."
    where = f" {ctx.label}" if ctx else ""
    return f"Hi! I'm your {profile.title}. I've loaded{where}. {profile.tagline}. What would you like to do?"


async def context_for_session(current: CurrentUser, session: CopilotSession) -> StudyContext | None:
    if session.mode != "study":
        return None
    c = session.context
    return await build_study_context(current, c["class_id"], c.get("subject_id"), c.get("chapter"), c.get("student_id"))


def _system_prompt(profile: Profile, ctx: StudyContext, language: str) -> str:
    material = (
        f"Curriculum material for this conversation:\n{ctx.text}"
        if ctx.text
        else "No textbook text is available for this subject, so rely on your subject knowledge at this class "
        "level and say so when you are unsure."
    )
    subject = f"Subject: {ctx.subject_name}\n" if ctx.subject_name else ""
    chapter = f"Chapter: {ctx.chapter}\n" if ctx.chapter else ""
    return (
        f"{profile.persona}\n\n{SAFETY_RULES}\n\n{FORMAT_RULES}\n\n"
        f"Class: {ctx.class_name}\n{subject}{chapter}"
        f"Default reply language: {language}. Reply in {language} even if the user writes in another language, "
        "unless they explicitly ask you to translate something.\n\n" + material
    )


async def _school_reply(current: CurrentUser, session: CopilotSession, message: str) -> str:
    settings = get_settings()
    if settings.gemini_api_key:
        try:
            from app.ai.assistant import run_assistant
            from app.ai.tools import get_tools_for_role

            tools, dispatch = get_tools_for_role(current.role)
            text, conversation_id = await run_assistant(current, message, tools, dispatch, session.ai_conversation_id)
            session.ai_conversation_id = conversation_id
            return text
        except Exception:  # noqa: BLE001
            logger.exception("ERP assistant failed; using the built-in assistant")
    from app.services.chatbot_service import process_chat

    try:
        return await process_chat(current, message)
    except Exception:  # noqa: BLE001
        logger.exception("Built-in assistant failed")
        return _UNAVAILABLE


async def _gate_reply(profile: Profile, session: CopilotSession, ctx: StudyContext | None, message: str) -> str | None:
    """A fixed reply if the message is unsafe or off-topic, else None."""
    scope = (f"{ctx.label} and closely related study topics" if ctx else None) or profile.scope
    if session.mode == "school":
        scope = f"{profile.scope}; the user's own school information"
    verdict = await safety.check(message, scope)
    if verdict.flagged:
        return inappropriate_reply(session.language)
    if not verdict.on_topic:
        return off_topic_reply(session.language)
    return None


def _history(session: CopilotSession, system: str, message: str) -> list[dict]:
    keep = get_settings().copilot_max_history_messages
    turns = [{"role": m.role, "content": m.content} for m in session.messages[-keep:]]
    return [{"role": "system", "content": system}, *turns, {"role": "user", "content": message}]


def _validate(message: str) -> str:
    message = message.strip()
    if not message:
        raise ValidationAppError("Type a message first")
    if len(message) > sessions.MAX_MESSAGE_CHARS:
        raise ValidationAppError(f"Messages can be at most {sessions.MAX_MESSAGE_CHARS} characters")
    return message


async def _finish(session: CopilotSession, message: str, reply: str) -> None:
    if not session.title:
        session.title = message[:60]
    session.messages.append(CopilotMessage(role="user", content=message))
    await sessions.append(session, "assistant", reply)


async def send_message(current: CurrentUser, profile: Profile, session: CopilotSession, message: str) -> dict:
    message = _validate(message)
    await sessions.enforce_rate_limit(current, get_settings().copilot_messages_per_minute)
    ctx = await context_for_session(current, session)
    fixed = await _gate_reply(profile, session, ctx, message)
    if fixed is not None:
        reply = fixed
    elif session.mode == "school":
        reply = await _school_reply(current, session, message)
    elif not llm.is_configured():
        reply = _NOT_CONFIGURED
    else:
        try:
            reply = await llm.call_chat(_history(session, _system_prompt(profile, ctx, session.language), message))
        except llm.LLMError:
            logger.exception("Copilot chat failed")
            reply = _UNAVAILABLE
    await _finish(session, message, reply)
    return {"reply": reply, "title": session.title}


async def stream_message(
    current: CurrentUser, profile: Profile, session: CopilotSession, message: str
) -> AsyncIterator[tuple[str, str | None]]:
    """Yields ("chunk", text) pieces then one ("done", title). Study replies stream from the model; fixed
    replies and school-data answers arrive as a single chunk."""
    message = _validate(message)
    await sessions.enforce_rate_limit(current, get_settings().copilot_messages_per_minute)
    ctx = await context_for_session(current, session)
    fixed = await _gate_reply(profile, session, ctx, message)
    parts: list[str] = []
    if fixed is not None:
        parts.append(fixed)
        yield ("chunk", fixed)
    elif session.mode == "school":
        reply = await _school_reply(current, session, message)
        parts.append(reply)
        yield ("chunk", reply)
    elif not llm.is_configured():
        parts.append(_NOT_CONFIGURED)
        yield ("chunk", _NOT_CONFIGURED)
    else:
        try:
            async for chunk in llm.call_chat_stream(_history(session, _system_prompt(profile, ctx, session.language), message)):
                parts.append(chunk)
                yield ("chunk", chunk)
        except llm.LLMError:
            logger.exception("Copilot stream failed")
            fallback = _UNAVAILABLE if not parts else "\n\n" + _UNAVAILABLE
            parts.append(fallback)
            yield ("chunk", fallback)
    await _finish(session, message, "".join(parts))
    yield ("done", session.title)
