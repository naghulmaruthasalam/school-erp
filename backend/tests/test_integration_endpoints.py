import datetime as dt

import pytest

from app.core.enums import AttendanceStatus, InvoiceStatus, PaymentMethod, PaymentStatus, Role
from app.models.attendance import StudentAttendance
from app.models.fee import Invoice, Payment
from app.models.student import Student
from tests.conftest import SCHOOL_A, SECTION_A, make_current_user, override_current_user, seed_teacher_access

TENANT = "5c0000000000000000000001"


async def _student(school_id=TENANT, section_id="sec-x", admission_no="S1", first="Ann") -> Student:
    s = Student(
        school_id=school_id,
        admission_no=admission_no,
        first_name=first,
        last_name="Lee",
        academic_year_id="ay-1",
        class_id="class-1",
        section_id=section_id,
    )
    await s.insert()
    return s


@pytest.mark.asyncio
async def test_attendance_stats_for_a_day(client):
    await seed_teacher_access()
    present = await _student(SCHOOL_A, SECTION_A, "S1", "Ann")
    absent = await _student(SCHOOL_A, SECTION_A, "S2", "Bob")
    await _student(SCHOOL_A, SECTION_A, "S3", "Cy")  # not marked yet
    today = dt.date.today()
    for st, status in ((present, AttendanceStatus.PRESENT), (absent, AttendanceStatus.ABSENT)):
        await StudentAttendance(
            school_id=SCHOOL_A, section_id=SECTION_A, student_id=str(st.id), date=today, status=status, marked_by="u1"
        ).insert()

    override_current_user(make_current_user(Role.PRINCIPAL, SCHOOL_A))
    r = await client.get("/api/v1/attendance/stats", params={"date": today.isoformat()})
    assert r.status_code == 200
    body = r.json()
    assert body["total_students"] == 3
    assert (body["present_today"], body["absent_today"], body["marked"]) == (1, 1, 2)
    assert body["attendance_rate"] == 50.0 and body["attendance_percentage"] == 50.0

    by_section = await client.get("/api/v1/attendance/stats", params={"section_id": "nope"})
    assert by_section.json()["total_students"] == 0

    override_current_user(make_current_user(Role.STUDENT, SCHOOL_A, student_id=str(present.id)))
    assert (await client.get("/api/v1/attendance/stats")).status_code == 403


@pytest.mark.asyncio
async def test_fee_stats_invoice_display_fields_and_payment_list(client):
    student = await _student(admission_no="F1", first="Fay")
    paid = Invoice(school_id=TENANT, student_id=str(student.id), academic_year_id="ay-1", total_amount=1000, amount_paid=1000, due_date=dt.date(2020, 1, 1), status=InvoiceStatus.PAID)
    open_overdue = Invoice(school_id=TENANT, student_id=str(student.id), academic_year_id="ay-1", total_amount=500, amount_paid=100, due_date=dt.date(2020, 2, 1), status=InvoiceStatus.PARTIALLY_PAID)
    await paid.insert()
    await open_overdue.insert()
    await Payment(school_id=TENANT, invoice_id=str(paid.id), student_id=str(student.id), amount=1000, method=PaymentMethod.CASH, status=PaymentStatus.SUCCESS).insert()

    override_current_user(make_current_user(Role.SCHOOL_ADMIN, TENANT))

    stats = (await client.get("/api/v1/fees/stats")).json()
    assert stats["total_expected"] == 1500 and stats["total_collected"] == 1100 and stats["total_pending"] == 400
    assert stats["collection_rate"] == stats["collection_percentage"] == 73.3
    assert stats["overdue_invoices"] == 1

    invoices = (await client.get("/api/v1/fees/invoices")).json()["items"]
    assert {i["student_name"] for i in invoices} == {"Fay Lee"}
    assert all(i["invoice_number"].startswith("INV-") and i["paid_amount"] == i["amount_paid"] for i in invoices)

    payments = (await client.get("/api/v1/payments")).json()
    assert payments["total"] == 1
    p = payments["items"][0]
    assert p["amount"] == 1000 and p["payment_method"] == "CASH" and p["student_name"] == "Fay Lee" and p["payment_date"]

    override_current_user(make_current_user(Role.STUDENT, TENANT, student_id=str(student.id)))
    assert (await client.get("/api/v1/fees/stats")).status_code == 403
    assert (await client.get("/api/v1/payments")).status_code == 403


@pytest.mark.asyncio
async def test_current_school_settings_read_and_update(client):
    from app.models.tenant import Tenant

    tenant = await Tenant.get(TENANT)
    assert tenant is not None

    override_current_user(make_current_user(Role.SCHOOL_ADMIN, TENANT))
    r = await client.get("/api/v1/schools/current")
    assert r.status_code == 200
    assert r.json()["name"] == tenant.name and r.json()["code"] == tenant.code

    patched = await client.patch(
        "/api/v1/schools/current",
        json={"phone": "9999900000", "pincode": "560001", "website": "https://school.example", "timezone": "Asia/Dubai"},
    )
    assert patched.status_code == 200
    body = patched.json()
    assert (body["phone"], body["pincode"], body["website"], body["timezone"]) == ("9999900000", "560001", "https://school.example", "Asia/Dubai")

    override_current_user(make_current_user(Role.TEACHER, TENANT, teacher_id="000000000000000000000f09"))
    assert (await client.get("/api/v1/schools/current")).status_code == 200
    assert (await client.patch("/api/v1/schools/current", json={"phone": "1"})).status_code == 403
