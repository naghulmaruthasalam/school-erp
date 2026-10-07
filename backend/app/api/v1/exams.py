from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.core.deps import CurrentUser, require_roles, require_tenant_user
from app.core.enums import ADMIN_ROLES, STAFF_ROLES
from app.schemas.common import PageParams, PageResponse
from app.schemas.exam import (
    ExamCreateRequest,
    ExamOut,
    ExamSubjectCreateRequest,
    ExamSubjectOut,
    ExamSubjectUpdateRequest,
    ExamUpdateRequest,
    MarkEntryRequest,
    MarkOut,
    ResultOut,
)
from app.services import exam_service

router = APIRouter(prefix="/exams", tags=["exams"])

_admin_only = require_roles(*ADMIN_ROLES)
_staff_only = require_roles(*STAFF_ROLES)


# ---------------------------------------------------------------------------
# Exam
# ---------------------------------------------------------------------------


@router.post("", response_model=ExamOut, status_code=201)
async def create_exam(
    payload: ExamCreateRequest,
    current: CurrentUser = Depends(_admin_only),
) -> ExamOut:
    return await exam_service.create_exam(payload, current.school_id)


@router.get("", response_model=PageResponse[ExamOut])
async def list_exams(
    academic_year_id: str | None = None,
    params: PageParams = Depends(),
    current: CurrentUser = Depends(require_tenant_user),
) -> PageResponse[ExamOut]:
    return await exam_service.list_exams(current.school_id, academic_year_id, params)


@router.get("/{exam_id}", response_model=ExamOut)
async def get_exam(
    exam_id: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> ExamOut:
    return await exam_service.get_exam(exam_id, current.school_id)


@router.patch("/{exam_id}", response_model=ExamOut)
async def update_exam(
    exam_id: str,
    payload: ExamUpdateRequest,
    current: CurrentUser = Depends(_admin_only),
) -> ExamOut:
    return await exam_service.update_exam(exam_id, payload, current.school_id)


# ---------------------------------------------------------------------------
# ExamSubject
# ---------------------------------------------------------------------------


@router.post("/{exam_id}/subjects", response_model=ExamSubjectOut, status_code=201)
async def create_exam_subject(
    exam_id: str,
    payload: ExamSubjectCreateRequest,
    current: CurrentUser = Depends(_admin_only),
) -> ExamSubjectOut:
    return await exam_service.create_exam_subject(exam_id, payload, current.school_id)


@router.get("/{exam_id}/subjects", response_model=list[ExamSubjectOut])
async def list_exam_subjects(
    exam_id: str,
    class_id: str | None = None,
    current: CurrentUser = Depends(require_tenant_user),
) -> list[ExamSubjectOut]:
    return await exam_service.list_exam_subjects(exam_id, current.school_id, class_id)


@router.patch("/subjects/{exam_subject_id}", response_model=ExamSubjectOut)
async def update_exam_subject(
    exam_subject_id: str,
    payload: ExamSubjectUpdateRequest,
    current: CurrentUser = Depends(_admin_only),
) -> ExamSubjectOut:
    return await exam_service.update_exam_subject(exam_subject_id, payload, current.school_id)


# ---------------------------------------------------------------------------
# Marks
# ---------------------------------------------------------------------------


@router.post("/subjects/{exam_subject_id}/marks", response_model=list[MarkOut])
async def enter_marks(
    exam_subject_id: str,
    payload: MarkEntryRequest,
    current: CurrentUser = Depends(_staff_only),
) -> list[MarkOut]:
    return await exam_service.enter_marks(exam_subject_id, payload.marks, current)


@router.get("/subjects/{exam_subject_id}/marks", response_model=list[MarkOut])
async def list_marks(
    exam_subject_id: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> list[MarkOut]:
    return await exam_service.list_marks(exam_subject_id, current)


# ---------------------------------------------------------------------------
# Result / report card
# ---------------------------------------------------------------------------


@router.get("/{exam_id}/students/{student_id}/result", response_model=ResultOut)
async def get_student_result(
    exam_id: str,
    student_id: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> ResultOut:
    return await exam_service.get_student_result(exam_id, student_id, current)


@router.get("/{exam_id}/students/{student_id}/report-card")
async def get_report_card(
    exam_id: str,
    student_id: str,
    current: CurrentUser = Depends(require_tenant_user),
) -> Response:
    pdf_bytes = await exam_service.get_report_card_pdf(exam_id, student_id, current)
    return Response(content=pdf_bytes, media_type="application/pdf")
