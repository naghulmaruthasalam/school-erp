"""Library API endpoints."""
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.core.deps import CurrentUser, get_current_user
from app.schemas.common import PageParams, PageResponse
from app.services import library_service

router = APIRouter(prefix="/library", tags=["Library"])


class BookCreate(BaseModel):
    title: str
    author: str
    isbn: str | None = None
    publisher: str | None = None
    edition: str | None = None
    category: str | None = None
    subject: str | None = None
    total_copies: int = 1
    rack_number: str | None = None
    shelf_number: str | None = None
    purchase_date: date | None = None
    price: float | None = None


class IssueBook(BaseModel):
    book_id: str
    borrower_id: str
    borrower_name: str
    borrower_type: str
    issue_date: date | None = None
    due_date: date | None = None
    days: int = 14


class ReturnBook(BaseModel):
    return_date: date | None = None
    fine_amount: float = 0
    fine_paid: bool = False
    remarks: str | None = None


@router.post("/books")
async def add_book(
    payload: BookCreate,
    current: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return await library_service.add_book(
        current,
        title=payload.title,
        author=payload.author,
        isbn=payload.isbn,
        publisher=payload.publisher,
        edition=payload.edition,
        category=payload.category,
        subject=payload.subject,
        total_copies=payload.total_copies,
        rack_number=payload.rack_number,
        shelf_number=payload.shelf_number,
        purchase_date=payload.purchase_date,
        price=payload.price,
    )


@router.get("/books")
async def list_books(
    search: str | None = Query(None),
    category: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current: CurrentUser = Depends(get_current_user),
) -> PageResponse[dict[str, Any]]:
    return await library_service.list_books(
        current,
        search=search,
        category=category,
        params=PageParams(page=page, page_size=page_size),
    )


@router.get("/books/{book_id}")
async def get_book(
    book_id: str,
    current: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return await library_service.get_book(current, book_id)


@router.post("/issues")
async def issue_book(
    payload: IssueBook,
    current: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return await library_service.issue_book(
        current,
        book_id=payload.book_id,
        borrower_id=payload.borrower_id,
        borrower_name=payload.borrower_name,
        borrower_type=payload.borrower_type,
        issue_date=payload.issue_date,
        due_date=payload.due_date,
        days=payload.days,
    )


@router.post("/issues/{issue_id}/return")
async def return_book(
    issue_id: str,
    payload: ReturnBook,
    current: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return await library_service.return_book(
        current,
        issue_id=issue_id,
        return_date=payload.return_date,
        fine_amount=payload.fine_amount,
        fine_paid=payload.fine_paid,
        remarks=payload.remarks,
    )


@router.get("/issues")
async def list_issues(
    book_id: str | None = Query(None),
    borrower_id: str | None = Query(None),
    pending_only: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current: CurrentUser = Depends(get_current_user),
) -> PageResponse[dict[str, Any]]:
    return await library_service.list_issues(
        current,
        book_id=book_id,
        borrower_id=borrower_id,
        pending_only=pending_only,
        params=PageParams(page=page, page_size=page_size),
    )


@router.get("/stats")
async def get_library_stats(
    current: CurrentUser = Depends(get_current_user),
) -> dict[str, Any]:
    return await library_service.get_library_stats(current)
