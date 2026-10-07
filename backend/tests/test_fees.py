import pytest

from app.api.v1.fees import router as fees_router
from app.core.config import get_settings
from app.core.enums import FeeFrequency, Role
from app.main import app as fastapi_app
from app.models.guardian import Guardian
from app.models.student import Student
from tests.conftest import make_current_user, override_current_user

_settings = get_settings()
if not any(r.path.startswith(f"{_settings.api_v1_prefix}/fees") for r in fastapi_app.routes):
    fastapi_app.include_router(fees_router, prefix=_settings.api_v1_prefix)

SCHOOL_A = "000000000000000000000a01"
SCHOOL_B = "000000000000000000000b01"


async def _make_student(school_id: str, admission_no: str = "A001") -> Student:
    student = Student(
        school_id=school_id,
        admission_no=admission_no,
        first_name="Tom",
        last_name="Test",
        academic_year_id="ay-1",
        class_id="class-1",
        section_id="section-1",
    )
    await student.insert()
    return student


async def _setup_structure(client, school_id: str, amount: float = 1000) -> str:
    admin = make_current_user(Role.SCHOOL_ADMIN, school_id)
    override_current_user(admin)

    r_cat = await client.post("/api/v1/fees/categories", json={"name": "Tuition"})
    assert r_cat.status_code == 201
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
    assert r_struct.status_code == 201
    return r_struct.json()["id"]


@pytest.mark.asyncio
async def test_assignment_invoice_manual_payment_flow_updates_status(client):
    student = await _make_student(SCHOOL_A, "A100")
    structure_id = await _setup_structure(client, SCHOOL_A, amount=1000)

    admin = make_current_user(Role.SCHOOL_ADMIN, SCHOOL_A)
    override_current_user(admin)

    r_assign = await client.post(
        "/api/v1/fees/assignments",
        json={
            "student_id": str(student.id),
            "fee_structure_id": structure_id,
            "discount_amount": 100,
            "discount_reason": "sibling discount",
        },
    )
    assert r_assign.status_code == 201
    assignment = r_assign.json()
    assert assignment["final_amount"] == 900

    r_invoice = await client.post(
        "/api/v1/fees/invoices",
        json={
            "student_id": str(student.id),
            "academic_year_id": "ay-1",
            "fee_assignment_ids": [assignment["id"]],
            "due_date": "2026-12-31",
        },
    )
    assert r_invoice.status_code == 201
    invoice = r_invoice.json()
    assert invoice["total_amount"] == 900
    assert invoice["status"] == "PENDING"
    invoice_id = invoice["id"]

    # First partial manual payment
    r_pay1 = await client.post(
        f"/api/v1/fees/invoices/{invoice_id}/payments/manual",
        json={"amount": 400, "method": "CASH"},
    )
    assert r_pay1.status_code == 200
    assert r_pay1.headers["content-type"] == "application/pdf"
    assert len(r_pay1.content) > 0

    r_get1 = await client.get(f"/api/v1/fees/invoices/{invoice_id}")
    assert r_get1.status_code == 200
    assert r_get1.json()["status"] == "PARTIALLY_PAID"
    assert r_get1.json()["amount_paid"] == 400

    # Second payment pays it off fully
    r_pay2 = await client.post(
        f"/api/v1/fees/invoices/{invoice_id}/payments/manual",
        json={"amount": 500, "method": "BANK_TRANSFER"},
    )
    assert r_pay2.status_code == 200

    r_get2 = await client.get(f"/api/v1/fees/invoices/{invoice_id}")
    assert r_get2.json()["status"] == "PAID"
    assert r_get2.json()["amount_paid"] == 900
    assert r_get2.json()["outstanding_amount"] == 0

    # Overpaying beyond outstanding balance is rejected
    r_over = await client.post(
        f"/api/v1/fees/invoices/{invoice_id}/payments/manual",
        json={"amount": 1, "method": "CASH"},
    )
    assert r_over.status_code == 422

    # PAYU is not a valid manual method (it's the online gateway, not a manual one)
    r_bad_method = await client.post(
        f"/api/v1/fees/invoices/{invoice_id}/payments/manual",
        json={"amount": 1, "method": "PAYU"},
    )
    assert r_bad_method.status_code == 422


@pytest.mark.asyncio
async def test_student_role_cannot_manage_fee_categories(client):
    student = await _make_student(SCHOOL_A, "A101")
    override_current_user(make_current_user(Role.STUDENT, SCHOOL_A, student_id=str(student.id)))

    r = await client.post("/api/v1/fees/categories", json={"name": "Transport"})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_tenant_isolation_on_assignment_and_invoice(client):
    student_a = await _make_student(SCHOOL_A, "A200")
    structure_id = await _setup_structure(client, SCHOOL_A, amount=500)

    # An admin of school B cannot assign a fee structure to a student of school A
    admin_b = make_current_user(Role.SCHOOL_ADMIN, SCHOOL_B)
    override_current_user(admin_b)

    r_assign_cross = await client.post(
        "/api/v1/fees/assignments",
        json={"student_id": str(student_a.id), "fee_structure_id": structure_id},
    )
    assert r_assign_cross.status_code == 404

    # Nor can they see school A's fee structure
    r_get_cross = await client.get(f"/api/v1/fees/structures/{structure_id}")
    assert r_get_cross.status_code == 404


@pytest.mark.asyncio
async def test_parent_can_only_see_own_childs_invoices(client):
    child = await _make_student(SCHOOL_A, "A300")
    other_student = await _make_student(SCHOOL_A, "A301")

    guardian = Guardian(school_id=SCHOOL_A, full_name="Parent One", phone="9000000000", student_ids=[str(child.id)])
    await guardian.insert()

    structure_id = await _setup_structure(client, SCHOOL_A, amount=1200)

    admin = make_current_user(Role.SCHOOL_ADMIN, SCHOOL_A)
    override_current_user(admin)
    r_assign = await client.post(
        "/api/v1/fees/assignments",
        json={"student_id": str(child.id), "fee_structure_id": structure_id},
    )
    assignment_id = r_assign.json()["id"]
    r_invoice = await client.post(
        "/api/v1/fees/invoices",
        json={
            "student_id": str(child.id),
            "academic_year_id": "ay-1",
            "fee_assignment_ids": [assignment_id],
            "due_date": "2026-12-31",
        },
    )
    invoice_id = r_invoice.json()["id"]

    r_assign_other = await client.post(
        "/api/v1/fees/assignments",
        json={"student_id": str(other_student.id), "fee_structure_id": structure_id},
    )
    other_assignment_id = r_assign_other.json()["id"]
    r_invoice_other = await client.post(
        "/api/v1/fees/invoices",
        json={
            "student_id": str(other_student.id),
            "academic_year_id": "ay-1",
            "fee_assignment_ids": [other_assignment_id],
            "due_date": "2026-12-31",
        },
    )
    other_invoice_id = r_invoice_other.json()["id"]

    parent = make_current_user(Role.PARENT, SCHOOL_A, guardian_id=str(guardian.id))
    override_current_user(parent)

    r_own = await client.get(f"/api/v1/fees/invoices/{invoice_id}")
    assert r_own.status_code == 200

    r_other = await client.get(f"/api/v1/fees/invoices/{other_invoice_id}")
    assert r_other.status_code == 403

    r_list = await client.get("/api/v1/fees/invoices")
    assert r_list.status_code == 200
    ids = [i["id"] for i in r_list.json()["items"]]
    assert invoice_id in ids
    assert other_invoice_id not in ids

    # Parent cannot record a manual payment (staff-only action)
    r_pay = await client.post(
        f"/api/v1/fees/invoices/{invoice_id}/payments/manual",
        json={"amount": 100, "method": "CASH"},
    )
    assert r_pay.status_code == 403
