from app.core.audit import record_audit
from app.core.deps import CurrentUser
from app.core.enums import STAFF_ROLES, InvoiceStatus, PaymentMethod, PaymentStatus, Role
from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationAppError
from app.core.pdf import build_simple_pdf
from app.models.base import utcnow
from app.models.fee import FeeAssignment, FeeCategory, FeeStructure, Invoice, Payment
from app.models.guardian import Guardian
from app.models.student import Student
from app.models.tenant import Tenant
from app.schemas.common import PageParams, PageResponse
from app.schemas.fee import (
    FeeAssignmentCreateRequest,
    FeeAssignmentOut,
    FeeCategoryCreateRequest,
    FeeCategoryOut,
    FeeCategoryUpdateRequest,
    FeeStructureCreateRequest,
    FeeStructureOut,
    FeeStructureUpdateRequest,
    InvoiceCreateRequest,
    InvoiceOut,
    InvoiceStatusUpdateRequest,
    ManualPaymentRequest,
    PaymentOut,
)

# ---------------------------------------------------------------------------
# Output converters
# ---------------------------------------------------------------------------


def to_fee_category_out(c: FeeCategory) -> FeeCategoryOut:
    return FeeCategoryOut(id=str(c.id), school_id=c.school_id, name=c.name, description=c.description)


def to_fee_structure_out(s: FeeStructure) -> FeeStructureOut:
    return FeeStructureOut(
        id=str(s.id),
        school_id=s.school_id,
        academic_year_id=s.academic_year_id,
        class_id=s.class_id,
        category_id=s.category_id,
        amount=s.amount,
        frequency=s.frequency,
    )


def to_fee_assignment_out(a: FeeAssignment) -> FeeAssignmentOut:
    return FeeAssignmentOut(
        id=str(a.id),
        school_id=a.school_id,
        student_id=a.student_id,
        fee_structure_id=a.fee_structure_id,
        discount_amount=a.discount_amount,
        discount_reason=a.discount_reason,
        final_amount=a.final_amount,
    )


def invoice_number(i: Invoice) -> str:
    """Human-friendly invoice number derived from the creation year and id."""
    return f"INV-{i.created_at.year}-{str(i.id)[-6:].upper()}"


def to_invoice_out(i: Invoice, student_name: str | None = None) -> InvoiceOut:
    return InvoiceOut(
        id=str(i.id),
        school_id=i.school_id,
        student_id=i.student_id,
        academic_year_id=i.academic_year_id,
        fee_assignment_ids=i.fee_assignment_ids,
        total_amount=i.total_amount,
        amount_paid=i.amount_paid,
        outstanding_amount=i.total_amount - i.amount_paid,
        paid_amount=i.amount_paid,
        invoice_number=invoice_number(i),
        student_name=student_name,
        due_date=i.due_date,
        status=i.status,
        created_at=i.created_at,
        updated_at=i.updated_at,
    )


async def _student_names(student_ids: set[str]) -> dict[str, str]:
    """student_id -> full name, resolved with a single query."""
    from beanie import PydanticObjectId
    from beanie.operators import In

    oids = []
    for sid in student_ids:
        try:
            oids.append(PydanticObjectId(sid))
        except Exception:
            continue
    if not oids:
        return {}
    students = await Student.find(In(Student.id, oids)).to_list()
    return {str(st.id): st.full_name for st in students}


async def fee_stats(current: CurrentUser) -> dict:
    """School-wide fee totals for the admin/principal report screens."""
    invoices = await Invoice.find(Invoice.school_id == current.school_id).to_list()
    expected = sum(i.total_amount for i in invoices)
    collected = sum(i.amount_paid for i in invoices)
    pending = max(expected - collected, 0)
    rate = round(collected / expected * 100, 1) if expected else 0.0
    today = utcnow().date()
    overdue = sum(1 for i in invoices if i.due_date < today and i.amount_paid < i.total_amount)
    return {
        "total_expected": expected,
        "total_collected": collected,
        "total_pending": pending,
        "collection_rate": rate,
        "collection_percentage": rate,
        "overdue_invoices": overdue,
        "total_invoices": len(invoices),
    }


async def list_payments(current: CurrentUser, params: PageParams) -> PageResponse[dict]:
    """School payments, newest first (staff only)."""
    if current.role not in STAFF_ROLES:
        raise PermissionDeniedError("Only staff can list school payments")
    query = Payment.find(Payment.school_id == current.school_id)
    total = await query.count()
    rows = await query.sort(-Payment.created_at).skip(params.skip).limit(params.page_size).to_list()
    names = await _student_names({p.student_id for p in rows})
    items = [
        {
            "id": str(p.id),
            "invoice_id": p.invoice_id,
            "student_id": p.student_id,
            "student_name": names.get(p.student_id),
            "amount": p.amount,
            "payment_method": p.method.value,
            "status": p.status.value,
            "transaction_id": p.payu_mihpayid or p.payu_txnid,
            "payment_date": (p.paid_at or p.created_at).isoformat(),
        }
        for p in rows
    ]
    return PageResponse(items=items, total=total, page=params.page, page_size=params.page_size)


# ---------------------------------------------------------------------------
# Access-scoping helpers (shared with payment_service)
# ---------------------------------------------------------------------------


async def get_accessible_student_ids(current: CurrentUser) -> list[str] | None:
    """None means unrestricted (staff). Otherwise the list of student ids the
    caller (STUDENT/PARENT) is allowed to see — their own, or their children's."""
    if current.role in STAFF_ROLES:
        return None
    if current.role == Role.STUDENT:
        return [current.user.student_id] if current.user.student_id else []
    if current.role == Role.PARENT:
        if not current.user.guardian_id:
            return []
        guardian = await Guardian.get(current.user.guardian_id)
        return list(guardian.student_ids) if guardian else []
    return []


async def assert_student_access(current: CurrentUser, student_id: str) -> None:
    if current.role in STAFF_ROLES:
        student = await Student.get(student_id)
        if student is None or student.school_id != current.school_id:
            raise NotFoundError("Student not found")
        return
    allowed = await get_accessible_student_ids(current)
    if student_id not in (allowed or []):
        raise PermissionDeniedError("You do not have access to this student's records")


async def assert_invoice_access(current: CurrentUser, invoice: Invoice) -> None:
    if current.role in STAFF_ROLES:
        return
    allowed = await get_accessible_student_ids(current)
    if invoice.student_id not in (allowed or []):
        raise PermissionDeniedError("You do not have access to this invoice")


async def get_invoice_for_school(school_id: str, invoice_id: str) -> Invoice:
    invoice = await Invoice.get(invoice_id)
    if invoice is None or invoice.school_id != school_id:
        raise NotFoundError("Invoice not found")
    return invoice


def recompute_invoice_status(invoice: Invoice) -> InvoiceStatus:
    """Derives PENDING/PARTIALLY_PAID/PAID from amount_paid vs total_amount.
    CANCELLED is sticky (a cancelled invoice never gets auto-revived by this).
    OVERDUE is a manual/staff-set status (see update_invoice_status) and will
    be overwritten by this recompute the next time a payment lands on it —
    that's intentional, a paid invoice shouldn't stay marked overdue."""
    if invoice.status == InvoiceStatus.CANCELLED:
        return invoice.status
    if invoice.total_amount > 0 and invoice.amount_paid >= invoice.total_amount:
        return InvoiceStatus.PAID
    if invoice.amount_paid > 0:
        return InvoiceStatus.PARTIALLY_PAID
    return InvoiceStatus.PENDING


# ---------------------------------------------------------------------------
# FeeCategory
# ---------------------------------------------------------------------------


async def create_fee_category(school_id: str, payload: FeeCategoryCreateRequest) -> FeeCategoryOut:
    category = FeeCategory(school_id=school_id, **payload.model_dump())
    await category.insert()
    return to_fee_category_out(category)


async def list_fee_categories(school_id: str) -> list[FeeCategoryOut]:
    categories = await FeeCategory.find(FeeCategory.school_id == school_id).to_list()
    return [to_fee_category_out(c) for c in categories]


async def get_fee_category(school_id: str, category_id: str) -> FeeCategoryOut:
    category = await FeeCategory.get(category_id)
    if category is None or category.school_id != school_id:
        raise NotFoundError("Fee category not found")
    return to_fee_category_out(category)


async def _get_fee_category_doc(school_id: str, category_id: str) -> FeeCategory:
    category = await FeeCategory.get(category_id)
    if category is None or category.school_id != school_id:
        raise NotFoundError("Fee category not found")
    return category


async def update_fee_category(school_id: str, category_id: str, payload: FeeCategoryUpdateRequest) -> FeeCategoryOut:
    category = await _get_fee_category_doc(school_id, category_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    category.updated_at = utcnow()
    await category.save()
    return to_fee_category_out(category)


async def delete_fee_category(school_id: str, category_id: str) -> None:
    category = await _get_fee_category_doc(school_id, category_id)
    await category.delete()


# ---------------------------------------------------------------------------
# FeeStructure
# ---------------------------------------------------------------------------


async def create_fee_structure(school_id: str, payload: FeeStructureCreateRequest) -> FeeStructureOut:
    structure = FeeStructure(school_id=school_id, **payload.model_dump())
    await structure.insert()
    return to_fee_structure_out(structure)


async def list_fee_structures(
    school_id: str, academic_year_id: str | None = None, class_id: str | None = None
) -> list[FeeStructureOut]:
    query: dict = {"school_id": school_id}
    if academic_year_id is not None:
        query["academic_year_id"] = academic_year_id
    if class_id is not None:
        query["class_id"] = class_id
    structures = await FeeStructure.find(query).to_list()
    return [to_fee_structure_out(s) for s in structures]


async def _get_fee_structure_doc(school_id: str, structure_id: str) -> FeeStructure:
    structure = await FeeStructure.get(structure_id)
    if structure is None or structure.school_id != school_id:
        raise NotFoundError("Fee structure not found")
    return structure


async def get_fee_structure(school_id: str, structure_id: str) -> FeeStructureOut:
    return to_fee_structure_out(await _get_fee_structure_doc(school_id, structure_id))


async def update_fee_structure(
    school_id: str, structure_id: str, payload: FeeStructureUpdateRequest
) -> FeeStructureOut:
    structure = await _get_fee_structure_doc(school_id, structure_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(structure, field, value)
    structure.updated_at = utcnow()
    await structure.save()
    return to_fee_structure_out(structure)


async def delete_fee_structure(school_id: str, structure_id: str) -> None:
    structure = await _get_fee_structure_doc(school_id, structure_id)
    await structure.delete()


# ---------------------------------------------------------------------------
# FeeAssignment
# ---------------------------------------------------------------------------


async def create_fee_assignment(current: CurrentUser, payload: FeeAssignmentCreateRequest) -> FeeAssignmentOut:
    student = await Student.get(payload.student_id)
    if student is None or student.school_id != current.school_id:
        raise NotFoundError("Student not found")

    structure = await _get_fee_structure_doc(current.school_id, payload.fee_structure_id)

    final_amount = structure.amount - payload.discount_amount
    if final_amount < 0:
        raise ValidationAppError("Discount amount cannot exceed the fee structure amount")

    assignment = FeeAssignment(
        school_id=current.school_id,
        student_id=payload.student_id,
        fee_structure_id=payload.fee_structure_id,
        discount_amount=payload.discount_amount,
        discount_reason=payload.discount_reason,
        final_amount=final_amount,
    )
    await assignment.insert()
    return to_fee_assignment_out(assignment)


async def list_fee_assignments(current: CurrentUser, student_id: str) -> list[FeeAssignmentOut]:
    await assert_student_access(current, student_id)
    assignments = await FeeAssignment.find(
        FeeAssignment.school_id == current.school_id, FeeAssignment.student_id == student_id
    ).to_list()
    return [to_fee_assignment_out(a) for a in assignments]


async def get_fee_assignment(current: CurrentUser, assignment_id: str) -> FeeAssignmentOut:
    assignment = await FeeAssignment.get(assignment_id)
    if assignment is None or assignment.school_id != current.school_id:
        raise NotFoundError("Fee assignment not found")
    await assert_student_access(current, assignment.student_id)
    return to_fee_assignment_out(assignment)


# ---------------------------------------------------------------------------
# Invoice
# ---------------------------------------------------------------------------


async def create_invoice(current: CurrentUser, payload: InvoiceCreateRequest) -> InvoiceOut:
    student = await Student.get(payload.student_id)
    if student is None or student.school_id != current.school_id:
        raise NotFoundError("Student not found")

    total = 0.0
    for assignment_id in payload.fee_assignment_ids:
        assignment = await FeeAssignment.get(assignment_id)
        if (
            assignment is None
            or assignment.school_id != current.school_id
            or assignment.student_id != payload.student_id
        ):
            raise NotFoundError(f"Fee assignment '{assignment_id}' not found for this student")
        total += assignment.final_amount

    invoice = Invoice(
        school_id=current.school_id,
        student_id=payload.student_id,
        academic_year_id=payload.academic_year_id,
        fee_assignment_ids=payload.fee_assignment_ids,
        total_amount=total,
        amount_paid=0,
        due_date=payload.due_date,
        status=InvoiceStatus.PENDING,
    )
    await invoice.insert()

    await record_audit(
        school_id=current.school_id,
        actor_user_id=current.id,
        action="invoice.created",
        entity_type="Invoice",
        entity_id=str(invoice.id),
        details={"student_id": payload.student_id, "total_amount": total},
    )

    return to_invoice_out(invoice)


async def list_invoices(
    current: CurrentUser,
    student_id: str | None,
    status: InvoiceStatus | None,
    academic_year_id: str | None,
    params: PageParams,
) -> PageResponse[InvoiceOut]:
    query: dict = {"school_id": current.school_id}

    if current.role in STAFF_ROLES:
        if student_id is not None:
            query["student_id"] = student_id
    else:
        allowed = await get_accessible_student_ids(current) or []
        if student_id is not None:
            if student_id not in allowed:
                raise PermissionDeniedError("You do not have access to this student's invoices")
            query["student_id"] = student_id
        else:
            if not allowed:
                return PageResponse(items=[], total=0, page=params.page, page_size=params.page_size)
            query["student_id"] = {"$in": allowed}

    if status is not None:
        query["status"] = status
    if academic_year_id is not None:
        query["academic_year_id"] = academic_year_id

    total = await Invoice.find(query).count()
    invoices = await Invoice.find(query).sort(-Invoice.created_at).skip(params.skip).limit(params.page_size).to_list()
    names = await _student_names({i.student_id for i in invoices})
    return PageResponse(
        items=[to_invoice_out(i, names.get(i.student_id)) for i in invoices],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


async def get_invoice(current: CurrentUser, invoice_id: str) -> InvoiceOut:
    invoice = await get_invoice_for_school(current.school_id, invoice_id)
    await assert_invoice_access(current, invoice)
    names = await _student_names({invoice.student_id})
    return to_invoice_out(invoice, names.get(invoice.student_id))


def to_payment_out(p: Payment) -> PaymentOut:
    return PaymentOut(
        id=str(p.id), school_id=p.school_id, invoice_id=p.invoice_id, student_id=p.student_id,
        amount=p.amount, method=p.method, status=p.status, payu_txnid=p.payu_txnid,
        payu_mihpayid=p.payu_mihpayid, paid_at=p.paid_at, recorded_by=p.recorded_by,
    )


async def list_payments_for_invoice(current: CurrentUser, invoice_id: str) -> list[PaymentOut]:
    invoice = await get_invoice_for_school(current.school_id, invoice_id)
    await assert_invoice_access(current, invoice)
    payments = await Payment.find(
        Payment.school_id == current.school_id, Payment.invoice_id == str(invoice.id)
    ).sort(-Payment.created_at).to_list()
    return [to_payment_out(p) for p in payments]


async def update_invoice_status(
    current: CurrentUser, invoice_id: str, payload: InvoiceStatusUpdateRequest
) -> InvoiceOut:
    invoice = await get_invoice_for_school(current.school_id, invoice_id)
    invoice.status = payload.status
    invoice.updated_at = utcnow()
    await invoice.save()

    await record_audit(
        school_id=current.school_id,
        actor_user_id=current.id,
        action="invoice.status_updated",
        entity_type="Invoice",
        entity_id=str(invoice.id),
        details={"status": payload.status.value},
    )
    return to_invoice_out(invoice)


# ---------------------------------------------------------------------------
# Manual payments + receipt PDF
#
# Delivery choice: the receipt PDF is streamed straight back from
# POST /fees/invoices/{id}/payments/manual as `application/pdf` bytes (same
# pattern as the exam module's report card). We do NOT persist it via the
# uploads/S3 module — Payment.receipt_document_id is left unset so this slice
# stays decoupled from the uploads module owned by another agent.
# ---------------------------------------------------------------------------


async def record_manual_payment(current: CurrentUser, invoice_id: str, payload: ManualPaymentRequest) -> tuple[bytes, str]:
    if payload.method not in (PaymentMethod.CASH, PaymentMethod.CHEQUE, PaymentMethod.BANK_TRANSFER):
        raise ValidationAppError("Manual payments must use CASH, CHEQUE, or BANK_TRANSFER")

    invoice = await get_invoice_for_school(current.school_id, invoice_id)
    if invoice.status == InvoiceStatus.CANCELLED:
        raise ValidationAppError("Cannot record a payment against a cancelled invoice")

    outstanding = invoice.total_amount - invoice.amount_paid
    if payload.amount > outstanding + 1e-9:
        raise ValidationAppError(f"Amount exceeds the outstanding balance of {outstanding:.2f}")

    student = await Student.get(invoice.student_id)
    if student is None:
        raise NotFoundError("Student not found")

    payment = Payment(
        school_id=current.school_id,
        invoice_id=str(invoice.id),
        student_id=invoice.student_id,
        amount=payload.amount,
        method=payload.method,
        status=PaymentStatus.SUCCESS,
        paid_at=utcnow(),
        recorded_by=current.id,
    )
    await payment.insert()

    invoice.amount_paid += payload.amount
    invoice.status = recompute_invoice_status(invoice)
    invoice.updated_at = utcnow()
    await invoice.save()

    await record_audit(
        school_id=current.school_id,
        actor_user_id=current.id,
        action="payment.manual_recorded",
        entity_type="Payment",
        entity_id=str(payment.id),
        details={"invoice_id": str(invoice.id), "amount": payload.amount, "method": payload.method.value},
    )

    tenant = await Tenant.get(current.school_id)
    school_name = tenant.name if tenant else "School"

    pdf_bytes = build_simple_pdf(
        school_name=school_name,
        document_title="Fee Receipt",
        meta={
            "Receipt No": str(payment.id),
            "Invoice No": str(invoice.id),
            "Student": student.full_name,
            "Admission No": student.admission_no,
            "Payment Date": payment.paid_at.strftime("%d-%b-%Y %H:%M"),
            "Payment Method": payload.method.value,
        },
        table_headers=["Description", "Amount (INR)"],
        table_rows=[[payload.note or "Fee payment", f"{payload.amount:.2f}"]],
        footer_lines=[
            f"Total Invoice Amount: {invoice.total_amount:.2f}",
            f"Total Paid: {invoice.amount_paid:.2f}",
            f"Outstanding Balance: {invoice.total_amount - invoice.amount_paid:.2f}",
        ],
    )
    filename = f"receipt_{payment.id}.pdf"
    return pdf_bytes, filename
