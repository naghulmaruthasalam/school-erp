"""Question paper generator endpoints (teachers). Mounted at /api/v1/copilot/qpg."""
from fastapi import APIRouter, Depends

from app.copilot.deps import copilot_teacher, guard_llm
from app.copilot.qpg import service
from app.copilot.qpg.schemas import BankItemIn, ExportRequest, GenerateRequest
from app.core.deps import CurrentUser
from app.core.lang import Lang, get_lang

router = APIRouter(prefix="/copilot/qpg", tags=["copilot"])


@router.get("/options")
async def options(current: CurrentUser = Depends(copilot_teacher), lang: Lang = Depends(get_lang)) -> dict:
    """Classes -> subjects -> chapters the teacher may use, with the question types and mark limits for each class."""
    return await service.options(current, lang)


@router.post("/generate")
async def generate(req: GenerateRequest, current: CurrentUser = Depends(copilot_teacher)) -> dict:
    async with guard_llm("question paper"):
        return await service.generate(current, req)


@router.get("/papers")
async def papers(current: CurrentUser = Depends(copilot_teacher)) -> list[dict]:
    return await service.list_papers(current)


@router.get("/papers/{paper_id}")
async def paper(paper_id: str, current: CurrentUser = Depends(copilot_teacher)) -> dict:
    return service.paper_out(await service.get_owned(current, paper_id))


@router.delete("/papers/{paper_id}", status_code=204)
async def delete_paper(paper_id: str, current: CurrentUser = Depends(copilot_teacher)) -> None:
    await service.delete_paper(current, paper_id)


@router.post("/papers/{paper_id}/export")
async def export(paper_id: str, req: ExportRequest, current: CurrentUser = Depends(copilot_teacher)) -> dict:
    """Question paper or answer key as PDF (or text), saved to the teacher's file history."""
    return await service.export(current, paper_id, req)


@router.get("/bank")
async def bank(class_id: str | None = None, subject_id: str | None = None, chapter: str | None = None,
               question_type: str | None = None, current: CurrentUser = Depends(copilot_teacher)) -> list[dict]:
    return await service.list_bank(current, class_id, subject_id, chapter, question_type)


@router.post("/bank", status_code=201)
async def add_to_bank(body: BankItemIn, current: CurrentUser = Depends(copilot_teacher)) -> dict:
    return await service.add_to_bank(current, body)


@router.delete("/bank/{item_id}", status_code=204)
async def delete_from_bank(item_id: str, current: CurrentUser = Depends(copilot_teacher)) -> None:
    await service.delete_from_bank(current, item_id)
