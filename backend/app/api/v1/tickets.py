from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.deps import CurrentUser, get_current_user
from app.schemas.common import PageParams
from app.services import ticket_service

router = APIRouter(prefix="/tickets", tags=["tickets"])


class TicketCreate(BaseModel):
    category: str
    subject: str = Field(max_length=200)
    description: str = Field(max_length=4000)
    rating: int | None = Field(default=None, ge=1, le=5)
    student_id: str | None = None  # a parent picks which child it is about
    teacher_id: str | None = None


class ReplyIn(BaseModel):
    message: str = Field(max_length=4000)


class StatusIn(BaseModel):
    status: str


@router.post("", status_code=201)
async def create_ticket(payload: TicketCreate, current: CurrentUser = Depends(get_current_user)) -> dict:
    """A student or parent raises a ticket; the principal, school admins and super admins are notified."""
    return await ticket_service.create_ticket(current, **payload.model_dump())


@router.get("")
async def list_tickets(status: str | None = Query(None), category: str | None = Query(None), school_id: str | None = Query(None),
                       page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=200),
                       current: CurrentUser = Depends(get_current_user)) -> dict:
    """Your own tickets; for the principal and admins their school's; for super admins every school's."""
    return (await ticket_service.list_tickets(current, status, category, school_id, PageParams(page=page, page_size=page_size))).model_dump()


@router.get("/teachers")
async def my_teachers(current: CurrentUser = Depends(get_current_user)) -> list[dict]:
    """Teachers the raiser can name on a ticket (their own teachers)."""
    return await ticket_service.my_teachers(current)


@router.get("/summary")
async def ticket_summary(school_id: str | None = Query(None), current: CurrentUser = Depends(get_current_user)) -> dict:
    return await ticket_service.summary(current, school_id)


@router.get("/{ticket_id}")
async def get_ticket(ticket_id: str, current: CurrentUser = Depends(get_current_user)) -> dict:
    return await ticket_service.get_ticket(current, ticket_id)


@router.post("/{ticket_id}/replies", status_code=201)
async def add_reply(ticket_id: str, payload: ReplyIn, current: CurrentUser = Depends(get_current_user)) -> dict:
    return await ticket_service.add_reply(current, ticket_id, payload.message)


@router.patch("/{ticket_id}/status")
async def set_status(ticket_id: str, payload: StatusIn, current: CurrentUser = Depends(get_current_user)) -> dict:
    return await ticket_service.set_status(current, ticket_id, payload.status)
