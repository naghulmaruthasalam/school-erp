"""PayU (India) payment gateway integration.

**Checkout** — classic hosted-checkout hash flow:
1. Backend computes a SHA-512 hash over the transaction fields + merchant salt.
2. Frontend auto-submits a plain HTML form (POST) with those fields straight
   to PayU's hosted payment page (`action_url` below) — no JS SDK involved.
3. PayU redirects the browser back to our `surl` (success) or `furl`
   (failure) with the transaction result + a reverse hash, POSTed as form
   data. We verify that reverse hash before trusting the result, then
   redirect the browser on to the frontend. In parallel, PayU can also be
   configured (in the merchant dashboard, Developers → Webhooks) to POST the
   same payment result server-to-server to `handle_payu_payment_webhook` —
   more reliable than the browser redirect since it doesn't depend on the
   user's browser completing the round trip.

Hash field order follows PayU's officially documented "Hash Generation"
sequence (10 numbered udf slots, all left empty here since this app doesn't
use them) — confirmed against docs.payu.in. **Not yet exercised against a
real PayU sandbox transaction** in this environment; before production, run
one real test transaction end-to-end and confirm PayU accepts the request
hash without an "Invalid hash" error.

**Refunds** — v1 `cancel_refund_transaction` via postservice.php, authenticated
with the SAME merchant key+salt as checkout (confirmed via docs.payu.in —
this is a different, older API family from PayU's OAuth-secured products
like Payouts, which use the separate client_id/client_secret credentials;
those are stored in config but not used here since the refund/verify APIs
don't need them). Hash formula: `sha512(key|command|var1|salt)`.

Refund completion arrives asynchronously via a webhook whose JSON payload
carries **no hash** (confirmed via docs.payu.in — refund/dispute payloads
are unsigned, unlike payment payloads). Since we can't cryptographically
verify authenticity, integrity is enforced structurally instead: a refund
webhook can only transition a Payment that's genuinely in REFUND_PENDING
with a matching `refund_token` we generated ourselves — an attacker who
doesn't already know a real pending refund's token can't forge a plausible
transition.
"""

import hashlib
import secrets

import httpx

from app.core.audit import record_audit
from app.core.config import get_settings
from app.core.deps import CurrentUser
from app.core.enums import InvoiceStatus, PaymentMethod, PaymentStatus, Role
from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationAppError
from app.models.base import utcnow
from app.models.fee import Invoice, Payment
from app.schemas.payment import (
    PayUCallbackResult,
    PayUInitiateRequest,
    PayUInitiateResponse,
    PayURefundRequest,
    PayURefundResponse,
)
from app.services.fee_service import assert_invoice_access, get_invoice_for_school, recompute_invoice_status

_UDF_COUNT = 10
_ADMIN_ROLES = (Role.SCHOOL_ADMIN, Role.PRINCIPAL)


def _generate_txn_id() -> str:
    return f"txn{secrets.token_hex(10)}"


def _request_hash_fields(key: str, txnid: str, amount: str, productinfo: str, firstname: str, email: str) -> list[str]:
    return [key, txnid, amount, productinfo, firstname, email] + [""] * _UDF_COUNT


def _response_hash_fields(status: str, email: str, firstname: str, productinfo: str, amount: str, txnid: str, key: str) -> list[str]:
    return [status] + [""] * _UDF_COUNT + [email, firstname, productinfo, amount, txnid, key]


def _compute_request_hash(*, key: str, txnid: str, amount: str, productinfo: str, firstname: str, email: str, salt: str) -> str:
    fields = _request_hash_fields(key, txnid, amount, productinfo, firstname, email)
    hash_string = "|".join([*fields, salt])
    return hashlib.sha512(hash_string.encode("utf-8")).hexdigest()


def _compute_response_hash(*, salt: str, status: str, email: str, firstname: str, productinfo: str, amount: str, txnid: str, key: str) -> str:
    fields = _response_hash_fields(status, email, firstname, productinfo, amount, txnid, key)
    hash_string = "|".join([salt, *fields])
    return hashlib.sha512(hash_string.encode("utf-8")).hexdigest()


def _require_payu_config() -> tuple[str, str]:
    settings = get_settings()
    if not settings.payu_merchant_key or not settings.payu_merchant_salt:
        raise ValidationAppError(
            "PayU is not configured for this environment — set PAYU_MERCHANT_KEY and PAYU_MERCHANT_SALT"
        )
    return settings.payu_merchant_key, settings.payu_merchant_salt


async def initiate_payu_payment(current: CurrentUser, payload: PayUInitiateRequest) -> PayUInitiateResponse:
    key, salt = _require_payu_config()
    settings = get_settings()

    invoice = await get_invoice_for_school(current.school_id, payload.invoice_id)
    await assert_invoice_access(current, invoice)

    if invoice.status == InvoiceStatus.CANCELLED:
        raise ValidationAppError("Cannot pay a cancelled invoice")

    outstanding = invoice.total_amount - invoice.amount_paid
    if payload.amount > outstanding + 1e-9:
        raise ValidationAppError(f"Amount exceeds the outstanding balance of {outstanding:.2f}")

    txnid = _generate_txn_id()
    amount_str = f"{payload.amount:.2f}"
    productinfo = f"Fee payment for invoice {invoice.id}"
    firstname = current.user.full_name or "Student"
    email = current.user.email
    phone = current.user.phone or "9999999999"

    request_hash = _compute_request_hash(
        key=key, txnid=txnid, amount=amount_str, productinfo=productinfo, firstname=firstname, email=email, salt=salt
    )

    payment = Payment(
        school_id=current.school_id,
        invoice_id=str(invoice.id),
        student_id=invoice.student_id,
        amount=payload.amount,
        method=PaymentMethod.PAYU,
        status=PaymentStatus.CREATED,
        payu_txnid=txnid,
    )
    await payment.insert()

    from urllib.parse import quote

    callback_base = f"{settings.backend_base_url}{settings.api_v1_prefix}/payments/payu/callback"
    return_path_q = quote(payload.return_path, safe="")
    surl = f"{callback_base}?result=success&return_path={return_path_q}"
    furl = f"{callback_base}?result=failure&return_path={return_path_q}"

    return PayUInitiateResponse(
        payment_id=str(payment.id),
        invoice_id=str(invoice.id),
        action_url=settings.payu_base_url,
        key=key,
        txnid=txnid,
        amount=amount_str,
        productinfo=productinfo,
        firstname=firstname,
        email=email,
        phone=phone,
        surl=surl,
        furl=furl,
        hash=request_hash,
    )


async def _apply_successful_payment(payment: Payment, invoice: Invoice, *, mihpayid: str | None, response_hash: str | None) -> None:
    payment.status = PaymentStatus.SUCCESS
    payment.payu_mihpayid = mihpayid
    payment.payu_hash = response_hash
    payment.paid_at = utcnow()
    payment.updated_at = utcnow()
    await payment.save()

    invoice.amount_paid += payment.amount
    invoice.status = recompute_invoice_status(invoice)
    invoice.updated_at = utcnow()
    await invoice.save()


async def _verify_and_apply_payment_notification(form_data: dict[str, str], *, source: str) -> Payment:
    """Shared by the browser-redirect callback (surl/furl) and the
    server-to-server webhook — both carry the identical PayU payment payload
    shape, differing only in transport (redirect vs POST-and-forget) and
    who's calling it. Returns the updated Payment; never downgrades an
    already-SUCCESS payment, and always verifies the hash before trusting
    anything, per the module docstring."""
    key, salt = _require_payu_config()

    txnid = form_data.get("txnid")
    status = form_data.get("status", "failure")
    mihpayid = form_data.get("mihpayid")
    received_hash = form_data.get("hash", "")
    email = form_data.get("email", "")
    firstname = form_data.get("firstname", "")
    productinfo = form_data.get("productinfo", "")
    amount = form_data.get("amount", "")

    if not txnid:
        raise ValidationAppError("Missing txnid in PayU notification")

    payment = await Payment.find_one(Payment.payu_txnid == txnid)
    if payment is None:
        raise NotFoundError("Payment not found for this transaction")

    invoice = await Invoice.get(payment.invoice_id)
    if invoice is None:
        raise NotFoundError("Invoice not found for this payment")

    expected_hash = _compute_response_hash(
        salt=salt, status=status, email=email, firstname=firstname, productinfo=productinfo,
        amount=amount, txnid=txnid, key=key,
    )
    hash_valid = secrets.compare_digest(expected_hash, received_hash)

    if payment.status == PaymentStatus.SUCCESS:
        # Already applied — a legitimately-successful payment is never
        # downgraded by a later notification, valid hash or not (PayU may
        # resend on retry via both callback AND webhook for the same
        # transaction; a forged replay with a bad hash must be a harmless
        # no-op, not a way to flip a paid invoice back to unpaid).
        if not hash_valid:
            await record_audit(
                school_id=payment.school_id, actor_user_id=f"system:payu-{source}",
                action="payment.payu_replay_with_invalid_hash", entity_type="Payment",
                entity_id=str(payment.id), details={"txnid": txnid},
            )
    elif not hash_valid:
        payment.status = PaymentStatus.FAILED
        payment.updated_at = utcnow()
        await payment.save()
        await record_audit(
            school_id=payment.school_id, actor_user_id=f"system:payu-{source}", action="payment.payu_hash_invalid",
            entity_type="Payment", entity_id=str(payment.id), details={"txnid": txnid},
        )
    elif status == "success":
        await _apply_successful_payment(payment, invoice, mihpayid=mihpayid, response_hash=received_hash)
        await record_audit(
            school_id=payment.school_id, actor_user_id=f"system:payu-{source}", action="payment.payu_success",
            entity_type="Payment", entity_id=str(payment.id),
            details={"txnid": txnid, "mihpayid": mihpayid, "amount": payment.amount},
        )
    else:
        payment.status = PaymentStatus.FAILED
        payment.payu_mihpayid = mihpayid
        payment.updated_at = utcnow()
        await payment.save()

    return payment


async def handle_payu_callback(form_data: dict[str, str], result_hint: str, return_path: str) -> PayUCallbackResult:
    """Called from both surl and furl (PayU POSTs the same shaped payload to
    either, differing in `status`). `result_hint` comes from our own query
    param (success/failure) purely to pick a sane redirect target if the
    form itself is malformed — the actual outcome is always determined by
    verifying PayU's `status` + reverse hash, never trusted from the query
    string alone."""
    payment = await _verify_and_apply_payment_notification(form_data, source="callback")
    invoice = await Invoice.get(payment.invoice_id)

    settings = get_settings()
    # Must be absolute — this becomes an HTTP redirect Location header issued
    # by the BACKEND, so a relative path would resolve against the backend's
    # own origin, not the frontend's.
    safe_path = return_path if return_path.startswith("/") else "/parent/fees"
    query_result = "success" if payment.status == PaymentStatus.SUCCESS else "failed"
    redirect_url = f"{settings.frontend_base_url}{safe_path}?payment={query_result}&invoice_id={payment.invoice_id}"

    return PayUCallbackResult(
        payment_id=str(payment.id),
        status=payment.status,
        invoice_id=payment.invoice_id,
        invoice_status=invoice.status.value if invoice else "UNKNOWN",
        redirect_url=redirect_url,
    )


async def handle_payu_payment_webhook(form_data: dict[str, str]) -> dict:
    """Server-to-server payment webhook (PayU dashboard → Developers →
    Webhooks → Type: Payments, Events: Successful/Failed). Same verified
    payload shape and idempotency rules as the browser callback, but PayU
    doesn't expect a redirect back — just a 200 acknowledgement."""
    payment = await _verify_and_apply_payment_notification(form_data, source="webhook")
    return {"status": "ok", "payment_id": str(payment.id), "payment_status": payment.status.value}


# ---------------------------------------------------------------------------
# Refunds (v1 cancel_refund_transaction via postservice.php)
# ---------------------------------------------------------------------------


def _generate_refund_token() -> str:
    # PayU's var2 (token) is capped at 23 characters per their docs.
    return f"rfnd{secrets.token_hex(10)}"[:23]


async def initiate_refund(current: CurrentUser, payload: PayURefundRequest) -> PayURefundResponse:
    if current.role not in _ADMIN_ROLES:
        raise PermissionDeniedError("Only school admins/principals can initiate refunds")

    key, salt = _require_payu_config()
    settings = get_settings()

    payment = await Payment.get(payload.payment_id)
    if payment is None or payment.school_id != current.school_id:
        raise NotFoundError("Payment not found")
    if payment.status != PaymentStatus.SUCCESS:
        raise ValidationAppError("Only a successfully captured payment can be refunded")
    if not payment.payu_mihpayid:
        raise ValidationAppError("This payment has no PayU transaction id on record")
    if payload.amount > payment.amount + 1e-9:
        raise ValidationAppError(f"Refund amount cannot exceed the original payment amount of {payment.amount:.2f}")

    refund_token = _generate_refund_token()
    hash_string = f"{key}|cancel_refund_transaction|{payment.payu_mihpayid}|{salt}"
    refund_hash = hashlib.sha512(hash_string.encode("utf-8")).hexdigest()

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.post(
                settings.payu_postservice_url,
                data={
                    "key": key,
                    "command": "cancel_refund_transaction",
                    "var1": payment.payu_mihpayid,
                    "var2": refund_token,
                    "var3": f"{payload.amount:.2f}",
                    "hash": refund_hash,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            result = response.json()
        except httpx.HTTPError as exc:
            raise ValidationAppError(f"Could not reach PayU to initiate the refund: {exc}") from exc

    # PayU's postservice responses use status 1 = accepted, 0 = rejected.
    accepted = str(result.get("status")) == "1"
    request_id = result.get("request_id")

    payment.refund_token = refund_token
    payment.refund_amount = payload.amount
    payment.refund_request_id = str(request_id) if request_id else None
    payment.refund_initiated_by = current.id
    payment.status = PaymentStatus.REFUND_PENDING if accepted else PaymentStatus.REFUND_FAILED
    payment.updated_at = utcnow()
    await payment.save()

    await record_audit(
        school_id=current.school_id, actor_user_id=current.id,
        action="payment.refund_initiated" if accepted else "payment.refund_rejected",
        entity_type="Payment", entity_id=str(payment.id),
        details={"amount": payload.amount, "reason": payload.reason, "payu_response": result},
    )

    if not accepted:
        raise ValidationAppError(f"PayU rejected the refund request: {result.get('msg', 'unknown error')}")

    return PayURefundResponse(
        payment_id=str(payment.id),
        status=payment.status,
        refund_token=refund_token,
        refund_request_id=payment.refund_request_id,
        message=result.get("msg", "Refund request accepted by PayU"),
    )


async def handle_payu_refund_webhook(payload: dict) -> dict:
    """Server-to-server refund webhook (PayU dashboard → Developers →
    Webhooks → Type: Payments, Event: Refund). JSON body, per PayU's own
    docs carries NO hash — see module docstring for how authenticity is
    enforced structurally instead via `refund_token` + required
    REFUND_PENDING state."""
    token = payload.get("token")
    status = payload.get("status", "failure")

    if not token:
        raise ValidationAppError("Missing token in PayU refund webhook")

    payment = await Payment.find_one(Payment.refund_token == token)
    if payment is None:
        # Unknown token — never acted on, and never will be (no matching
        # pending refund exists to apply it to).
        return {"status": "ignored", "reason": "unknown refund token"}

    if payment.status != PaymentStatus.REFUND_PENDING:
        # Already resolved (or was never actually pending) — idempotent no-op.
        return {"status": "noop", "payment_id": str(payment.id), "payment_status": payment.status.value}

    invoice = await Invoice.get(payment.invoice_id)

    if status == "success":
        payment.status = PaymentStatus.REFUNDED
        payment.refunded_at = utcnow()
        payment.updated_at = utcnow()
        await payment.save()

        if invoice is not None:
            invoice.amount_paid = max(0.0, invoice.amount_paid - (payment.refund_amount or payment.amount))
            invoice.status = recompute_invoice_status(invoice)
            invoice.updated_at = utcnow()
            await invoice.save()

        await record_audit(
            school_id=payment.school_id, actor_user_id="system:payu-refund-webhook", action="payment.refund_success",
            entity_type="Payment", entity_id=str(payment.id),
            details={"refund_token": token, "amount": payment.refund_amount},
        )
    else:
        payment.status = PaymentStatus.REFUND_FAILED
        payment.updated_at = utcnow()
        await payment.save()
        await record_audit(
            school_id=payment.school_id, actor_user_id="system:payu-refund-webhook", action="payment.refund_failed",
            entity_type="Payment", entity_id=str(payment.id), details={"refund_token": token},
        )

    return {"status": "processed", "payment_id": str(payment.id), "payment_status": payment.status.value}
