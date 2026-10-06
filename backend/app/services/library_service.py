"""Library service."""
from datetime import date, timedelta
from typing import Any

from app.core.deps import CurrentUser
from app.core.enums import Role
from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationAppError
from app.models.library import Book, BookIssue
from app.schemas.common import PageParams, PageResponse

ADMIN_ROLES = (Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL)
LIBRARIAN_ROLES = (*ADMIN_ROLES, Role.TEACHER)


def book_to_out(book: Book) -> dict[str, Any]:
    return {
        "id": str(book.id),
        "school_id": book.school_id,
        "isbn": book.isbn,
        "title": book.title,
        "author": book.author,
        "publisher": book.publisher,
        "edition": book.edition,
        "category": book.category,
        "subject": book.subject,
        "total_copies": book.total_copies,
        "available_copies": book.available_copies,
        "rack_number": book.rack_number,
        "shelf_number": book.shelf_number,
        "purchase_date": book.purchase_date.isoformat() if book.purchase_date else None,
        "price": book.price,
    }


def issue_to_out(issue: BookIssue) -> dict[str, Any]:
    return {
        "id": str(issue.id),
        "school_id": issue.school_id,
        "book_id": issue.book_id,
        "book_title": issue.book_title,
        "borrower_id": issue.borrower_id,
        "borrower_name": issue.borrower_name,
        "borrower_type": issue.borrower_type,
        "issue_date": issue.issue_date.isoformat(),
        "due_date": issue.due_date.isoformat(),
        "return_date": issue.return_date.isoformat() if issue.return_date else None,
        "fine_amount": issue.fine_amount,
        "fine_paid": issue.fine_paid,
        "remarks": issue.remarks,
        "issued_by": issue.issued_by,
    }


async def add_book(
    current: CurrentUser,
    title: str,
    author: str,
    isbn: str | None = None,
    publisher: str | None = None,
    edition: str | None = None,
    category: str | None = None,
    subject: str | None = None,
    total_copies: int = 1,
    rack_number: str | None = None,
    shelf_number: str | None = None,
    purchase_date: date | None = None,
    price: float | None = None,
) -> dict[str, Any]:
    if current.role not in LIBRARIAN_ROLES:
        raise PermissionDeniedError()

    book = Book(
        school_id=current.school_id,
        isbn=isbn,
        title=title,
        author=author,
        publisher=publisher,
        edition=edition,
        category=category,
        subject=subject,
        total_copies=total_copies,
        available_copies=total_copies,
        rack_number=rack_number,
        shelf_number=shelf_number,
        purchase_date=purchase_date,
        price=price,
    )
    await book.insert()
    return book_to_out(book)


async def list_books(
    current: CurrentUser,
    search: str | None = None,
    category: str | None = None,
    params: PageParams | None = None,
) -> PageResponse[dict[str, Any]]:
    params = params or PageParams()

    query = Book.find(Book.school_id == current.school_id)

    if search:
        query = query.find({
            "$or": [
                {"title": {"$regex": search, "$options": "i"}},
                {"author": {"$regex": search, "$options": "i"}},
                {"isbn": {"$regex": search, "$options": "i"}},
            ]
        })

    if category:
        query = query.find(Book.category == category)

    total = await query.count()
    books = await query.skip(params.skip).limit(params.page_size).to_list()

    return PageResponse(
        items=[book_to_out(b) for b in books],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


async def get_book(current: CurrentUser, book_id: str) -> dict[str, Any]:
    book = await Book.get(book_id)
    if not book or book.school_id != current.school_id:
        raise NotFoundError("Book not found")
    return book_to_out(book)


async def issue_book(
    current: CurrentUser,
    book_id: str,
    borrower_id: str,
    borrower_name: str,
    borrower_type: str,
    issue_date: date | None = None,
    due_date: date | None = None,
    days: int = 14,
) -> dict[str, Any]:
    if current.role not in LIBRARIAN_ROLES:
        raise PermissionDeniedError()

    book = await Book.get(book_id)
    if not book or book.school_id != current.school_id:
        raise NotFoundError("Book not found")

    if book.available_copies < 1:
        raise ValidationAppError("No copies available")

    issue_dt = issue_date or date.today()
    due_dt = due_date or (issue_dt + timedelta(days=days))

    issue = BookIssue(
        school_id=current.school_id,
        book_id=str(book.id),
        book_title=book.title,
        borrower_id=borrower_id,
        borrower_name=borrower_name,
        borrower_type=borrower_type,
        issue_date=issue_dt,
        due_date=due_dt,
        issued_by=current.user.full_name,
    )
    await issue.insert()

    book.available_copies -= 1
    await book.save()

    return issue_to_out(issue)


async def return_book(
    current: CurrentUser,
    issue_id: str,
    return_date: date | None = None,
    fine_amount: float = 0,
    fine_paid: bool = False,
    remarks: str | None = None,
) -> dict[str, Any]:
    if current.role not in LIBRARIAN_ROLES:
        raise PermissionDeniedError()

    issue = await BookIssue.get(issue_id)
    if not issue or issue.school_id != current.school_id:
        raise NotFoundError("Issue record not found")

    if issue.return_date:
        raise ValidationAppError("Book already returned")

    issue.return_date = return_date or date.today()
    issue.fine_amount = fine_amount
    issue.fine_paid = fine_paid
    issue.remarks = remarks
    await issue.save()

    book = await Book.get(issue.book_id)
    if book:
        book.available_copies += 1
        await book.save()

    return issue_to_out(issue)


async def list_issues(
    current: CurrentUser,
    book_id: str | None = None,
    borrower_id: str | None = None,
    pending_only: bool = False,
    params: PageParams | None = None,
) -> PageResponse[dict[str, Any]]:
    params = params or PageParams()

    query = BookIssue.find(BookIssue.school_id == current.school_id)

    if book_id:
        query = query.find(BookIssue.book_id == book_id)

    if borrower_id:
        query = query.find(BookIssue.borrower_id == borrower_id)

    if pending_only:
        query = query.find(BookIssue.return_date == None)

    total = await query.count()
    issues = await query.sort(-BookIssue.issue_date).skip(params.skip).limit(params.page_size).to_list()

    return PageResponse(
        items=[issue_to_out(i) for i in issues],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


async def get_library_stats(current: CurrentUser) -> dict[str, Any]:
    total_books = await Book.find(Book.school_id == current.school_id).count()
    total_copies = 0
    available_copies = 0

    books = await Book.find(Book.school_id == current.school_id).to_list()
    for b in books:
        total_copies += b.total_copies
        available_copies += b.available_copies

    pending_issues = await BookIssue.find(
        BookIssue.school_id == current.school_id,
        BookIssue.return_date == None,
    ).count()

    overdue_issues = await BookIssue.find(
        BookIssue.school_id == current.school_id,
        BookIssue.return_date == None,
        BookIssue.due_date < date.today(),
    ).count()

    return {
        "total_books": total_books,
        "total_copies": total_copies,
        "available_copies": available_copies,
        "issued_copies": total_copies - available_copies,
        "pending_issues": pending_issues,
        "overdue_issues": overdue_issues,
    }
