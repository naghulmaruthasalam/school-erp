"""Gemini AI client for homework validation and teacher copilot features."""
from __future__ import annotations

import asyncio
from typing import Any

from app.core.config import get_settings

settings = get_settings()

_client = None
_attempted = False


class GeminiNotConfigured(Exception):
    """Raised when GEMINI_API_KEY is not set."""
    pass


class GeminiError(Exception):
    """Wraps any failure from the Gemini SDK."""
    pass


def get_client():
    global _client, _attempted
    if not _attempted:
        _attempted = True
        if settings.gemini_api_key:
            from google import genai
            _client = genai.Client(api_key=settings.gemini_api_key)
    return _client


def _require_client():
    client = get_client()
    if client is None:
        raise GeminiNotConfigured("GEMINI_API_KEY must be set for AI features.")
    return client


async def generate(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.4,
    json_mode: bool = False,
) -> str:
    """Generate text response from Gemini."""
    from google.genai import types

    client = _require_client()
    config_kwargs: dict[str, Any] = {
        "system_instruction": system_prompt,
        "temperature": temperature,
    }
    if json_mode:
        config_kwargs["response_mime_type"] = "application/json"

    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=settings.gemini_model_name or "gemini-2.0-flash",
            contents=user_prompt,
            config=types.GenerateContentConfig(**config_kwargs),
        )
    except Exception as exc:
        raise GeminiError(str(exc)) from exc

    return response.text or ""


async def generate_vision(
    system_prompt: str,
    user_prompt: str,
    images: list[bytes],
    temperature: float = 0.4,
) -> str:
    """Generate response from Gemini with image inputs."""
    from google.genai import types

    client = _require_client()
    parts = [types.Part.from_bytes(data=img, mime_type="image/jpeg") for img in images]
    parts.append(types.Part.from_text(text=user_prompt))

    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=settings.gemini_model_name or "gemini-2.0-flash",
            contents=parts,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=temperature,
                response_mime_type="application/json",
            ),
        )
    except Exception as exc:
        raise GeminiError(str(exc)) from exc

    return response.text or ""
