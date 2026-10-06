import datetime as dt

import pytest

from app.api.v1.attendance import router as attendance_router
from app.core.config import get_settings
from app.core.enums import AttendanceStatus, Role, StudentStatus
from app.main import app as fastapi_app
from app.models.attendance import StudentAttendance
from app.models.guardian import Guardian
from app.models.student import Student
from tests.conftest import make_current_user, override_current_user

# The attendance router isn't wired into app/api/v1/router.py yet (that file
# is owned by the integration step across all parallel modules). Register it
# directly on the shared `app` singleton here so this module's tests can
# exercise it through the real HTTP layer without touching router.py.
_settings = get_settings()
if not any(r.path.startswith(f"{_settings.api_v1_prefix}/attendance") for r in fastapi_app.routes):
    fastapi_app.include_router(attendance_router, prefix=_settings.api_v1_prefix)

SCHOOL_A = "000000000000000000000a01"
SCHOOL_B = "000000000000000000000b01"
SECTION_A = "000000000000000000000sec1"


async def _make_student(school_id: str, section_id: str, admission_no: str) -> Student:
    student = Student(
        school_id=school_id,
        admission_no=admission_no,
        first_name="Ann",
        last_name="Lee",
        academic_year_id="ay-1",
        class_id="class-1",
        section_id=section_id,
        status=StudentStatus.ACTIVE,
    )
    await student.insert()
    return student


@pytest.mark.asyncio
async def test_bulk_mark_then_remark_is_upsert_not_duplicate(client):
    student = await _make_student(SCHOOL_A, SECTION_A, "A001")
    teacher = make_current_user(Role.TEACHER, SCHOOL_A, teacher_id="teacher-1")
    override_current_user(teacher)

    today = dt.date.today().isoformat()
    payload = {
        "section_id": SECTION_A,
        "date": today,
        "records": [{"student_id": str(student.id), "status": "PRESENT"}],
    }
    r1 = await client.post("/api/v1/attendance/students", json=payload)
    assert r1.status_code == 200
    assert len(r1.json()) == 1

    # Re-mark the same student/date with a different status.
    payload["records"][0]["status"] = "ABSENT"
    r2 = await client.post("/api/v1/attendance/students", json=payload)
    assert r2.status_code == 200
    assert r2.json()[0]["status"] == "ABSENT"

    # Only one attendance record should exist for (student, date).
    count = await StudentAttendance.find(
        StudentAttendance.student_id == str(student.id),
        StudentAttendance.date == dt.date.today(),
    ).count()
    assert count == 1


@pytest.mark.asyncio
async def test_student_sees_only_own_attendance(client):
    student1 = await _make_student(SCHOOL_A, SECTION_A, "A002")
    student2 = await _make_student(SCHOOL_A, SECTION_A, "A003")
    teacher = make_current_user(Role.TEACHER, SCHOOL_A, teacher_id="teacher-1")
    override_current_user(teacher)

    today = dt.date.today().isoformat()
    await client.post(
        "/api/v1/attendance/students",
        json={
            "section_id": SECTION_A,
            "date": today,
            "records": [
                {"student_id": str(student1.id), "status": "PRESENT"},
                {"student_id": str(student2.id), "status": "ABSENT"},
            ],
        },
    )

    student_user = make_current_user(Role.STUDENT, SCHOOL_A, student_id=str(student1.id))
    override_current_user(student_user)
    r = await client.get("/api/v1/attendance/students")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["items"][0]["student_id"] == str(student1.id)


@pytest.mark.asyncio
async def test_parent_sees_only_children_attendance(client):
    child1 = await _make_student(SCHOOL_A, SECTION_A, "A004")
    other_student = await _make_student(SCHOOL_A, SECTION_A, "A005")
    guardian = Guardian(school_id=SCHOOL_A, full_name="Parent One", phone="1234567890", student_ids=[str(child1.id)])
    await guardian.insert()

    teacher = make_current_user(Role.TEACHER, SCHOOL_A, teacher_id="teacher-1")
    override_current_user(teacher)
    today = dt.date.today().isoformat()
    await client.post(
        "/api/v1/attendance/students",
        json={
            "section_id": SECTION_A,
            "date": today,
            "records": [
                {"student_id": str(child1.id), "status": "PRESENT"},
                {"student_id": str(other_student.id), "status": "PRESENT"},
            ],
        },
    )

    parent_user = make_current_user(Role.PARENT, SCHOOL_A, guardian_id=str(guardian.id))
    override_current_user(parent_user)
    r = await client.get("/api/v1/attendance/students")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["items"][0]["student_id"] == str(child1.id)

    # Parent cannot query another (non-linked) student explicitly.
    r2 = await client.get("/api/v1/attendance/students", params={"student_id": str(other_student.id)})
    assert r2.status_code == 403


@pytest.mark.asyncio
async def test_tenant_isolation_across_schools(client):
    student_a = await _make_student(SCHOOL_A, SECTION_A, "A006")
    student_b = await _make_student(SCHOOL_B, SECTION_A, "B001")

    teacher_a = make_current_user(Role.TEACHER, SCHOOL_A, teacher_id="teacher-1")
    override_current_user(teacher_a)

    today = dt.date.today().isoformat()
    # A teacher in school A cannot mark attendance for a student in school B.
    r = await client.post(
        "/api/v1/attendance/students",
        json={
            "section_id": SECTION_A,
            "date": today,
            "records": [{"student_id": str(student_b.id), "status": "PRESENT"}],
        },
    )
    assert r.status_code == 404

    # Mark for the correct school's student, then confirm a teacher in school B can't see it.
    await client.post(
        "/api/v1/attendance/students",
        json={
            "section_id": SECTION_A,
            "date": today,
            "records": [{"student_id": str(student_a.id), "status": "PRESENT"}],
        },
    )
    teacher_b = make_current_user(Role.TEACHER, SCHOOL_B, teacher_id="teacher-2", user_id="000000000000000000000002")
    override_current_user(teacher_b)
    r2 = await client.get("/api/v1/attendance/students")
    assert r2.status_code == 200
    assert r2.json()["total"] == 0


@pytest.mark.asyncio
async def test_student_attendance_summary_percentage(client):
    student = await _make_student(SCHOOL_A, SECTION_A, "A007")
    teacher = make_current_user(Role.TEACHER, SCHOOL_A, teacher_id="teacher-1")
    override_current_user(teacher)

    base = dt.date.today()
    statuses = [
        AttendanceStatus.PRESENT,
        AttendanceStatus.PRESENT,
        AttendanceStatus.ABSENT,
        AttendanceStatus.HALF_DAY,
    ]
    for i, status in enumerate(statuses):
        d = (base - dt.timedelta(days=i)).isoformat()
        await client.post(
            "/api/v1/attendance/students",
            json={
                "section_id": SECTION_A,
                "date": d,
                "records": [{"student_id": str(student.id), "status": status.value}],
            },
        )

    r = await client.get(
        "/api/v1/attendance/students/summary",
        params={
            "student_id": str(student.id),
            "date_from": (base - dt.timedelta(days=10)).isoformat(),
            "date_to": base.isoformat(),
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    item = body[0]
    assert item["total_days"] == 4
    # (2 present + 0 late + 0.5 * 1 half_day) / 4 * 100 = 62.5
    assert item["percentage_present"] == 62.5
