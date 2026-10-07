from datetime import date

import pytest

from app.api.v1.admissions import router as admissions_router
from app.core.enums import AdmissionStatus, Role, StudentStatus
from app.main import app
from app.models.academic import AcademicYear, Class, Section
from app.models.audit_log import AuditLog
from app.models.guardian import Guardian
from app.models.student import Student
from app.models.tenant import Tenant
from app.models.user import User
from tests.conftest import make_current_user, override_current_user

# This module isn't wired into app/api/v1/router.py yet (that shared file is
# reserved for a later integration pass across all in-flight modules) — mount
# it here so these tests can exercise the real HTTP layer.
if not any(getattr(r, "path", "").startswith("/api/v1/admissions") for r in app.routes):
    app.include_router(admissions_router, prefix="/api/v1")


async def _make_school(code: str) -> str:
    tenant = Tenant(name=f"School {code}", code=code)
    await tenant.insert()
    return str(tenant.id)


async def _make_academic_setup(school_id: str) -> tuple[str, str, str]:
    year = AcademicYear(school_id=school_id, name="2026-2027", start_date=date(2026, 6, 1), end_date=date(2027, 4, 30))
    await year.insert()
    klass = Class(school_id=school_id, academic_year_id=str(year.id), name="Class 5", order=5)
    await klass.insert()
    section = Section(school_id=school_id, class_id=str(klass.id), name="A")
    await section.insert()
    return str(year.id), str(klass.id), str(section.id)


@pytest.mark.asyncio
async def test_create_admission_admin_ok(client):
    school_id = await _make_school("ADM1")
    current = make_current_user(Role.SCHOOL_ADMIN, school_id)
    override_current_user(current)

    r = await client.post(
        "/api/v1/admissions",
        json={
            "applicant_first_name": "Asha",
            "applicant_last_name": "Rao",
            "applying_for_class_id": "class-x",
            "guardian_name": "Ravi Rao",
            "guardian_phone": "9990001111",
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == AdmissionStatus.SUBMITTED.value


@pytest.mark.asyncio
async def test_create_admission_forbidden_for_teacher(client):
    school_id = await _make_school("ADM2")
    override_current_user(make_current_user(Role.TEACHER, school_id, teacher_id="t1"))

    r = await client.post(
        "/api/v1/admissions",
        json={
            "applicant_first_name": "Asha",
            "applicant_last_name": "Rao",
            "applying_for_class_id": "class-x",
            "guardian_name": "Ravi Rao",
            "guardian_phone": "9990001111",
        },
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_list_admissions_filter_by_status(client):
    school_id = await _make_school("ADM3")
    override_current_user(make_current_user(Role.SCHOOL_ADMIN, school_id))

    for i in range(2):
        await client.post(
            "/api/v1/admissions",
            json={
                "applicant_first_name": f"Kid{i}",
                "applicant_last_name": "Test",
                "applying_for_class_id": "class-x",
                "guardian_name": "Parent",
                "guardian_phone": f"888000000{i}",
            },
        )

    r = await client.get("/api/v1/admissions", params={"status": AdmissionStatus.SUBMITTED.value})
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 2

    r = await client.get("/api/v1/admissions", params={"status": AdmissionStatus.REJECTED.value})
    assert r.json()["total"] == 0


@pytest.mark.asyncio
async def test_review_reject(client):
    school_id = await _make_school("ADM4")
    override_current_user(make_current_user(Role.PRINCIPAL, school_id))

    create_r = await client.post(
        "/api/v1/admissions",
        json={
            "applicant_first_name": "Nina",
            "applicant_last_name": "Shah",
            "applying_for_class_id": "class-x",
            "guardian_name": "Parent Shah",
            "guardian_phone": "7770001111",
        },
    )
    admission_id = create_r.json()["id"]

    r = await client.post(
        f"/api/v1/admissions/{admission_id}/review",
        json={"action": "reject", "review_notes": "Seats full"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["admission"]["status"] == AdmissionStatus.REJECTED.value
    assert body["admission"]["review_notes"] == "Seats full"


@pytest.mark.asyncio
async def test_review_approve_full_conversion_flow(client):
    school_id = await _make_school("ADM5")
    year_id, class_id, section_id = await _make_academic_setup(school_id)
    override_current_user(make_current_user(Role.SCHOOL_ADMIN, school_id, user_id="000000000000000000000099"))

    create_r = await client.post(
        "/api/v1/admissions",
        json={
            "applicant_first_name": "Meera",
            "applicant_last_name": "Iyer",
            "applying_for_class_id": class_id,
            "applicant_email": "meera.student@example.com",
            "guardian_name": "Suresh Iyer",
            "guardian_phone": "6660001111",
            "guardian_email": "suresh.iyer@example.com",
        },
    )
    assert create_r.status_code == 201
    admission_id = create_r.json()["id"]

    review_r = await client.post(
        f"/api/v1/admissions/{admission_id}/review",
        json={
            "action": "approve",
            "academic_year_id": year_id,
            "section_id": section_id,
            "review_notes": "Looks good",
        },
    )
    assert review_r.status_code == 200
    body = review_r.json()

    assert body["admission"]["status"] == AdmissionStatus.CONVERTED.value
    assert body["student_id"] is not None
    assert body["guardian_id"] is not None
    assert body["student_login_created"] is True
    assert body["guardian_login_created"] is True

    student = await Student.get(body["student_id"])
    assert student is not None
    assert student.status == StudentStatus.ACTIVE
    assert student.section_id == section_id
    assert student.class_id == class_id

    guardian = await Guardian.get(body["guardian_id"])
    assert guardian is not None
    assert student.id.__str__() in guardian.student_ids
    assert guardian.id.__str__() in student.guardian_ids
    assert student.primary_guardian_id == guardian.id.__str__()

    student_user = await User.find_one(User.school_id == school_id, User.student_id == str(student.id))
    assert student_user is not None
    assert student_user.role == Role.STUDENT

    guardian_user = await User.find_one(User.school_id == school_id, User.guardian_id == str(guardian.id))
    assert guardian_user is not None
    assert guardian_user.role == Role.PARENT

    audit_entries = await AuditLog.find(AuditLog.school_id == school_id, AuditLog.action == "admission.approved").to_list()
    assert len(audit_entries) == 1

    # A second review attempt must fail — already converted.
    second_r = await client.post(
        f"/api/v1/admissions/{admission_id}/review",
        json={"action": "approve", "academic_year_id": year_id, "section_id": section_id},
    )
    assert second_r.status_code == 409


@pytest.mark.asyncio
async def test_approve_skips_guardian_login_when_no_email(client):
    school_id = await _make_school("ADM6")
    year_id, class_id, section_id = await _make_academic_setup(school_id)
    override_current_user(make_current_user(Role.SCHOOL_ADMIN, school_id))

    create_r = await client.post(
        "/api/v1/admissions",
        json={
            "applicant_first_name": "Zoe",
            "applicant_last_name": "Fox",
            "applying_for_class_id": class_id,
            "guardian_name": "No Email Guardian",
            "guardian_phone": "5550001111",
        },
    )
    admission_id = create_r.json()["id"]

    review_r = await client.post(
        f"/api/v1/admissions/{admission_id}/review",
        json={"action": "approve", "academic_year_id": year_id, "section_id": section_id},
    )
    assert review_r.status_code == 200
    body = review_r.json()
    assert body["guardian_login_created"] is False
    assert body["student_login_created"] is False
    assert any("no email" in n.lower() for n in body["notes"])
    assert any("no applicant email" in n.lower() for n in body["notes"])


@pytest.mark.asyncio
async def test_admission_tenant_isolation(client):
    school_a = await _make_school("ADM7A")
    school_b = await _make_school("ADM7B")

    override_current_user(make_current_user(Role.SCHOOL_ADMIN, school_a))
    create_r = await client.post(
        "/api/v1/admissions",
        json={
            "applicant_first_name": "Sam",
            "applicant_last_name": "X",
            "applying_for_class_id": "class-x",
            "guardian_name": "Parent",
            "guardian_phone": "4440001111",
        },
    )
    admission_id = create_r.json()["id"]

    override_current_user(make_current_user(Role.SCHOOL_ADMIN, school_b))
    r = await client.get(f"/api/v1/admissions/{admission_id}")
    assert r.status_code == 404
