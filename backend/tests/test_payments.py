import hashlib

import pytest

from app.services import payment_service

from app.api.v1.fees import router as fees_router
from app.api.v1.payments import router as payments_router
from app.core.config import get_settings
from app.core.enums import FeeFrequency, Role
from app.main import app as fastapi_app
from app.models.guardian import Guardian
from app.models.student import Student
from tests.conftest import make_current_user, override_current_user

_settings = get_settings()
if not any(r.path.startswith(f"{_settings.api_v1_prefix}/fees") for r in fastapi_app.routes):
    fastapi_app.include_router(fees_router, prefix=_settings.api_v1_prefix)
if not any(r.path.startswith(f"{_settings.api_v1_prefix}/payments") for r in fastapi_app.routes):
    fastapi_app.include_router(payments_router, prefix=_settings.api_v1_prefix)

SCHOOL_A = "000000000000000000000a01"
SCHOOL_B = "000000000000000000000b01"
MERCHANT_KEY = "test_merchant_key"
MERCHANT_SALT = "test_merchant_salt"
UDF_BLANKS = "|".join([""] * 10)


@pytest.fixture(autouse=True)
def _payu_config(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "payu_merchant_key", MERCHANT_KEY)
    monkeypatch.setattr(settings, "payu_merchant_salt", MERCHANT_SALT)
    monkeypatch.setattr(settings, "backend_base_url", "http://backend.test")
    monkeypatch.setattr(settings, "frontend_base_url", "http://frontend.test")
    yield


def _response_hash(*, status: str, email: str, firstname: str, productinfo: str, amount: str, txnid: str) -> str:
    """Mirrors PayU's reverse-hash formula exactly as payment_service computes
    it, so tests can forge a plausible PayU callback without a real account."""
    raw = f"{MERCHANT_SALT}|{status}|{UDF_BLANKS}|{email}|{firstname}|{productinfo}|{amount}|{txnid}|{MERCHANT_KEY}"
    return hashlib.sha512(raw.encode("utf-8")).hexdigest()


async def _make_student(school_id: str, admission_no: str) -> Student:
    student = Student(
        school_id=school_id,
        admission_no=admission_no,
        first_name="Kid",
        last_name="Test",
        academic_year_id="ay-1",
        class_id="class-1",
        section_id="section-1",
    )
    await student.insert()
    return student


async def _make_invoice(client, school_id: str, student_id: str, amount: float) -> str:
    admin = make_current_user(Role.SCHOOL_ADMIN, school_id)
    override_current_user(admin)

    r_cat = await client.post("/api/v1/fees/categories", json={"name": "Tuition"})
    category_id = r_cat.json()["id"]
    r_struct = await client.post(
        "/api/v1/fees/structures",
        json={
            "academic_year_id": "ay-1",
            "class_id": "class-1",
            "category_id": category_id,
            "amount": amount,
            "frequency": FeeFrequency.ANNUAL.value,
        },
    )
    structure_id = r_struct.json()["id"]
    r_assign = await client.post(
        "/api/v1/fees/assignments",
        json={"student_id": student_id, "fee_structure_id": structure_id},
    )
    assignment_id = r_assign.json()["id"]
    r_invoice = await client.post(
        "/api/v1/fees/invoices",
        json={
            "student_id": student_id,
            "academic_year_id": "ay-1",
            "fee_assignment_ids": [assignment_id],
            "due_date": "2026-12-31",
        },
    )
    return r_invoice.json()["id"]


@pytest.mark.asyncio
async def test_parent_can_initiate_only_for_own_childs_invoice(client):
    child = await _make_student(SCHOOL_A, "P001")
    other_student = await _make_student(SCHOOL_A, "P002")

    guardian = Guardian(school_id=SCHOOL_A, full_name="Parent", phone="9111111111", student_ids=[str(child.id)])
    await guardian.insert()

    invoice_id = await _make_invoice(client, SCHOOL_A, str(child.id), 1000)
    other_invoice_id = await _make_invoice(client, SCHOOL_A, str(other_student.id), 800)

    parent = make_current_user(Role.PARENT, SCHOOL_A, guardian_id=str(guardian.id))
    override_current_user(parent)

    r_ok = await client.post(
        "/api/v1/payments/payu/initiate", json={"invoice_id": invoice_id, "amount": 500}
    )
    assert r_ok.status_code == 201
    body = r_ok.json()
    assert body["txnid"].startswith("txn")
    assert body["amount"] == "500.00"
    assert body["key"] == MERCHANT_KEY
    assert body["action_url"] == _settings.payu_base_url
    assert body["surl"].startswith("http://backend.test/api/v1/payments/payu/callback")
    assert len(body["hash"]) == 128  # sha512 hex digest

    r_forbidden = await client.post(
        "/api/v1/payments/payu/initiate", json={"invoice_id": other_invoice_id, "amount": 100}
    )
    assert r_forbidden.status_code == 403

    # Cannot request more than the outstanding balance
    r_too_much = await client.post(
        "/api/v1/payments/payu/initiate", json={"invoice_id": invoice_id, "amount": 999999}
    )
    assert r_too_much.status_code == 422


@pytest.mark.asyncio
async def test_callback_accepts_valid_hash_and_rejects_tampered(client):
    student = await _make_student(SCHOOL_A, "P010")
    invoice_id = await _make_invoice(client, SCHOOL_A, str(student.id), 1000)

    admin = make_current_user(Role.SCHOOL_ADMIN, SCHOOL_A)
    override_current_user(admin)

    r_initiate = await client.post(
        "/api/v1/payments/payu/initiate", json={"invoice_id": invoice_id, "amount": 400}
    )
    initiated = r_initiate.json()
    txnid = initiated["txnid"]

    valid_hash = _response_hash(
        status="success", email=initiated["email"], firstname=initiated["firstname"],
        productinfo=initiated["productinfo"], amount=initiated["amount"], txnid=txnid,
    )

    r_callback = await client.post(
        "/api/v1/payments/payu/callback",
        params={"result": "success", "return_path": "/admin/fees"},
        data={
            "txnid": txnid,
            "status": "success",
            "mihpayid": "payu_fake_1",
            "hash": valid_hash,
            "email": initiated["email"],
            "firstname": initiated["firstname"],
            "productinfo": initiated["productinfo"],
            "amount": initiated["amount"],
        },
        follow_redirects=False,
    )
    assert r_callback.status_code == 303
    assert r_callback.headers["location"].startswith("http://frontend.test/admin/fees?payment=success")

    r_invoice = await client.get(f"/api/v1/fees/invoices/{invoice_id}")
    assert r_invoice.json()["amount_paid"] == 400
    assert r_invoice.json()["status"] == "PARTIALLY_PAID"

    # Idempotent redelivery of the same successful callback must not double-apply
    r_callback_again = await client.post(
        "/api/v1/payments/payu/callback",
        params={"result": "success", "return_path": "/admin/fees"},
        data={
            "txnid": txnid,
            "status": "success",
            "mihpayid": "payu_fake_1",
            "hash": valid_hash,
            "email": initiated["email"],
            "firstname": initiated["firstname"],
            "productinfo": initiated["productinfo"],
            "amount": initiated["amount"],
        },
        follow_redirects=False,
    )
    assert r_callback_again.status_code == 303
    r_invoice_after = await client.get(f"/api/v1/fees/invoices/{invoice_id}")
    assert r_invoice_after.json()["amount_paid"] == 400  # not double-applied

    # Fresh transaction + tampered hash must be rejected (marked FAILED, invoice untouched)
    r_initiate2 = await client.post(
        "/api/v1/payments/payu/initiate", json={"invoice_id": invoice_id, "amount": 100}
    )
    initiated2 = r_initiate2.json()
    r_bad_callback = await client.post(
        "/api/v1/payments/payu/callback",
        params={"result": "success", "return_path": "/admin/fees"},
        data={
            "txnid": initiated2["txnid"],
            "status": "success",
            "mihpayid": "payu_fake_2",
            "hash": "not-a-real-hash",
            "email": initiated2["email"],
            "firstname": initiated2["firstname"],
            "productinfo": initiated2["productinfo"],
            "amount": initiated2["amount"],
        },
        follow_redirects=False,
    )
    assert r_bad_callback.status_code == 303
    assert "payment=failed" in r_bad_callback.headers["location"]

    r_invoice_final = await client.get(f"/api/v1/fees/invoices/{invoice_id}")
    assert r_invoice_final.json()["amount_paid"] == 400  # unaffected by the failed/tampered attempt


@pytest.mark.asyncio
async def test_callback_marks_failed_status_without_touching_invoice(client):
    student = await _make_student(SCHOOL_A, "P011")
    invoice_id = await _make_invoice(client, SCHOOL_A, str(student.id), 1000)

    admin = make_current_user(Role.SCHOOL_ADMIN, SCHOOL_A)
    override_current_user(admin)

    r_initiate = await client.post(
        "/api/v1/payments/payu/initiate", json={"invoice_id": invoice_id, "amount": 300}
    )
    initiated = r_initiate.json()
    txnid = initiated["txnid"]

    failure_hash = _response_hash(
        status="failure", email=initiated["email"], firstname=initiated["firstname"],
        productinfo=initiated["productinfo"], amount=initiated["amount"], txnid=txnid,
    )

    r_callback = await client.post(
        "/api/v1/payments/payu/callback",
        params={"result": "failure", "return_path": "/parent/fees"},
        data={
            "txnid": txnid,
            "status": "failure",
            "hash": failure_hash,
            "email": initiated["email"],
            "firstname": initiated["firstname"],
            "productinfo": initiated["productinfo"],
            "amount": initiated["amount"],
        },
        follow_redirects=False,
    )
    assert r_callback.status_code == 303
    assert "payment=failed" in r_callback.headers["location"]

    r_invoice = await client.get(f"/api/v1/fees/invoices/{invoice_id}")
    assert r_invoice.json()["amount_paid"] == 0
    assert r_invoice.json()["status"] == "PENDING"


@pytest.mark.asyncio
async def test_tenant_isolation_on_initiate(client):
    student_a = await _make_student(SCHOOL_A, "P020")
    invoice_id = await _make_invoice(client, SCHOOL_A, str(student_a.id), 1000)

    admin_b = make_current_user(Role.SCHOOL_ADMIN, SCHOOL_B)
    override_current_user(admin_b)

    r = await client.post("/api/v1/payments/payu/initiate", json={"invoice_id": invoice_id, "amount": 100})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_initiate_without_payu_config_returns_clear_error(client, monkeypatch):
    student = await _make_student(SCHOOL_A, "P030")
    invoice_id = await _make_invoice(client, SCHOOL_A, str(student.id), 1000)

    settings = get_settings()
    monkeypatch.setattr(settings, "payu_merchant_key", None)

    admin = make_current_user(Role.SCHOOL_ADMIN, SCHOOL_A)
    override_current_user(admin)

    r = await client.post("/api/v1/payments/payu/initiate", json={"invoice_id": invoice_id, "amount": 100})
    assert r.status_code == 422
    assert "PayU is not configured" in r.json()["detail"]


# ---------------------------------------------------------------------------
# Refunds
# ---------------------------------------------------------------------------


class _FakeHttpResponse:
    def __init__(self, json_body: dict):
        self._json_body = json_body

    def raise_for_status(self):
        pass

    def json(self):
        return self._json_body


class _FakeAsyncClient:
    """Stands in for httpx.AsyncClient so refund tests never hit the real
    PayU postservice endpoint. Captures the last POST for assertions."""

    last_post_kwargs = None
    next_response = {"status": "1", "request_id": "req_fake_1", "msg": "Refund request accepted"}

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def post(self, url, **kwargs):
        _FakeAsyncClient.last_post_kwargs = {"url": url, **kwargs}
        return _FakeHttpResponse(_FakeAsyncClient.next_response)


@pytest.fixture(autouse=True)
def _fake_payu_http(monkeypatch):
    _FakeAsyncClient.next_response = {"status": "1", "request_id": "req_fake_1", "msg": "Refund request accepted"}
    monkeypatch.setattr(payment_service.httpx, "AsyncClient", _FakeAsyncClient)
    yield


async def _make_successful_payment(client, school_id: str, student_id: str, invoice_amount: float, pay_amount: float):
    """Returns (invoice_id, payment_id) for a fully-verified SUCCESS payment,
    so refund tests have something real to refund against."""
    invoice_id = await _make_invoice(client, school_id, student_id, invoice_amount)

    admin = make_current_user(Role.SCHOOL_ADMIN, school_id)
    override_current_user(admin)

    r_initiate = await client.post(
        "/api/v1/payments/payu/initiate", json={"invoice_id": invoice_id, "amount": pay_amount}
    )
    initiated = r_initiate.json()
    txnid = initiated["txnid"]
    valid_hash = _response_hash(
        status="success", email=initiated["email"], firstname=initiated["firstname"],
        productinfo=initiated["productinfo"], amount=initiated["amount"], txnid=txnid,
    )
    await client.post(
        "/api/v1/payments/payu/callback",
        params={"result": "success", "return_path": "/admin/fees"},
        data={
            "txnid": txnid, "status": "success", "mihpayid": f"mihpay_{txnid}", "hash": valid_hash,
            "email": initiated["email"], "firstname": initiated["firstname"],
            "productinfo": initiated["productinfo"], "amount": initiated["amount"],
        },
        follow_redirects=False,
    )
    return invoice_id, initiated["payment_id"]


@pytest.mark.asyncio
async def test_refund_initiate_updates_invoice_and_payment_on_webhook(client):
    student = await _make_student(SCHOOL_A, "R001")
    invoice_id, payment_id = await _make_successful_payment(client, SCHOOL_A, str(student.id), 1000, 600)

    admin = make_current_user(Role.SCHOOL_ADMIN, SCHOOL_A)
    override_current_user(admin)

    r_refund = await client.post(
        "/api/v1/payments/payu/refund", json={"payment_id": payment_id, "amount": 600, "reason": "test refund"}
    )
    assert r_refund.status_code == 202
    body = r_refund.json()
    assert body["status"] == "REFUND_PENDING"
    assert body["refund_request_id"] == "req_fake_1"
    refund_token = body["refund_token"]
    assert len(refund_token) <= 23

    # PayU was called with the right command/hash inputs
    sent = _FakeAsyncClient.last_post_kwargs
    assert sent["data"]["command"] == "cancel_refund_transaction"
    assert sent["data"]["key"] == MERCHANT_KEY
    assert sent["data"]["var2"] == refund_token

    # Invoice not yet touched — refund only applies once PayU confirms via webhook
    r_invoice_before = await client.get(f"/api/v1/fees/invoices/{invoice_id}")
    assert r_invoice_before.json()["amount_paid"] == 600

    # PayU confirms the refund asynchronously
    r_webhook = await client.post(
        "/api/v1/payments/payu/webhook/refund",
        json={"status": "success", "token": refund_token, "amt": "600.00", "request_id": "req_fake_1", "action": "refund"},
    )
    assert r_webhook.status_code == 200
    assert r_webhook.json()["payment_status"] == "REFUNDED"

    r_invoice_after = await client.get(f"/api/v1/fees/invoices/{invoice_id}")
    assert r_invoice_after.json()["amount_paid"] == 0
    assert r_invoice_after.json()["status"] == "PENDING"

    # Idempotent redelivery of the same refund webhook must not double-apply
    r_webhook_again = await client.post(
        "/api/v1/payments/payu/webhook/refund",
        json={"status": "success", "token": refund_token, "amt": "600.00"},
    )
    assert r_webhook_again.status_code == 200
    assert r_webhook_again.json()["status"] == "noop"
    r_invoice_final = await client.get(f"/api/v1/fees/invoices/{invoice_id}")
    assert r_invoice_final.json()["amount_paid"] == 0


@pytest.mark.asyncio
async def test_refund_webhook_with_unknown_token_is_ignored(client):
    student = await _make_student(SCHOOL_A, "R002")
    await _make_successful_payment(client, SCHOOL_A, str(student.id), 1000, 400)

    r_webhook = await client.post(
        "/api/v1/payments/payu/webhook/refund",
        json={"status": "success", "token": "totally-unknown-token", "amt": "400.00"},
    )
    assert r_webhook.status_code == 200
    assert r_webhook.json()["status"] == "ignored"


@pytest.mark.asyncio
async def test_refund_webhook_failure_marks_payment_refund_failed(client):
    student = await _make_student(SCHOOL_A, "R003")
    invoice_id, payment_id = await _make_successful_payment(client, SCHOOL_A, str(student.id), 1000, 500)

    admin = make_current_user(Role.SCHOOL_ADMIN, SCHOOL_A)
    override_current_user(admin)
    r_refund = await client.post("/api/v1/payments/payu/refund", json={"payment_id": payment_id, "amount": 500})
    refund_token = r_refund.json()["refund_token"]

    r_webhook = await client.post(
        "/api/v1/payments/payu/webhook/refund",
        json={"status": "failure", "token": refund_token, "amt": "500.00"},
    )
    assert r_webhook.status_code == 200
    assert r_webhook.json()["payment_status"] == "REFUND_FAILED"

    # Invoice amount_paid is untouched by a failed refund
    r_invoice = await client.get(f"/api/v1/fees/invoices/{invoice_id}")
    assert r_invoice.json()["amount_paid"] == 500


@pytest.mark.asyncio
async def test_refund_requires_admin_role(client):
    student = await _make_student(SCHOOL_A, "R004")
    _, payment_id = await _make_successful_payment(client, SCHOOL_A, str(student.id), 1000, 300)

    teacher = make_current_user(Role.TEACHER, SCHOOL_A, teacher_id="teacher-1")
    override_current_user(teacher)
    r = await client.post("/api/v1/payments/payu/refund", json={"payment_id": payment_id, "amount": 300})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_refund_cannot_exceed_original_payment_amount(client):
    student = await _make_student(SCHOOL_A, "R005")
    _, payment_id = await _make_successful_payment(client, SCHOOL_A, str(student.id), 1000, 200)

    admin = make_current_user(Role.SCHOOL_ADMIN, SCHOOL_A)
    override_current_user(admin)
    r = await client.post("/api/v1/payments/payu/refund", json={"payment_id": payment_id, "amount": 9999})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_payu_rejected_refund_is_surfaced_as_error(client):
    student = await _make_student(SCHOOL_A, "R006")
    _, payment_id = await _make_successful_payment(client, SCHOOL_A, str(student.id), 1000, 250)

    _FakeAsyncClient.next_response = {"status": "0", "msg": "Amount is greater than transaction amount"}

    admin = make_current_user(Role.SCHOOL_ADMIN, SCHOOL_A)
    override_current_user(admin)
    r = await client.post("/api/v1/payments/payu/refund", json={"payment_id": payment_id, "amount": 250})
    assert r.status_code == 422
    assert "PayU rejected" in r.json()["detail"]
