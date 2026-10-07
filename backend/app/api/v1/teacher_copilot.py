"""Teacher Copilot API endpoints - AI-powered teaching tools."""
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.deps import CurrentUser, require_tenant_user
from app.core.enums import Role
from app.core.exceptions import PermissionDeniedError
from app.services.ai import (
    extract_topics,
    generate_lesson_plan,
    generate_question_paper,
    generate_worksheet,
    validate_text_homework,
    validate_image_homework,
    get_quick_feedback,
    GeminiError,
    GeminiNotConfigured,
)
from app.models.curriculum import CurriculumUnit

router = APIRouter(prefix="/teacher-copilot", tags=["teacher-copilot"])

ALLOWED_ROLES = {Role.TEACHER, Role.SCHOOL_ADMIN, Role.PRINCIPAL}


def _check_permission(current: CurrentUser):
    if current.role not in ALLOWED_ROLES:
        raise PermissionDeniedError("Only teachers, admins, and principals can use teacher copilot")


# ==================== Curriculum Options ====================

@router.get("/curriculum-options")
async def get_curriculum_options(
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Get available grades, subjects, and chapters from curriculum database."""
    _check_permission(current)

    # Get all curriculum units
    units = await CurriculumUnit.find().to_list()

    # Build options structure
    grades = sorted(set(u.grade for u in units if u.grade))

    # Build subjects per grade
    subjects_by_grade: dict[int, list[str]] = {}
    for u in units:
        if u.grade not in subjects_by_grade:
            subjects_by_grade[u.grade] = []
        if u.subject and u.subject not in subjects_by_grade[u.grade]:
            subjects_by_grade[u.grade].append(u.subject)

    # Build chapters per grade/subject
    chapters_by_grade_subject: dict[str, list[dict]] = {}
    for u in units:
        key = f"{u.grade}_{u.subject}"
        if key not in chapters_by_grade_subject:
            chapters_by_grade_subject[key] = []
        chapters_by_grade_subject[key].append({
            "unit_number": u.unit_number,
            "title_en": u.unit_title_en,
            "title_ar": u.unit_title_ar,
            "id": str(u.id),
        })

    # Sort chapters by unit number
    for key in chapters_by_grade_subject:
        chapters_by_grade_subject[key].sort(key=lambda x: x["unit_number"])

    return {
        "grades": grades,
        "subjects_by_grade": subjects_by_grade,
        "chapters_by_grade_subject": chapters_by_grade_subject,
    }


@router.get("/curriculum-content/{unit_id}")
async def get_curriculum_content(
    unit_id: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Get full content for a specific curriculum unit."""
    _check_permission(current)

    unit = await CurriculumUnit.get(unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Curriculum unit not found")

    return {
        "id": str(unit.id),
        "grade": unit.grade,
        "subject": unit.subject,
        "unit_number": unit.unit_number,
        "title_en": unit.unit_title_en,
        "title_ar": unit.unit_title_ar,
        "full_text": unit.full_text,
        "resources": [r.model_dump() for r in unit.resources],
    }


# ==================== Lesson Plan Generator ====================

class ExtractTopicsRequest(BaseModel):
    chapter_name: str
    chapter_content: str | None = None
    subject: str = ""
    grade: str = ""


class GenerateLessonPlanRequest(BaseModel):
    board: str
    grade: str
    subject: str
    chapter: str
    topics: list[str]
    teaching_dates: list[dict]


@router.post("/lesson-plan/extract-topics")
async def api_extract_topics(
    req: ExtractTopicsRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Extract teachable topics from a chapter."""
    _check_permission(current)
    try:
        topics = await extract_topics(
            chapter_name=req.chapter_name,
            chapter_content=req.chapter_content,
            subject=req.subject,
            grade=req.grade,
        )
        return {"topics": topics}
    except GeminiNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except GeminiError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/lesson-plan/generate")
async def api_generate_lesson_plan(
    req: GenerateLessonPlanRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Generate a complete lesson plan with activities."""
    _check_permission(current)
    try:
        result = await generate_lesson_plan(
            board=req.board,
            grade=req.grade,
            subject=req.subject,
            chapter=req.chapter,
            topics=req.topics,
            teaching_dates=req.teaching_dates,
        )
        return result.model_dump(mode="json")
    except GeminiNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except GeminiError as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Question Paper Generator ====================

class GenerateQuestionPaperRequest(BaseModel):
    board: str
    grade: str
    subject: str
    chapters: list[str]
    total_marks: int = 100
    duration_minutes: int = 180
    question_distribution: dict | None = None
    difficulty_mix: dict | None = None


class GenerateWorksheetRequest(BaseModel):
    grade: str
    subject: str
    topic: str
    num_questions: int = 10
    difficulty: str = "medium"


@router.post("/question-paper/generate")
async def api_generate_question_paper(
    req: GenerateQuestionPaperRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Generate a complete question paper with answer key."""
    _check_permission(current)
    try:
        result = await generate_question_paper(
            board=req.board,
            grade=req.grade,
            subject=req.subject,
            chapters=req.chapters,
            total_marks=req.total_marks,
            duration_minutes=req.duration_minutes,
            question_distribution=req.question_distribution,
            difficulty_mix=req.difficulty_mix,
        )
        return result.model_dump(mode="json")
    except GeminiNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except GeminiError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/worksheet/generate")
async def api_generate_worksheet(
    req: GenerateWorksheetRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Generate a practice worksheet for students."""
    _check_permission(current)
    try:
        return await generate_worksheet(
            grade=req.grade,
            subject=req.subject,
            topic=req.topic,
            num_questions=req.num_questions,
            difficulty=req.difficulty,
        )
    except GeminiNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except GeminiError as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== Homework Validation ====================

class ValidateHomeworkRequest(BaseModel):
    homework_id: str
    student_id: str
    homework_title: str
    homework_description: str
    questions: list[dict]
    student_answers: list[str]


class QuickFeedbackRequest(BaseModel):
    student_answer: str
    question: str
    subject: str
    grade_level: str


@router.post("/homework/validate")
async def api_validate_homework(
    req: ValidateHomeworkRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Validate text-based homework submission with AI."""
    _check_permission(current)
    try:
        result = await validate_text_homework(
            homework_id=req.homework_id,
            student_id=req.student_id,
            homework_title=req.homework_title,
            homework_description=req.homework_description,
            questions=req.questions,
            student_answers=req.student_answers,
        )
        return result.model_dump(mode="json")
    except GeminiNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except GeminiError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/homework/validate-images")
async def api_validate_homework_images(
    homework_id: str = Form(...),
    student_id: str = Form(...),
    homework_title: str = Form(...),
    homework_description: str = Form(...),
    questions_json: str = Form(...),
    files: list[UploadFile] = File(...),
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Validate image/handwritten homework submission with AI."""
    _check_permission(current)

    import json
    questions = json.loads(questions_json)

    image_bytes = []
    for f in files:
        content = await f.read()
        image_bytes.append(content)

    try:
        result = await validate_image_homework(
            homework_id=homework_id,
            student_id=student_id,
            homework_title=homework_title,
            homework_description=homework_description,
            questions=questions,
            image_bytes_list=image_bytes,
        )
        return result.model_dump(mode="json")
    except GeminiNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except GeminiError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/homework/quick-feedback")
async def api_quick_feedback(
    req: QuickFeedbackRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Get quick AI feedback on a single answer."""
    _check_permission(current)
    try:
        return await get_quick_feedback(
            student_answer=req.student_answer,
            question=req.question,
            subject=req.subject,
            grade_level=req.grade_level,
        )
    except GeminiNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except GeminiError as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== AI Status ====================

@router.get("/status")
async def ai_status(
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Check if AI features are available."""
    from app.services.ai.gemini_client import get_client

    client = get_client()
    return {
        "ai_enabled": client is not None,
        "features": {
            "lesson_plan_generator": client is not None,
            "question_paper_generator": client is not None,
            "worksheet_generator": client is not None,
            "homework_validation": client is not None,
        },
    }
