from datetime import date

import pytest

from app.api.v1.students import router as students_router
from app.core.enums import Role, StudentStatus
from app.main import app
from app.models.academic import AcademicYear, Class, ClassSubjectTeacher, Section
from app.models.audit_log import AuditLog
from app.models.guardian import Guardian
from app.models.student import Student
from app.models.tenant import Tenant
from tests.conftest import make_current_user, override_current_user

if not any(getattr(r, "path", "").startswith("/api/v1/students") for r in app.routes):
    app.include_router(students_router, prefix="/api/v1")


async def _make_school(code: str) -> str:
    tenant = Tenant(name=f"School {code}", code=code)
    await tenant.insert()
    return str(tenant.id)


async def _make_student(school_id: str, section_id: str, class_id: str, admission_no: str, **kw) -> Student:
    student = Student(
        school_id=school_id,
        admission_no=admission_no,
        first_name=kw.pop("first_name", "First"),
        last_name=kw.pop("last_name", "Last"),
        academic_year_id=kw.pop("academic_year_id", "year-1"),
        class_id=class_id,
        section_id=section_id,
        status=kw.pop("status", StudentStatus.ACTIVE),
        **kw,
    )
    await student.insert()
    return student


@pytest.mark.asyncio
async def test_admin_create_get_update_student(client):
    school_id = await _make_school("STU1")
    override_current_user(make_current_user(Role.SCHOOL_ADMIN, school_id))

    r = await client.post(
        "/api/v1/students",
        json={
            "admission_no": "A001",
            "first_name": "Kiran",
            "last_name": "Verma",
            "academic_year_id": "year-1",
            "class_id": "class-1",
            "section_id": "section-1",
        },
    )
    assert r.status_code == 201
    student_id = r.json()["id"]

    r = await client.get(f"/api/v1/students/{student_id}")
    assert r.status_code == 200
    assert r.json()["full_name"] == "Kiran Verma"

    r = await client.patch(f"/api/v1/students/{student_id}", json={"roll_number": "12"})
    assert r.status_code == 200
    assert r.json()["roll_number"] == "12"


@pytest.mark.asyncio
async def test_status_transition_is_audited(client):
    school_id = await _make_school("STU2")
    student = await _make_student(school_id, "sec-1", "class-1", "A002")
    override_current_user(make_current_user(Role.PRINCIPAL, school_id))

    r = await client.patch(
        f"/api/v1/students/{student.id}/status",
        json={"status": StudentStatus.TRANSFERRED.value, "note": "Moved schools"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == StudentStatus.TRANSFERRED.value

    entries = await AuditLog.find(
        AuditLog.school_id == school_id, AuditLog.action == "student.status_changed"
    ).to_list()
    assert len(entries) == 1


@pytest.mark.asyncio
async def test_teacher_only_sees_own_sections(client):
    school_id = await _make_school("STU3")

    year = AcademicYear(school_id=school_id, name="Y1", start_date=date(2026, 6, 1), end_date=date(2027, 4, 30))
    await year.insert()
    klass = Class(school_id=school_id, academic_year_id=str(year.id), name="Class 1")
    await klass.insert()

    section_taught = Section(school_id=school_id, class_id=str(klass.id), name="A")
    await section_taught.insert()
    section_class_teacher = Section(
        school_id=school_id, class_id=str(klass.id), name="B", class_teacher_id="teacher-1"
    )
    await section_class_teacher.insert()
    section_other = Section(school_id=school_id, class_id=str(klass.id), name="C")
    await section_other.insert()

    await ClassSubjectTeacher(
        school_id=school_id, section_id=str(section_taught.id), subject_id="subj-1", teacher_id="teacher-1"
    ).insert()

    s1 = await _make_student(school_id, str(section_taught.id), str(klass.id), "T001")
    s2 = await _make_student(school_id, str(section_class_teacher.id), str(klass.id), "T002")
    s3 = await _make_student(school_id, str(section_other.id), str(klass.id), "T003")

    override_current_user(make_current_user(Role.TEACHER, school_id, teacher_id="teacher-1"))

    r = await client.get("/api/v1/students")
    assert r.status_code == 200
    ids = {item["id"] for item in r.json()["items"]}
    assert ids == {str(s1.id), str(s2.id)}
    assert str(s3.id) not in ids

    # Direct get of a student outside the teacher's sections is hidden as not-found.
    r = await client.get(f"/api/v1/students/{s3.id}")
    assert r.status_code == 404

    r = await client.get(f"/api/v1/students/{s1.id}")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_parent_sees_only_own_children(client):
    school_id = await _make_school("STU4")

    guardian1 = Guardian(school_id=school_id, full_name="G1", phone="1112223333")
    await guardian1.insert()
    guardian2 = Guardian(school_id=school_id, full_name="G2", phone="4445556666")
    await guardian2.insert()

    child1 = await _make_student(school_id, "sec-1", "class-1", "P001", guardian_ids=[str(guardian1.id)])
    child2 = await _make_student(school_id, "sec-1", "class-1", "P002", guardian_ids=[str(guardian2.id)])

    # Keep the reverse link in sync too (get_my_children reads Guardian.student_ids).
    guardian1.student_ids = [str(child1.id)]
    await guardian1.save()
    guardian2.student_ids = [str(child2.id)]
    await guardian2.save()

    override_current_user(make_current_user(Role.PARENT, school_id, guardian_id=str(guardian1.id)))

    r = await client.get("/api/v1/students/my-children")
    assert r.status_code == 200
    ids = {item["id"] for item in r.json()}
    assert ids == {str(child1.id)}

    r = await client.get(f"/api/v1/students/{child1.id}")
    assert r.status_code == 200

    r = await client.get(f"/api/v1/students/{child2.id}")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_student_sees_only_own_profile(client):
    school_id = await _make_school("STU5")
    me = await _make_student(school_id, "sec-1", "class-1", "S001")
    other = await _make_student(school_id, "sec-1", "class-1", "S002")

    override_current_user(make_current_user(Role.STUDENT, school_id, student_id=str(me.id)))

    r = await client.get("/api/v1/students/me")
    assert r.status_code == 200
    assert r.json()["id"] == str(me.id)

    r = await client.get(f"/api/v1/students/{other.id}")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_student_tenant_isolation(client):
    school_a = await _make_school("STU6A")
    school_b = await _make_school("STU6B")

    student_a = await _make_student(school_a, "sec-1", "class-1", "TA001")

    override_current_user(make_current_user(Role.SCHOOL_ADMIN, school_b))
    r = await client.get(f"/api/v1/students/{student_a.id}")
    assert r.status_code == 404
