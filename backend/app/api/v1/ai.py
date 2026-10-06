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


class HomeworkGenerateResponse(BaseModel):
    content: str


async def _chat(current: CurrentUser, payload: AiChatRequest) -> AiChatResponse:
    """Process chat using local chatbot service (works with school data)."""
    try:
        # Use local chatbot that queries school database
        response_text = await process_chat(current, payload.message)
        return AiChatResponse(
            response=response_text,
            conversation_id=payload.conversation_id or str(uuid.uuid4()),
        )
    except Exception as exc:
        logger.exception("Chatbot error")
        return AiChatResponse(
            response="Sorry, I encountered an error. Please try again later.\n\nFor technical issues or further clarification:\n📞 Phone: +91 98765 43210\n📧 Email: support@cogniitec.com",
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
    try:
        from app.ai.assistant import generate_homework
        content = await generate_homework(
            current=current,
            subject=payload.subject,
            grade=payload.grade,
            topic=payload.topic,
            difficulty=payload.difficulty,
        )
        return HomeworkGenerateResponse(content=content)
    except Exception as exc:
        logger.exception("Homework generation failed")
        raise HTTPException(status_code=500, detail=f"Failed to generate homework: {str(exc)}")
