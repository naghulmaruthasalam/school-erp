"""Translate dynamic UI text (see services/translate_service.py)."""
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.deps import CurrentUser, get_current_user
from app.copilot import llm
from app.services import translate_service

router = APIRouter(prefix="/i18n", tags=["i18n"])


class TranslateRequest(BaseModel):
    texts: list[str] = Field(max_length=translate_service.MAX_ITEMS)
    target: str = "ar"


@router.post("/translate")
async def translate(payload: TranslateRequest, current: CurrentUser = Depends(get_current_user)) -> dict:
    return {
        "available": llm.is_configured(),
        "translations": await translate_service.translate_texts(payload.texts, payload.target),
    }
