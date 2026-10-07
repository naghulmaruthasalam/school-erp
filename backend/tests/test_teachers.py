import pytest

from app.api.v1.teachers import router as teachers_router
from app.core.config import get_settings
from app.core.enums import Role, TeacherStatus
from app.main import app as fastapi_app
from app.models.teacher import Teacher
from app.models.user import User
from tests.conftest import make_current_user, override_current_user

_settings = get_settings()
if not any(r.path.startswith(f"{_settings.api_v1_prefix}/teachers") for r in fastapi_app.routes):
    fastapi_app.include_router(teachers_router, prefix=_settings.api_v1_prefix)


def _teacher_payload(employee_no: str = "EMP001", email: str = "teacher1@greenhill.example") -> dict:
    return {
        "employee_no": employee_no,
        "first_name": "Jane",
        "last_name": "Doe",
        "phone": "9000000001",
        "email": email,
        "address": "45 Elm St",
        "qualifications": ["B.Ed"],
        "subject_ids": ["subj-1"],
    }


@pytest.mark.asyncio
async def test_admin_can_create_teacher_and_provisions_login(client):
    override_current_user(make_current_user(Role.SCHOOL_ADMIN, school_id="school-1"))

    r = await client.post("/api/v1/teachers", json=_teacher_payload())
    assert r.status_code == 201
    body = r.json()
    assert body["employee_no"] == "EMP001"
    assert body["full_name"] == "Jane Doe"

    user = await User.find_one(User.school_id == "school-1", User.email == "teacher1@greenhill.example")
    assert user is not None
    assert user.role == Role.TEACHER
    assert user.teacher_id == body["id"]
    assert user.must_change_password is True


@pytest.mark.asyncio
async def test_duplicate_employee_no_conflict(client):
    override_current_user(make_current_user(Role.SCHOOL_ADMIN, school_id="school-2"))

    r1 = await client.post("/api/v1/teachers", json=_teacher_payload("DUP01", "a@greenhill.example"))
    assert r1.status_code == 201

    r2 = await client.post("/api/v1/teachers", json=_teacher_payload("DUP01", "b@greenhill.example"))
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_non_admin_cannot_create_teacher(client):
    override_current_user(make_current_user(Role.TEACHER, school_id="school-3"))

    r = await client.post("/api/v1/teachers", json=_teacher_payload())
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_list_and_get_and_update_teacher(client):
    override_current_user(make_current_user(Role.PRINCIPAL, school_id="school-4"))

    created = await client.post("/api/v1/teachers", json=_teacher_payload("LST01", "lst@greenhill.example"))
    teacher_id = created.json()["id"]

    r_list = await client.get("/api/v1/teachers")
    assert r_list.status_code == 200
    assert r_list.json()["total"] >= 1

    r_search = await client.get("/api/v1/teachers", params={"name": "Jane"})
    assert r_search.status_code == 200
    assert r_search.json()["total"] >= 1

    r_get = await client.get(f"/api/v1/teachers/{teacher_id}")
    assert r_get.status_code == 200
    assert r_get.json()["employee_no"] == "LST01"

    r_patch = await client.patch(f"/api/v1/teachers/{teacher_id}", json={"status": "ON_LEAVE"})
    assert r_patch.status_code == 200
    assert r_patch.json()["status"] == "ON_LEAVE"


@pytest.mark.asyncio
async def test_teacher_can_update_own_profile_but_not_others(client):
    teacher_a = Teacher(
        school_id="school-5",
        employee_no="TA01",
        first_name="Alice",
        last_name="A",
        phone="9000000002",
        email="alice@greenhill.example",
        status=TeacherStatus.ACTIVE,
    )
    await teacher_a.insert()
    teacher_b = Teacher(
        school_id="school-5",
        employee_no="TB01",
        first_name="Bob",
        last_name="B",
        phone="9000000003",
        email="bob@greenhill.example",
        status=TeacherStatus.ACTIVE,
    )
    await teacher_b.insert()

    current_a = make_current_user(Role.TEACHER, school_id="school-5", teacher_id=str(teacher_a.id))
    override_current_user(current_a)

    r_me = await client.get("/api/v1/teachers/me")
    assert r_me.status_code == 200
    assert r_me.json()["employee_no"] == "TA01"

    r_patch_me = await client.patch("/api/v1/teachers/me", json={"phone": "9111111111", "address": "New Addr"})
    assert r_patch_me.status_code == 200
    assert r_patch_me.json()["phone"] == "9111111111"
    assert r_patch_me.json()["address"] == "New Addr"

    # Teacher role is not permitted on the admin-only teacher management endpoints at all.
    r_patch_other = await client.patch(f"/api/v1/teachers/{teacher_b.id}", json={"phone": "9222222222"})
    assert r_patch_other.status_code == 403

    # Restricted fields must not be updatable via the self-service endpoint.
    r_patch_restricted = await client.patch("/api/v1/teachers/me", json={"employee_no": "HACKED"})
    assert r_patch_restricted.status_code == 200  # extra fields are ignored, not rejected
    unchanged = await Teacher.get(str(teacher_a.id))
    assert unchanged.employee_no == "TA01"


@pytest.mark.asyncio
async def test_tenant_isolation_on_get(client):
    teacher = Teacher(
        school_id="school-6",
        employee_no="ISO01",
        first_name="Iso",
        last_name="Lated",
        phone="9000000004",
        email="iso@greenhill.example",
        status=TeacherStatus.ACTIVE,
    )
    await teacher.insert()

    override_current_user(make_current_user(Role.SCHOOL_ADMIN, school_id="school-other"))
    r = await client.get(f"/api/v1/teachers/{teacher.id}")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_delete_teacher_deactivates_user(client):
    override_current_user(make_current_user(Role.SCHOOL_ADMIN, school_id="school-7"))

    created = await client.post("/api/v1/teachers", json=_teacher_payload("DEL01", "del@greenhill.example"))
    teacher_id = created.json()["id"]

    r_delete = await client.delete(f"/api/v1/teachers/{teacher_id}")
    assert r_delete.status_code == 204

    r_get = await client.get(f"/api/v1/teachers/{teacher_id}")
    assert r_get.status_code == 404

    user = await User.find_one(User.school_id == "school-7", User.email == "del@greenhill.example")
    assert user is not None
    assert user.is_active is False
