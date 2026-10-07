from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.deps import CurrentUser, require_tenant_user
from app.core.enums import Role
from app.schemas.common import PageParams, PageResponse
from app.schemas.homework import (
    HomeworkCreateRequest,
    HomeworkOut,
    HomeworkSubmissionOut,
    HomeworkSubmissionUpdateRequest,
    HomeworkUpdateRequest,
    PendingHomeworkOut,
)
from app.services import homework_service
from app.services.ai import validate_text_homework, validate_image_homework, get_quick_feedback, GeminiError, GeminiNotConfigured

router = APIRouter(prefix="/homework", tags=["homework"])


@router.post("", response_model=HomeworkOut, status_code=201)
async def create_homework(
    payload: HomeworkCreateRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> HomeworkOut:
    return await homework_service.create_homework(current, payload)


@router.get("", response_model=PageResponse[HomeworkOut])
async def list_homework(
    section_id: str | None = None,
    subject_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    params: PageParams = Depends(),
    current: CurrentUser = Depends(require_tenant_user),
) -> PageResponse[HomeworkOut]:
    return await homework_service.list_homework(current, section_id, subject_id, date_from, date_to, params)


@router.get("/pending", response_model=list[PendingHomeworkOut])
async def pending_homework(
    current: CurrentUser = Depends(require_tenant_user),
) -> list[PendingHomeworkOut]:
    return await homework_service.pending_homework(current)


@router.get("/{homework_id}", response_model=HomeworkOut)
async def get_homework(
    homework_id: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> HomeworkOut:
    return await homework_service.get_homework(current, homework_id)


@router.patch("/{homework_id}", response_model=HomeworkOut)
async def update_homework(
    homework_id: str,
    payload: HomeworkUpdateRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> HomeworkOut:
    return await homework_service.update_homework(current, homework_id, payload)


@router.delete("/{homework_id}", status_code=204)
async def delete_homework(
    homework_id: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> None:
    await homework_service.delete_homework(current, homework_id)


@router.get("/{homework_id}/submissions", response_model=list[HomeworkSubmissionOut])
async def list_submissions(
    homework_id: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> list[HomeworkSubmissionOut]:
    return await homework_service.list_submissions(current, homework_id)


@router.patch("/submissions/{submission_id}", response_model=HomeworkSubmissionOut)
async def update_submission(
    submission_id: str,
    payload: HomeworkSubmissionUpdateRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> HomeworkSubmissionOut:
    return await homework_service.update_submission(current, submission_id, payload)


# ==================== AI Validation Endpoints ====================

class TextSubmissionRequest(BaseModel):
    homework_id: str
    answers: list[str]


class QuickFeedbackRequest(BaseModel):
    question: str
    answer: str
    subject: str
    grade: str


@router.post("/submissions/{submission_id}/ai-validate")
async def ai_validate_submission(
    submission_id: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Get AI evaluation and feedback for a homework submission."""
    if current.role not in {Role.TEACHER, Role.SCHOOL_ADMIN, Role.PRINCIPAL}:
        raise HTTPException(status_code=403, detail="Only teachers can validate submissions")

    try:
        # Get submission and homework details
        submission = await homework_service.get_submission(current, submission_id)
        homework = await homework_service.get_homework(current, submission.homework_id)

        # Get student answers from submission
        student_answers = submission.content.split("\n---\n") if submission.content else []

        # Build questions list from homework
        questions = [{"question": homework.description, "marks": 10}]

        result = await validate_text_homework(
            homework_id=submission.homework_id,
            student_id=submission.student_id,
            homework_title=homework.title,
            homework_description=homework.description,
            questions=questions,
            student_answers=student_answers if student_answers else [submission.content or ""],
        )

        return result.model_dump(mode="json")
    except GeminiNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except GeminiError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/submissions/{submission_id}/ai-validate-images")
async def ai_validate_submission_images(
    submission_id: str,
    images: list[UploadFile] = File(...),
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Get AI evaluation for handwritten/image homework submission."""
    if current.role not in {Role.TEACHER, Role.SCHOOL_ADMIN, Role.PRINCIPAL}:
        raise HTTPException(status_code=403, detail="Only teachers can validate submissions")

    try:
        submission = await homework_service.get_submission(current, submission_id)
        homework = await homework_service.get_homework(current, submission.homework_id)

        image_bytes_list = [await img.read() for img in images]
        questions = [{"question": homework.description, "marks": 10}]

        result = await validate_image_homework(
            homework_id=submission.homework_id,
            student_id=submission.student_id,
            homework_title=homework.title,
            homework_description=homework.description,
            questions=questions,
            image_bytes_list=image_bytes_list,
        )

        return result.model_dump(mode="json")
    except GeminiNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except GeminiError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quick-feedback")
async def api_quick_feedback(
    req: QuickFeedbackRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Get quick AI feedback on a single answer (for students while typing)."""
    try:
        return await get_quick_feedback(
            student_answer=req.answer,
            question=req.question,
            subject=req.subject,
            grade_level=req.grade,
        )
    except GeminiNotConfigured as e:
        raise HTTPException(status_code=503, detail=str(e))
    except GeminiError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/submissions/{submission_id}/feedback")
async def get_submission_feedback(
    submission_id: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> dict[str, Any]:
    """Get AI feedback for a student's own homework submission."""
    from app.models.homework_validation import HomeworkValidation

    submission = await homework_service.get_submission(current, submission_id)

    # Students can only view their own feedback
    if current.role == Role.STUDENT and submission.student_id != current.user.student_id:
        raise HTTPException(status_code=403, detail="Not your submission")

    # Check if validation exists
    validation = await HomeworkValidation.find_one({"submission_id": submission_id})

    if not validation:
        # Auto-validate if not already done
        try:
            homework = await homework_service.get_homework(current, submission.homework_id)
            questions = [{"question": homework.description or homework.title, "marks": 10}]
            # Use remarks or indicate file submission
            answer_text = submission.remarks or ("File submitted" if submission.attachment_document_ids else "No answer provided")
            student_answers = [answer_text]

            result = await validate_text_homework(
                homework_id=submission.homework_id,
                student_id=submission.student_id,
                homework_title=homework.title,
                homework_description=homework.description or "",
                questions=questions,
                student_answers=student_answers,
            )

            # Store validation result
            validation = HomeworkValidation(
                school_id=current.school_id,
                homework_id=submission.homework_id,
                student_id=submission.student_id,
                submission_id=submission_id,
                total_score=result.total_score,
                max_score=result.max_score,
                percentage=result.percentage,
                grade=result.grade,
                overall_feedback=result.overall_feedback,
                strengths=result.strengths,
                areas_to_improve=result.areas_to_improve,
                questions=[q.model_dump() for q in result.questions],
            )
            await validation.insert()

        except (GeminiNotConfigured, GeminiError) as e:
            return {"status": "pending", "message": "AI feedback is being processed"}

    return {
        "status": "ready",
        "total_score": validation.total_score,
        "max_score": validation.max_score,
        "percentage": validation.percentage,
        "grade": validation.grade,
        "overall_feedback": validation.overall_feedback,
        "strengths": validation.strengths,
        "areas_to_improve": validation.areas_to_improve,
        "questions": validation.questions,
        "validated_at": validation.validated_at.isoformat() if validation.validated_at else None,
    }
