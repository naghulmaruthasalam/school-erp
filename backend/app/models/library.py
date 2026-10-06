"""Library management models."""
from datetime import date, datetime
from enum import Enum

from pydantic import Field

from app.models.base import TenantDocument


class BookStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    ISSUED = "ISSUED"
    RESERVED = "RESERVED"
    DAMAGED = "DAMAGED"
    LOST = "LOST"


class Book(TenantDocument):
    """Library book."""

    isbn: str | None = None
    title: str
    author: str
    publisher: str | None = None
    edition: str | None = None
    category: str | None = None
    subject: str | None = None

    total_copies: int = 1
    available_copies: int = 1

    rack_number: str | None = None
    shelf_number: str | None = None

    purchase_date: date | None = None
    price: float | None = None

    class Settings:
        name = "library_books"
        indexes = ["school_id", "isbn", "title", "author", "category"]


class BookIssue(TenantDocument):
    """Book issue record."""

    book_id: str
    book_title: str

    borrower_id: str
    borrower_name: str
    borrower_type: str  # STUDENT or TEACHER

    issue_date: date
    due_date: date
    return_date: date | None = None

    fine_amount: float = 0
    fine_paid: bool = False

    remarks: str | None = None
    issued_by: str

    class Settings:
        name = "library_issues"
        indexes = ["school_id", "book_id", "borrower_id", "issue_date", "return_date"]
