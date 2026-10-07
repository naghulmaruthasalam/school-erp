from datetime import date, datetime

from pydantic import Field

from app.core.enums import FeeFrequency, InvoiceStatus, PaymentMethod, PaymentStatus
from app.models.base import TenantDocument


class FeeCategory(TenantDocument):
    name: str  # Tuition, Transport, Lab, etc.
    description: str | None = None

    class Settings:
        name = "fee_categories"
        indexes = ["school_id"]


class FeeStructure(TenantDocument):
    academic_year_id: str
    class_id: str
    category_id: str
    amount: float
    frequency: FeeFrequency = FeeFrequency.ANNUAL

    class Settings:
        name = "fee_structures"
        indexes = ["school_id", "academic_year_id", "class_id"]


class FeeAssignment(TenantDocument):
    student_id: str
    fee_structure_id: str
    discount_amount: float = 0
    discount_reason: str | None = None
    final_amount: float

    class Settings:
        name = "fee_assignments"
        indexes = ["school_id", "student_id"]


class Invoice(TenantDocument):
    student_id: str
    academic_year_id: str
    fee_assignment_ids: list[str] = Field(default_factory=list)
    total_amount: float
    amount_paid: float = 0
    due_date: date
    status: InvoiceStatus = InvoiceStatus.PENDING

    class Settings:
        name = "invoices"
        indexes = ["school_id", "student_id", "status"]


class Payment(TenantDocument):
    invoice_id: str
    student_id: str
    amount: float
    method: PaymentMethod
    status: PaymentStatus = PaymentStatus.CREATED

    # PayU classic hosted-checkout identifiers
    payu_txnid: str | None = None  # our generated transaction id, sent to PayU
    payu_mihpayid: str | None = None  # PayU's internal payment id, returned on callback
    payu_hash: str | None = None  # reverse hash PayU returned, kept for audit

    # PayU refund tracking (cancel_refund_transaction). refund_token is OUR
    # generated identifier sent as var2 — used to correlate the async refund
    # webhook back to this Payment, since PayU's refund webhook payload
    # carries no verifiable hash (see payment_service docstring).
    refund_token: str | None = None
    refund_amount: float | None = None
    refund_request_id: str | None = None  # PayU's request_id for the refund
    refund_initiated_by: str | None = None
    refunded_at: datetime | None = None

    paid_at: datetime | None = None
    recorded_by: str | None = None
    receipt_document_id: str | None = None

    class Settings:
        name = "payments"
        indexes = ["school_id", "invoice_id", "student_id", "payu_txnid", "refund_token"]
