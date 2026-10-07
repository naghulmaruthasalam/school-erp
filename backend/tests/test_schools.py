import pytest

from app.api.v1.schools import router as schools_router
from app.core.config import get_settings
from app.core.enums import Role
from app.main import app as fastapi_app
from app.models.user import User
from tests.conftest import make_current_user, override_current_user

_settings = get_settings()
if not any(r.path.startswith(f"{_settings.api_v1_prefix}/schools") for r in fastapi_app.routes):
    fastapi_app.include_router(schools_router, prefix=_settings.api_v1_prefix)


def _school_payload(code: str = "GHS001") -> dict:
    return {
        "name": "Green Hill School",
        "code": code,
        "address": "123 Main St",
        "city": "Bengaluru",
        "state": "KA",
        "country": "India",
        "postal_code": "560001",
        "phone": "9999999999",
        "email": "info@greenhill.example",
        "academic_year_start_month": 6,
        "admin_full_name": "Alice Admin",
        "admin_email": "alice@greenhill.example",
        "admin_phone": "8888888888",
    }


@pytest.mark.asyncio
async def test_super_admin_can_create_school_and_provisions_admin(client):
    override_current_user(make_current_user(Role.SUPER_ADMIN, school_id=None))

    r = await client.post("/api/v1/schools", json=_school_payload())
    assert r.status_code == 201
    body = r.json()
    assert body["school"]["code"] == "GHS001"
    assert body["admin_email"] == "alice@greenhill.example"

    admin_user = await User.get(body["admin_user_id"])
    assert admin_user is not None
    assert admin_user.role == Role.SCHOOL_ADMIN
    assert admin_user.school_id == body["school"]["id"]
    assert admin_user.must_change_password is True


@pytest.mark.asyncio
async def test_non_super_admin_forbidden(client):
    override_current_user(make_current_user(Role.SCHOOL_ADMIN, school_id="school-1"))

    r = await client.post("/api/v1/schools", json=_school_payload())
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_duplicate_school_code_conflict(client):
    override_current_user(make_current_user(Role.SUPER_ADMIN, school_id=None))

    r1 = await client.post("/api/v1/schools", json=_school_payload("DUP001"))
    assert r1.status_code == 201

    r2 = await client.post(
        "/api/v1/schools",
        json=_school_payload("DUP001") | {"admin_email": "someoneelse@greenhill.example"},
    )
    assert r2.status_code == 409


@pytest.mark.asyncio
async def test_list_and_get_and_update_school(client):
    override_current_user(make_current_user(Role.SUPER_ADMIN, school_id=None))

    created = await client.post("/api/v1/schools", json=_school_payload("LST001"))
    school_id = created.json()["school"]["id"]

    r_list = await client.get("/api/v1/schools")
    assert r_list.status_code == 200
    assert r_list.json()["total"] >= 1

    r_get = await client.get(f"/api/v1/schools/{school_id}")
    assert r_get.status_code == 200
    assert r_get.json()["code"] == "LST001"

    r_patch = await client.patch(f"/api/v1/schools/{school_id}", json={"is_active": False})
    assert r_patch.status_code == 200
    assert r_patch.json()["is_active"] is False


@pytest.mark.asyncio
async def test_public_registration_requires_no_auth_and_provisions_admin(client):
    # No override_current_user call — this must work fully unauthenticated.
    r = await client.post("/api/v1/schools/register", json=_school_payload("REG001"))
    assert r.status_code == 201
    body = r.json()
    assert body["school"]["code"] == "REG001"
    assert body["admin_email"] == "alice@greenhill.example"

    admin_user = await User.get(body["admin_user_id"])
    assert admin_user is not None
    assert admin_user.role == Role.SCHOOL_ADMIN
    assert admin_user.school_id == body["school"]["id"]


@pytest.mark.asyncio
async def test_public_registration_rejects_duplicate_code(client):
    await client.post("/api/v1/schools/register", json=_school_payload("REG002"))
    r = await client.post("/api/v1/schools/register", json=_school_payload("REG002"))
    assert r.status_code == 409
