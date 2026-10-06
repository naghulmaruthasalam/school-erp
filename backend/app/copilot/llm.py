"""Provider layer shared by the chat pipeline, the safety gate and every tool.

COPILOT_LLM_PROVIDER=gemini (default, uses GEMINI_API_KEY / GEMINI_MODEL_NAME) or openai
(OPENAI_API_KEY / OPENAI_MODEL). Every call retries with back-off and raises LLMError on failure, so
callers decide how to degrade (a friendly in-chat message, a 502 from a tool, ...).
"""
import asyncio
import json
import logging
from collections.abc import AsyncIterator

from app.core.config import get_settings

logger = logging.getLogger("copilot.llm")

LLM_TIMEOUT_SECONDS = 60.0


class LLMError(Exception):
    """The model call failed, timed out or returned unusable output."""


class LLMNotConfigured(LLMError):
    """No API key for the selected provider."""


def provider() -> str:
    return (get_settings().copilot_llm_provider or "gemini").lower()


def is_configured() -> bool:
    s = get_settings()
    return bool(s.openai_api_key) if provider() == "openai" else bool(s.gemini_api_key)


def _require_configured() -> None:
    if not is_configured():
        key = "OPENAI_API_KEY" if provider() == "openai" else "GEMINI_API_KEY"
        raise LLMNotConfigured(f"The AI model is not configured. Set {key} on the server.")


# ---------------------------------------------------------------- Gemini

def _gemini_model(system_instruction: str | None = None):
    import google.generativeai as genai

    s = get_settings()
    genai.configure(api_key=s.gemini_api_key)
    return genai.GenerativeModel(s.gemini_model_name, system_instruction=system_instruction)


def _gemini_history(messages: list[dict]) -> tuple[str | None, list[dict], str]:
    """OpenAI-style messages -> (system, history, last user message) for Gemini's chat API."""
    system = next((m["content"] for m in messages if m["role"] == "system"), None)
    turns = [m for m in messages if m["role"] != "system"]
    if not turns or turns[-1]["role"] != "user":
        raise LLMError("The last message must come from the user")
    history = [
        {"role": "model" if m["role"] == "assistant" else "user", "parts": [m["content"]]} for m in turns[:-1]
    ]
    return system, history, turns[-1]["content"]


async def _gemini_generate(system: str, user: str, json_mode: bool, temperature: float, retries: int) -> str:
    model = _gemini_model(system)
    config = {"temperature": temperature}
    if json_mode:
        config["response_mime_type"] = "application/json"
    last: Exception | None = None
    for attempt in range(retries + 1):
        try:
            response = await asyncio.wait_for(
                model.generate_content_async(user, generation_config=config), LLM_TIMEOUT_SECONDS
            )
            return response.text
        except Exception as exc:  # noqa: BLE001 - the SDK has no narrow exception hierarchy
            last = exc
            logger.warning("Gemini call failed (attempt %s/%s): %s", attempt + 1, retries + 1, exc)
        if attempt < retries:
            await asyncio.sleep(2**attempt)
    raise LLMError(f"Gemini call failed after {retries + 1} attempts: {last}")


# ---------------------------------------------------------------- OpenAI

_openai_client = None


def _openai():
    global _openai_client
    if _openai_client is None:
        from openai import AsyncOpenAI

        _openai_client = AsyncOpenAI(api_key=get_settings().openai_api_key, timeout=LLM_TIMEOUT_SECONDS)
    return _openai_client


async def _openai_complete(messages: list[dict], json_mode: bool, temperature: float, retries: int) -> str:
    kwargs = {"response_format": {"type": "json_object"}} if json_mode else {}
    last: Exception | None = None
    for attempt in range(retries + 1):
        try:
            response = await _openai().chat.completions.create(
                model=get_settings().openai_model, messages=messages, temperature=temperature, **kwargs
            )
            content = response.choices[0].message.content
            if content is None:
                raise ValueError("the model returned no content (likely filtered)")
            return content
        except Exception as exc:  # noqa: BLE001
            last = exc
            logger.warning("OpenAI call failed (attempt %s/%s): %s", attempt + 1, retries + 1, exc)
        if attempt < retries:
            await asyncio.sleep(2**attempt)
    raise LLMError(f"OpenAI call failed after {retries + 1} attempts: {last}")


# ---------------------------------------------------------------- public API

async def call_text(system: str, user: str, retries: int = 2, temperature: float = 0.5) -> str:
    _require_configured()
    if provider() == "openai":
        return await _openai_complete(
            [{"role": "system", "content": system}, {"role": "user", "content": user}], False, temperature, retries
        )
    return await _gemini_generate(system, user, False, temperature, retries)


async def call_json(system: str, user: str, retries: int = 2) -> dict:
    """Ask for a JSON object and return it parsed."""
    _require_configured()
    if provider() == "openai":
        raw = await _openai_complete(
            [{"role": "system", "content": system}, {"role": "user", "content": user}], True, 0.4, retries
        )
    else:
        raw = await _gemini_generate(system, user, True, 0.4, retries)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise LLMError(f"The model returned invalid JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise LLMError("The model returned JSON that is not an object")
    return data


async def call_chat(messages: list[dict], retries: int = 2) -> str:
    """messages: [{"role": "system"|"user"|"assistant", "content": str}, ...] ending with a user turn."""
    _require_configured()
    if provider() == "openai":
        return await _openai_complete(messages, False, 0.5, retries)
    system, history, last = _gemini_history(messages)
    model = _gemini_model(system)
    err: Exception | None = None
    for attempt in range(retries + 1):
        try:
            chat = model.start_chat(history=history)
            response = await asyncio.wait_for(chat.send_message_async(last), LLM_TIMEOUT_SECONDS)
            return response.text
        except Exception as exc:  # noqa: BLE001
            err = exc
            logger.warning("Gemini chat failed (attempt %s/%s): %s", attempt + 1, retries + 1, exc)
        if attempt < retries:
            await asyncio.sleep(2**attempt)
    raise LLMError(f"Gemini chat failed after {retries + 1} attempts: {err}")


async def call_chat_stream(messages: list[dict]) -> AsyncIterator[str]:
    """Yield the reply piece by piece. Raises LLMError if the stream cannot start or breaks."""
    _require_configured()
    try:
        if provider() == "openai":
            stream = await _openai().chat.completions.create(
                model=get_settings().openai_model, messages=messages, temperature=0.5, stream=True
            )
            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
            return
        system, history, last = _gemini_history(messages)
        chat = _gemini_model(system).start_chat(history=history)
        response = await chat.send_message_async(last, stream=True)
        async for chunk in response:
            text = getattr(chunk, "text", "")
            if text:
                yield text
    except LLMError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.warning("LLM stream failed: %s", exc)
        raise LLMError(f"The model stream failed: {exc}") from exc
