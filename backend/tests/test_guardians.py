import pytest

from app.api.v1.guardians import router as guardians_router
from app.core.enums import Role
from app.main import app
from app.models.guardian import Guardian
from app.models.tenant import Tenant
from tests.conftest import make_current_user, override_current_user

if not any(getattr(r, "path", "").startswith("/api/v1/guardians") for r in app.routes):
    app.include_router(guardians_router, prefix="/api/v1")


async def _make_school(code: str) -> str:
    tenant = Tenant(name=f"School {code}", code=code)
    await tenant.insert()
    return str(tenant.id)


@pytest.mark.asyncio
async def test_admin_crud_guardian(client):
    school_id = await _make_school("GRD1")
    override_current_user(make_current_user(Role.SCHOOL_ADMIN, school_id))

    r = await client.post(
        "/api/v1/guardians",
        json={"full_name": "Priya Nair", "phone": "9998887777", "email": "priya@example.com"},
    )
    assert r.status_code == 201
    guardian_id = r.json()["id"]

    r = await client.get(f"/api/v1/guardians/{guardian_id}")
    assert r.status_code == 200
    assert r.json()["full_name"] == "Priya Nair"

    r = await client.patch(f"/api/v1/guardians/{guardian_id}", json={"occupation": "Engineer"})
    assert r.status_code == 200
    assert r.json()["occupation"] == "Engineer"

    r = await client.get("/api/v1/guardians", params={"phone": "9998887777"})
    assert r.status_code == 200
    assert r.json()["total"] == 1

    r = await client.delete(f"/api/v1/guardians/{guardian_id}")
    assert r.status_code == 204

    r = await client.get(f"/api/v1/guardians/{guardian_id}")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_guardian_forbidden_for_parent_role(client):
    school_id = await _make_school("GRD2")
    override_current_user(make_current_user(Role.PARENT, school_id, guardian_id="g1"))

    r = await client.post("/api/v1/guardians", json={"full_name": "X", "phone": "111"})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_parent_get_and_update_own_profile(client):
    school_id = await _make_school("GRD3")
    guardian = Guardian(school_id=school_id, full_name="Own Guardian", phone="1231231234")
    await guardian.insert()

    override_current_user(make_current_user(Role.PARENT, school_id, guardian_id=str(guardian.id)))

    r = await client.get("/api/v1/guardians/me")
    assert r.status_code == 200
    assert r.json()["id"] == str(guardian.id)

    r = await client.patch("/api/v1/guardians/me", json={"occupation": "Doctor"})
    assert r.status_code == 200
    assert r.json()["occupation"] == "Doctor"


@pytest.mark.asyncio
async def test_guardian_tenant_isolation(client):
    school_a = await _make_school("GRD4A")
    school_b = await _make_school("GRD4B")

    guardian = Guardian(school_id=school_a, full_name="A Guardian", phone="5551234567")
    await guardian.insert()

    override_current_user(make_current_user(Role.SCHOOL_ADMIN, school_b))
    r = await client.get(f"/api/v1/guardians/{guardian.id}")
    assert r.status_code == 404
