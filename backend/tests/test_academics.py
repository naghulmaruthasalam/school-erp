import pytest

from app.api.v1.academics import router as academics_router
from app.core.config import get_settings
from app.core.enums import Role
from app.main import app as fastapi_app
from tests.conftest import make_current_user, override_current_user

_settings = get_settings()
if not any(r.path.startswith(f"{_settings.api_v1_prefix}/academics") for r in fastapi_app.routes):
    fastapi_app.include_router(academics_router, prefix=_settings.api_v1_prefix)

SCHOOL_A = "000000000000000000000a01"
SCHOOL_B = "000000000000000000000b01"


@pytest.mark.asyncio
async def test_academic_year_class_section_roundtrip_scoped_to_school(client):
    admin = make_current_user(Role.SCHOOL_ADMIN, school_id=SCHOOL_A)
    override_current_user(admin)

    r_year = await client.post(
        "/api/v1/academics/years",
        json={"name": "2026-2027", "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True},
    )
    assert r_year.status_code == 201
    year = r_year.json()
    assert year["is_current"] is True

    r_class = await client.post(
        "/api/v1/academics/classes",
        json={"academic_year_id": year["id"], "name": "Class 8", "order": 8},
    )
    assert r_class.status_code == 201
    cls = r_class.json()

    r_section = await client.post(
        "/api/v1/academics/sections",
        json={"class_id": cls["id"], "name": "A", "room_no": "101"},
    )
    assert r_section.status_code == 201
    section = r_section.json()
    assert section["class_id"] == cls["id"]

    r_list_years = await client.get("/api/v1/academics/years")
    assert r_list_years.status_code == 200
    assert len(r_list_years.json()) == 1

    r_list_classes = await client.get("/api/v1/academics/classes")
    assert r_list_classes.status_code == 200
    assert len(r_list_classes.json()) == 1

    r_list_sections = await client.get(f"/api/v1/academics/sections?class_id={cls['id']}")
    assert r_list_sections.status_code == 200
    assert len(r_list_sections.json()) == 1


@pytest.mark.asyncio
async def test_teacher_cannot_write_but_can_read(client):
    teacher = make_current_user(Role.TEACHER, school_id=SCHOOL_A, teacher_id="teacher-1")
    override_current_user(teacher)

    r_create = await client.post(
        "/api/v1/academics/subjects",
        json={"name": "Mathematics", "code": "MATH"},
    )
    assert r_create.status_code == 403

    r_list = await client.get("/api/v1/academics/subjects")
    assert r_list.status_code == 200
    assert r_list.json() == []


@pytest.mark.asyncio
async def test_cross_school_isolation(client):
    admin_a = make_current_user(Role.SCHOOL_ADMIN, school_id=SCHOOL_A)
    override_current_user(admin_a)

    r_year = await client.post(
        "/api/v1/academics/years",
        json={"name": "2026-2027", "start_date": "2026-06-01", "end_date": "2027-04-30"},
    )
    assert r_year.status_code == 201
    year_id = r_year.json()["id"]

    # A user from a different school should not see school A's academic year.
    admin_b = make_current_user(Role.SCHOOL_ADMIN, school_id=SCHOOL_B)
    override_current_user(admin_b)

    r_list_b = await client.get("/api/v1/academics/years")
    assert r_list_b.status_code == 200
    assert r_list_b.json() == []

    r_get_b = await client.get(f"/api/v1/academics/years/{year_id}")
    assert r_get_b.status_code == 404


@pytest.mark.asyncio
async def test_setting_new_current_academic_year_unsets_previous(client):
    admin = make_current_user(Role.SCHOOL_ADMIN, school_id=SCHOOL_A)
    override_current_user(admin)

    r1 = await client.post(
        "/api/v1/academics/years",
        json={"name": "2025-2026", "start_date": "2025-06-01", "end_date": "2026-04-30", "is_current": True},
    )
    year1 = r1.json()

    r2 = await client.post(
        "/api/v1/academics/years",
        json={"name": "2026-2027", "start_date": "2026-06-01", "end_date": "2027-04-30", "is_current": True},
    )
    year2 = r2.json()
    assert year2["is_current"] is True

    r_get1 = await client.get(f"/api/v1/academics/years/{year1['id']}")
    assert r_get1.json()["is_current"] is False
