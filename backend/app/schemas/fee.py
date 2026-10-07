from datetime import date, datetime

from pydantic import BaseModel, Field

from app.core.enums import FeeFrequency, InvoiceStatus, PaymentMethod, PaymentStatus

# ---------------------------------------------------------------------------
# FeeCategory
# ---------------------------------------------------------------------------


class FeeCategoryCreateRequest(BaseModel):
    name: str
    description: str | None = None


class FeeCategoryUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None


class FeeCategoryOut(BaseModel):
    id: str
    school_id: str
    name: str
    description: str | None = None


# ---------------------------------------------------------------------------
# FeeStructure
# ---------------------------------------------------------------------------


class FeeStructureCreateRequest(BaseModel):
    academic_year_id: str
    class_id: str
    category_id: str
    amount: float = Field(..., gt=0)
    frequency: FeeFrequency = FeeFrequency.ANNUAL


class FeeStructureUpdateRequest(BaseModel):
    amount: float | None = Field(default=None, gt=0)
    frequency: FeeFrequency | None = None


class FeeStructureOut(BaseModel):
    id: str
    school_id: str
    academic_year_id: str
    class_id: str
    category_id: str
    amount: float
    frequency: FeeFrequency


# ---------------------------------------------------------------------------
# FeeAssignment
# ---------------------------------------------------------------------------


class FeeAssignmentCreateRequest(BaseModel):
    student_id: str
    fee_structure_id: str
    discount_amount: float = Field(default=0, ge=0)
    discount_reason: str | None = None


class FeeAssignmentOut(BaseModel):
    id: str
    school_id: str
    student_id: str
    fee_structure_id: str
    discount_amount: float
    discount_reason: str | None = None
    final_amount: float


# ---------------------------------------------------------------------------
# Invoice
# ---------------------------------------------------------------------------


class InvoiceCreateRequest(BaseModel):
    student_id: str
    academic_year_id: str
    fee_assignment_ids: list[str] = Field(..., min_length=1)
    due_date: date


class InvoiceStatusUpdateRequest(BaseModel):
    status: InvoiceStatus


class InvoiceOut(BaseModel):
    id: str
    school_id: str
    student_id: str
    academic_year_id: str
    fee_assignment_ids: list[str]
    total_amount: float
    amount_paid: float
    outstanding_amount: float
    due_date: date
    status: InvoiceStatus
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Payment (manual)
# ---------------------------------------------------------------------------


class ManualPaymentRequest(BaseModel):
    amount: float = Field(..., gt=0)
    method: PaymentMethod
    note: str | None = None


class PaymentOut(BaseModel):
    id: str
    school_id: str
    invoice_id: str
    student_id: str
    amount: float
    method: PaymentMethod
    status: PaymentStatus
    payu_txnid: str | None = None
    payu_mihpayid: str | None = None
    paid_at: datetime | None = None
    recorded_by: str | None = None
