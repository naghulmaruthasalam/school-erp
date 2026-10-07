import datetime as dt

import pytest

from app.api.v1.homework import router as homework_router
from app.core.config import get_settings
from app.core.enums import Role, StudentStatus
from app.main import app as fastapi_app
from app.models.guardian import Guardian
from app.models.homework import HomeworkSubmission
from app.models.student import Student
from tests.conftest import make_current_user, override_current_user

# The homework router isn't wired into app/api/v1/router.py yet (that file
# is owned by the integration step across all parallel modules). Register it
# directly on the shared `app` singleton here so this module's tests can
# exercise it through the real HTTP layer without touching router.py.
_settings = get_settings()
if not any(r.path.startswith(f"{_settings.api_v1_prefix}/homework") for r in fastapi_app.routes):
    fastapi_app.include_router(homework_router, prefix=_settings.api_v1_prefix)

SCHOOL_A = "000000000000000000000a01"
SECTION_A = "000000000000000000000sec1"


async def _make_student(school_id: str, section_id: str, admission_no: str, status=StudentStatus.ACTIVE) -> Student:
    student = Student(
        school_id=school_id,
        admission_no=admission_no,
        first_name="Ann",
        last_name="Lee",
        academic_year_id="ay-1",
        class_id="class-1",
        section_id=section_id,
        status=status,
    )
    await student.insert()
    return student


@pytest.mark.asyncio
async def test_create_homework_auto_creates_pending_submissions_for_active_students(client):
    active1 = await _make_student(SCHOOL_A, SECTION_A, "H001")
    active2 = await _make_student(SCHOOL_A, SECTION_A, "H002")
    inactive = await _make_student(SCHOOL_A, SECTION_A, "H003", status=StudentStatus.INACTIVE)

    teacher = make_current_user(Role.TEACHER, SCHOOL_A, teacher_id="teacher-1")
    override_current_user(teacher)

    today = dt.date.today()
    r = await client.post(
        "/api/v1/homework",
        json={
            "section_id": SECTION_A,
            "subject_id": "subj-1",
            "title": "Algebra worksheet",
            "assigned_date": today.isoformat(),
            "due_date": (today + dt.timedelta(days=3)).isoformat(),
        },
    )
    assert r.status_code == 201
    homework_id = r.json()["id"]
    assert r.json()["teacher_id"] == "teacher-1"

    submissions = await HomeworkSubmission.find(HomeworkSubmission.homework_id == homework_id).to_list()
    submitted_student_ids = {s.student_id for s in submissions}
    assert submitted_student_ids == {str(active1.id), str(active2.id)}
    assert str(inactive.id) not in submitted_student_ids
    assert all(s.status == "PENDING" for s in submissions)


@pytest.mark.asyncio
async def test_student_can_mark_own_submission_not_another(client):
    student1 = await _make_student(SCHOOL_A, SECTION_A, "H004")
    student2 = await _make_student(SCHOOL_A, SECTION_A, "H005")

    teacher = make_current_user(Role.TEACHER, SCHOOL_A, teacher_id="teacher-1")
    override_current_user(teacher)
    today = dt.date.today()
    r = await client.post(
        "/api/v1/homework",
        json={
            "section_id": SECTION_A,
            "subject_id": "subj-1",
            "title": "Essay",
            "assigned_date": today.isoformat(),
            "due_date": (today + dt.timedelta(days=3)).isoformat(),
        },
    )
    homework_id = r.json()["id"]

    submissions = await HomeworkSubmission.find(HomeworkSubmission.homework_id == homework_id).to_list()
    sub1 = next(s for s in submissions if s.student_id == str(student1.id))
    sub2 = next(s for s in submissions if s.student_id == str(student2.id))

    student1_user = make_current_user(Role.STUDENT, SCHOOL_A, student_id=str(student1.id))
    override_current_user(student1_user)

    r_own = await client.patch(
        f"/api/v1/homework/submissions/{sub1.id}",
        json={"remarks": "done"},
    )
    assert r_own.status_code == 200
    assert r_own.json()["status"] == "SUBMITTED"
    assert r_own.json()["submitted_at"] is not None

    r_other = await client.patch(
        f"/api/v1/homework/submissions/{sub2.id}",
        json={"remarks": "sneaky"},
    )
    assert r_other.status_code == 403


@pytest.mark.asyncio
async def test_student_sees_only_own_section_homework(client):
    section_b = "000000000000000000000sec2"
    student = await _make_student(SCHOOL_A, SECTION_A, "H006")
    await _make_student(SCHOOL_A, section_b, "H007")

    teacher = make_current_user(Role.TEACHER, SCHOOL_A, teacher_id="teacher-1")
    override_current_user(teacher)
    today = dt.date.today()
    await client.post(
        "/api/v1/homework",
        json={
            "section_id": SECTION_A,
            "subject_id": "subj-1",
            "title": "For section A",
            "assigned_date": today.isoformat(),
            "due_date": (today + dt.timedelta(days=3)).isoformat(),
        },
    )
    await client.post(
        "/api/v1/homework",
        json={
            "section_id": section_b,
            "subject_id": "subj-1",
            "title": "For section B",
            "assigned_date": today.isoformat(),
            "due_date": (today + dt.timedelta(days=3)).isoformat(),
        },
    )

    student_user = make_current_user(Role.STUDENT, SCHOOL_A, student_id=str(student.id))
    override_current_user(student_user)
    r = await client.get("/api/v1/homework")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["items"][0]["title"] == "For section A"


@pytest.mark.asyncio
async def test_parent_reads_only_children_homework_and_cannot_write(client):
    child = await _make_student(SCHOOL_A, SECTION_A, "H008")
    guardian = Guardian(school_id=SCHOOL_A, full_name="Parent", phone="1234567890", student_ids=[str(child.id)])
    await guardian.insert()

    teacher = make_current_user(Role.TEACHER, SCHOOL_A, teacher_id="teacher-1")
    override_current_user(teacher)
    today = dt.date.today()
    r = await client.post(
        "/api/v1/homework",
        json={
            "section_id": SECTION_A,
            "subject_id": "subj-1",
            "title": "Reading",
            "assigned_date": today.isoformat(),
            "due_date": (today + dt.timedelta(days=3)).isoformat(),
        },
    )
    homework_id = r.json()["id"]

    parent_user = make_current_user(Role.PARENT, SCHOOL_A, guardian_id=str(guardian.id))
    override_current_user(parent_user)
    r_list = await client.get("/api/v1/homework")
    assert r_list.status_code == 200
    assert r_list.json()["total"] == 1

    r_create = await client.post(
        "/api/v1/homework",
        json={
            "section_id": SECTION_A,
            "subject_id": "subj-1",
            "title": "Not allowed",
            "assigned_date": today.isoformat(),
            "due_date": (today + dt.timedelta(days=3)).isoformat(),
        },
    )
    assert r_create.status_code == 403

    r_delete = await client.delete(f"/api/v1/homework/{homework_id}")
    assert r_delete.status_code == 403


@pytest.mark.asyncio
async def test_pending_homework_for_student(client):
    student = await _make_student(SCHOOL_A, SECTION_A, "H009")
    teacher = make_current_user(Role.TEACHER, SCHOOL_A, teacher_id="teacher-1")
    override_current_user(teacher)
    today = dt.date.today()
    await client.post(
        "/api/v1/homework",
        json={
            "section_id": SECTION_A,
            "subject_id": "subj-1",
            "title": "Upcoming",
            "assigned_date": today.isoformat(),
            "due_date": (today + dt.timedelta(days=2)).isoformat(),
        },
    )

    student_user = make_current_user(Role.STUDENT, SCHOOL_A, student_id=str(student.id))
    override_current_user(student_user)
    r = await client.get("/api/v1/homework/pending")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["student_id"] == str(student.id)
