from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import RedirectResponse

from app.core.deps import CurrentUser, require_tenant_user
from app.schemas.common import PageParams, PageResponse
from app.schemas.payment import (
    PayUInitiateRequest,
    PayUInitiateResponse,
    PayURefundRequest,
    PayURefundResponse,
)
from app.services import fee_service, payment_service

router = APIRouter(prefix="/payments", tags=["payments"])


@router.get("", response_model=PageResponse[dict])
async def list_payments(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    current: CurrentUser = Depends(require_tenant_user),
) -> PageResponse[dict]:
    """School payments list for the admin fee screens."""
    return await fee_service.list_payments(current, PageParams(page=page, page_size=page_size))


@router.post("/payu/initiate", response_model=PayUInitiateResponse, status_code=201)
async def initiate_payu_payment(
    payload: PayUInitiateRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> PayUInitiateResponse:
    """STUDENT/PARENT may initiate a payment only for their own/child's
    invoice; staff may do so on behalf of any student in the school —
    scoping is enforced in payment_service via fee_service's
    assert_invoice_access. Returns the fields the frontend auto-submits as
    an HTML form POST straight to PayU's hosted checkout page."""
    return await payment_service.initiate_payu_payment(current, payload)


@router.post("/payu/callback")
@router.get("/payu/callback")
async def payu_callback(request: Request) -> RedirectResponse:
    """Unauthenticated — PayU redirects the user's browser here (as a POST
    with form-encoded transaction data) after a payment attempt, once for
    the success URL (surl) and once for the failure URL (furl); both point
    here, differentiated by the `result` query param we set at initiation
    time. The actual outcome is always determined by PayU's own `status`
    field + reverse hash verification, never trusted from the query string.
    Ends in a redirect back to the frontend."""
    result_hint = request.query_params.get("result", "failure")
    return_path = request.query_params.get("return_path", "/parent/fees")

    if request.method == "POST":
        form = await request.form()
        form_data = {k: str(v) for k, v in form.items()}
    else:
        form_data = dict(request.query_params)

    outcome = await payment_service.handle_payu_callback(form_data, result_hint, return_path)
    return RedirectResponse(url=outcome.redirect_url, status_code=303)


@router.post("/payu/webhook")
async def payu_payment_webhook(request: Request) -> dict:
    """Unauthenticated — configure this URL in the PayU merchant dashboard
    under Developers → Webhooks, Type: Payments, Events: Successful + Failed.
    Server-to-server, form-urlencoded, same payload shape as the checkout
    callback. More reliable than the browser callback since it doesn't
    depend on the user's browser completing the redirect."""
    form = await request.form()
    form_data = {k: str(v) for k, v in form.items()}
    return await payment_service.handle_payu_payment_webhook(form_data)


@router.post("/payu/webhook/refund")
async def payu_refund_webhook(request: Request) -> dict:
    """Unauthenticated — configure this URL in the PayU merchant dashboard
    under Developers → Webhooks, Type: Payments, Event: Refund. JSON body.
    See payment_service.handle_payu_refund_webhook for how authenticity is
    enforced (PayU sends no hash on refund payloads)."""
    payload = await request.json()
    return await payment_service.handle_payu_refund_webhook(payload)


@router.post("/payu/refund", response_model=PayURefundResponse, status_code=202)
async def initiate_payu_refund(
    payload: PayURefundRequest,
    current: CurrentUser = Depends(require_tenant_user),
) -> PayURefundResponse:
    """SCHOOL_ADMIN/PRINCIPAL only (enforced in payment_service). Calls
    PayU's cancel_refund_transaction API synchronously to request the
    refund; PayU confirms actual completion asynchronously via the refund
    webhook above (status goes CREATED→SUCCESS→REFUND_PENDING→REFUNDED, or
    →REFUND_FAILED if PayU rejects it either at request time or later)."""
    return await payment_service.initiate_refund(current, payload)
