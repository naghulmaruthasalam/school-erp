import pytest

from app.core.enums import Role
from app.core.security import hash_password
from app.models.tenant import Tenant
from app.models.user import User
from tests.conftest import make_current_user, override_current_user


@pytest.mark.asyncio
async def test_health(client):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_login_success(client):
    tenant = Tenant(name="Test School", code="TS001")
    await tenant.insert()
    user = User(
        school_id=str(tenant.id),
        email="admin@example.com",
        hashed_password=hash_password("secret123"),
        role=Role.SCHOOL_ADMIN,
        full_name="School Admin",
    )
    await user.insert()

    r = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "secret123", "school_code": "TS001"},
    )
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body and "refresh_token" in body


@pytest.mark.asyncio
async def test_login_wrong_password(client):
    tenant = Tenant(name="Test School", code="TS002")
    await tenant.insert()
    user = User(
        school_id=str(tenant.id),
        email="admin2@example.com",
        hashed_password=hash_password("secret123"),
        role=Role.SCHOOL_ADMIN,
        full_name="School Admin",
    )
    await user.insert()

    r = await client.post(
        "/api/v1/auth/login",
        json={"email": "admin2@example.com", "password": "wrong", "school_code": "TS002"},
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_with_overridden_auth(client):
    current = make_current_user(Role.STUDENT, school_id="school-1", student_id="student-1")
    override_current_user(current)

    r = await client.get("/api/v1/auth/me")
    assert r.status_code == 200
    assert r.json()["role"] == "STUDENT"
    assert r.json()["student_id"] == "student-1"
