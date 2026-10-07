from fastapi import APIRouter, Depends, Response

from app.core.deps import CurrentUser, require_roles, require_tenant_user
from app.core.enums import ADMIN_ROLES, InvoiceStatus
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
from app.services import fee_service

router = APIRouter(prefix="/fees", tags=["fees"])

_admin_only = require_roles(*ADMIN_ROLES)

@router.get("/stats")
async def fee_stats(current: CurrentUser = Depends(_admin_only)) -> dict:
    """Totals for the admin / principal fee reports."""
    return await fee_service.fee_stats(current)


# ---------------------------------------------------------------------------
# FeeCategory
# ---------------------------------------------------------------------------


@router.post("/categories", response_model=FeeCategoryOut, status_code=201)
async def create_fee_category(
    payload: FeeCategoryCreateRequest, current: CurrentUser = Depends(_admin_only)
) -> FeeCategoryOut:
    return await fee_service.create_fee_category(current.school_id, payload)


@router.get("/categories", response_model=list[FeeCategoryOut])
async def list_fee_categories(current: CurrentUser = Depends(require_tenant_user)) -> list[FeeCategoryOut]:
    return await fee_service.list_fee_categories(current.school_id)


@router.get("/categories/{category_id}", response_model=FeeCategoryOut)
async def get_fee_category(
    category_id: str, current: CurrentUser = Depends(require_tenant_user)
) -> FeeCategoryOut:
    return await fee_service.get_fee_category(current.school_id, category_id)


@router.patch("/categories/{category_id}", response_model=FeeCategoryOut)
async def update_fee_category(
    category_id: str, payload: FeeCategoryUpdateRequest, current: CurrentUser = Depends(_admin_only)
) -> FeeCategoryOut:
    return await fee_service.update_fee_category(current.school_id, category_id, payload)


@router.delete("/categories/{category_id}", status_code=204)
async def delete_fee_category(category_id: str, current: CurrentUser = Depends(_admin_only)) -> None:
    await fee_service.delete_fee_category(current.school_id, category_id)


# ---------------------------------------------------------------------------
# FeeStructure
# ---------------------------------------------------------------------------


@router.post("/structures", response_model=FeeStructureOut, status_code=201)
async def create_fee_structure(
    payload: FeeStructureCreateRequest, current: CurrentUser = Depends(_admin_only)
) -> FeeStructureOut:
    return await fee_service.create_fee_structure(current.school_id, payload)


@router.get("/structures", response_model=list[FeeStructureOut])
async def list_fee_structures(
    academic_year_id: str | None = None,
    class_id: str | None = None,
    current: CurrentUser = Depends(require_tenant_user),
) -> list[FeeStructureOut]:
    return await fee_service.list_fee_structures(current.school_id, academic_year_id, class_id)


@router.get("/structures/{structure_id}", response_model=FeeStructureOut)
async def get_fee_structure(
    structure_id: str, current: CurrentUser = Depends(require_tenant_user)
) -> FeeStructureOut:
    return await fee_service.get_fee_structure(current.school_id, structure_id)


@router.patch("/structures/{structure_id}", response_model=FeeStructureOut)
async def update_fee_structure(
    structure_id: str, payload: FeeStructureUpdateRequest, current: CurrentUser = Depends(_admin_only)
) -> FeeStructureOut:
    return await fee_service.update_fee_structure(current.school_id, structure_id, payload)


@router.delete("/structures/{structure_id}", status_code=204)
async def delete_fee_structure(structure_id: str, current: CurrentUser = Depends(_admin_only)) -> None:
    await fee_service.delete_fee_structure(current.school_id, structure_id)


# ---------------------------------------------------------------------------
# FeeAssignment
# ---------------------------------------------------------------------------


@router.post("/assignments", response_model=FeeAssignmentOut, status_code=201)
async def create_fee_assignment(
    payload: FeeAssignmentCreateRequest, current: CurrentUser = Depends(_admin_only)
) -> FeeAssignmentOut:
    return await fee_service.create_fee_assignment(current, payload)


@router.get("/assignments", response_model=list[FeeAssignmentOut])
async def list_fee_assignments(
    student_id: str, current: CurrentUser = Depends(require_tenant_user)
) -> list[FeeAssignmentOut]:
    return await fee_service.list_fee_assignments(current, student_id)


@router.get("/assignments/{assignment_id}", response_model=FeeAssignmentOut)
async def get_fee_assignment(
    assignment_id: str, current: CurrentUser = Depends(require_tenant_user)
) -> FeeAssignmentOut:
    return await fee_service.get_fee_assignment(current, assignment_id)


# ---------------------------------------------------------------------------
# Invoice
# ---------------------------------------------------------------------------


@router.post("/invoices", response_model=InvoiceOut, status_code=201)
async def create_invoice(payload: InvoiceCreateRequest, current: CurrentUser = Depends(_admin_only)) -> InvoiceOut:
    return await fee_service.create_invoice(current, payload)


@router.get("/invoices", response_model=PageResponse[InvoiceOut])
async def list_invoices(
    student_id: str | None = None,
    status: InvoiceStatus | None = None,
    academic_year_id: str | None = None,
    params: PageParams = Depends(),
    current: CurrentUser = Depends(require_tenant_user),
) -> PageResponse[InvoiceOut]:
    return await fee_service.list_invoices(current, student_id, status, academic_year_id, params)


@router.get("/invoices/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(invoice_id: str, current: CurrentUser = Depends(require_tenant_user)) -> InvoiceOut:
    return await fee_service.get_invoice(current, invoice_id)


@router.patch("/invoices/{invoice_id}/status", response_model=InvoiceOut)
async def update_invoice_status(
    invoice_id: str, payload: InvoiceStatusUpdateRequest, current: CurrentUser = Depends(_admin_only)
) -> InvoiceOut:
    return await fee_service.update_invoice_status(current, invoice_id, payload)


@router.get("/invoices/{invoice_id}/payments", response_model=list[PaymentOut])
async def list_invoice_payments(
    invoice_id: str, current: CurrentUser = Depends(require_tenant_user)
) -> list[PaymentOut]:
    return await fee_service.list_payments_for_invoice(current, invoice_id)


@router.post("/invoices/{invoice_id}/payments/manual")
async def record_manual_payment(
    invoice_id: str, payload: ManualPaymentRequest, current: CurrentUser = Depends(_admin_only)
) -> Response:
    pdf_bytes, filename = await fee_service.record_manual_payment(current, invoice_id, payload)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
