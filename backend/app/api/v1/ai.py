import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.deps import CurrentUser, require_roles
from app.core.enums import Role
from app.schemas.ai import AiChatRequest, AiChatResponse
from app.services.chatbot_service import process_chat

router = APIRouter(prefix="/ai", tags=["ai"])
logger = logging.getLogger(__name__)
settings = get_settings()


class HomeworkGenerateRequest(BaseModel):
    subject: str
    grade: str
    topic: str
    difficulty: str = "medium"
    chapter_content: str | None = None
    language: str = "english"


class HomeworkGenerateResponse(BaseModel):
    content: str


async def _chat(current: CurrentUser, payload: AiChatRequest) -> AiChatResponse:
    """Answer with Gemini (function calling over the role's tools) when GEMINI_API_KEY is set;
    otherwise, or if Gemini fails, answer with the built-in assistant that reads school data."""
    if settings.gemini_api_key:
        try:
            from app.ai.assistant import run_assistant
            from app.ai.tools import get_tools_for_role

            tools, dispatch = get_tools_for_role(current.role)
            text, conversation_id = await run_assistant(
                current, payload.message, tools, dispatch, payload.conversation_id
            )
            return AiChatResponse(response=text, conversation_id=conversation_id)
        except Exception:
            logger.exception("Gemini assistant failed; falling back to the built-in assistant")

    try:
        response_text = await process_chat(current, payload.message)
    except Exception:
        logger.exception("Chatbot error")
        response_text = (
            "Sorry, I encountered an error. Please try again later.\n\n"
            "For technical issues or further clarification:\n"
            "📞 Phone: +91 98765 43210\n📧 Email: support@cogniitec.com"
        )
    return AiChatResponse(
        response=response_text,
        conversation_id=payload.conversation_id or str(uuid.uuid4()),
    )


@router.post("/student", response_model=AiChatResponse)
async def student_assistant(
    payload: AiChatRequest, current: CurrentUser = Depends(require_roles(Role.STUDENT))
) -> AiChatResponse:
    return await _chat(current, payload)


@router.post("/parent", response_model=AiChatResponse)
async def parent_assistant(
    payload: AiChatRequest, current: CurrentUser = Depends(require_roles(Role.PARENT))
) -> AiChatResponse:
    return await _chat(current, payload)


@router.post("/teacher", response_model=AiChatResponse)
async def teacher_assistant(
    payload: AiChatRequest, current: CurrentUser = Depends(require_roles(Role.TEACHER))
) -> AiChatResponse:
    return await _chat(current, payload)


@router.post("/principal", response_model=AiChatResponse)
async def principal_assistant(
    payload: AiChatRequest, current: CurrentUser = Depends(require_roles(Role.PRINCIPAL))
) -> AiChatResponse:
    return await _chat(current, payload)


@router.post("/admin", response_model=AiChatResponse)
async def admin_assistant(
    payload: AiChatRequest,
    current: CurrentUser = Depends(require_roles(Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)),
) -> AiChatResponse:
    return await _chat(current, payload)


@router.post("/generate-homework", response_model=HomeworkGenerateResponse)
async def generate_homework_content(
    payload: HomeworkGenerateRequest,
    current: CurrentUser = Depends(require_roles(Role.TEACHER, Role.SCHOOL_ADMIN, Role.PRINCIPAL)),
) -> HomeworkGenerateResponse:
    """Generate homework using AI based on subject, grade, topic."""
    if not settings.gemini_api_key:
        raise HTTPException(
            status_code=503,
            detail="The AI homework generator is not configured. Set GEMINI_API_KEY on the server.",
        )
    try:
        from app.ai.assistant import generate_homework
        content = await generate_homework(
            current=current,
            subject=payload.subject,
            grade=payload.grade,
            topic=payload.topic,
            difficulty=payload.difficulty,
            chapter_content=payload.chapter_content,
            language=payload.language,
        )
        return HomeworkGenerateResponse(content=content)
    except Exception as exc:
        logger.exception("Homework generation failed")
        raise HTTPException(status_code=500, detail=f"Failed to generate homework: {str(exc)}")
