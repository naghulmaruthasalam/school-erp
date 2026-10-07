"""Answer-sheet grading endpoints (teachers). Mounted at /api/v1/copilot/grading. Papers come from the question paper
generator (GET /copilot/qpg/papers)."""
from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel, Field

from app.copilot.deps import copilot_teacher, guard_llm
from app.copilot.grading import service
from app.core.deps import CurrentUser

router = APIRouter(prefix="/copilot/grading", tags=["copilot"])


class Adjustment(BaseModel):
    question_number: int
    marks_awarded: float
    feedback: str | None = Field(default=None, max_length=2000)


class AdjustRequest(BaseModel):
    changes: list[Adjustment] = Field(min_length=1, max_length=200)


class ReportRequest(BaseModel):
    paper_id: str
    result_ids: list[str] | None = None  # omitted = every graded sheet for the paper
    format: str = "pdf"


@router.post("/evaluate")
async def evaluate(paper_id: str = Form(...), student_name: str = Form(...), student_id: str | None = Form(None),
                   files: list[UploadFile] = File(...), current: CurrentUser = Depends(copilot_teacher)) -> dict:
    """Grade one student's answer sheet (images and/or PDFs, pages in reading order) against a generated paper."""
    async with guard_llm("grading"):
        return await service.evaluate(current, paper_id, student_name, student_id, files)


@router.post("/batch", status_code=202)
async def start_batch(paper_id: str = Form(...), students: str = Form(...), files: list[UploadFile] = File(...),
                      current: CurrentUser = Depends(copilot_teacher)) -> dict:
    """Grade several students in the background. `students` is a JSON list of {student_name, page_count[, student_id]};
    `files` are all their pages, in order, student after student. Poll GET /batch/{id}."""
    async with guard_llm("grading"):
        return await service.start_batch(current, paper_id, students, files)


@router.get("/batch/{job_id}")
async def batch_status(job_id: str, current: CurrentUser = Depends(copilot_teacher)) -> dict:
    return await service.get_job(current, job_id)


@router.get("/results")
async def results(paper_id: str | None = None, current: CurrentUser = Depends(copilot_teacher)) -> list[dict]:
    return await service.list_sheets(current, paper_id)


@router.get("/results/{sheet_id}")
async def result(sheet_id: str, current: CurrentUser = Depends(copilot_teacher)) -> dict:
    return service.sheet_out(await service.get_sheet(current, sheet_id))


@router.patch("/results/{sheet_id}")
async def adjust(sheet_id: str, body: AdjustRequest, current: CurrentUser = Depends(copilot_teacher)) -> dict:
    """Teacher overrides marks and/or feedback for some questions; the total is recalculated."""
    return await service.adjust(current, sheet_id, [c.model_dump() for c in body.changes])


@router.delete("/results/{sheet_id}", status_code=204)
async def delete_result(sheet_id: str, current: CurrentUser = Depends(copilot_teacher)) -> None:
    await service.delete_sheet(current, sheet_id)


@router.post("/report")
async def report(body: ReportRequest, current: CurrentUser = Depends(copilot_teacher)) -> dict:
    """A grading report (class summary + one section per student) saved as PDF to the teacher's file history."""
    return await service.report(current, body.paper_id, body.result_ids, body.format)
