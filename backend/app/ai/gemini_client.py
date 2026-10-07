"""Gemini AI client using the free-tier API key."""

from functools import lru_cache

import google.generativeai as genai

from app.core.config import get_settings
from app.core.cloud_logger import log_gcp_vertex_ai

settings = get_settings()


@lru_cache
def _init_gemini() -> None:
    if not settings.gemini_api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not configured — set it in .env before using AI features."
        )
    genai.configure(api_key=settings.gemini_api_key)


def get_model(system_instruction: str | None = None) -> genai.GenerativeModel:
    _init_gemini()
    return genai.GenerativeModel(
        model_name=settings.gemini_model_name,
        system_instruction=system_instruction,
    )


async def generate_content_with_log(
    prompt: str,
    system_instruction: str | None = None,
    school_id: str | None = None,
    user_id: str | None = None,
):
    """Generate content using Gemini and log the operation."""
    model = get_model(system_instruction=system_instruction)
    try:
        response = model.generate_content(prompt)
        tokens_used = None
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            tokens_used = getattr(response.usage_metadata, "total_token_count", None)
        await log_gcp_vertex_ai(
            operation="generate_content",
            model_name=settings.gemini_model_name,
            school_id=school_id,
            user_id=user_id,
            tokens_used=tokens_used,
        )
        return response
    except Exception as e:
        await log_gcp_vertex_ai(
            operation="generate_content",
            model_name=settings.gemini_model_name,
            school_id=school_id,
            user_id=user_id,
            success=False,
            error_message=str(e),
        )
        raise
