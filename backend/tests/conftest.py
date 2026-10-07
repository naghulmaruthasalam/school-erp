from collections.abc import AsyncIterator

import pytest
import pytest_asyncio
from beanie import init_beanie
from httpx import ASGITransport, AsyncClient
from mongomock_motor import AsyncMongoMockClient

from app.core.database import get_document_models
from app.core.deps import CurrentUser, get_current_user
from app.core.enums import Role
from app.main import app


@pytest_asyncio.fixture(autouse=True)
async def _init_test_db() -> AsyncIterator[None]:
    """Every test gets a fresh in-memory Mongo (mongomock) with all
    collections registered. No real MongoDB needed for unit/service tests."""
    client = AsyncMongoMockClient()
    await init_beanie(database=client["test_db"], document_models=get_document_models())
    # Services look the school up by id (e.g. to build admission/employee numbers), so the ids
    # tests pass as `school_id` must belong to real tenants.
    from beanie import PydanticObjectId

    from app.models.tenant import Tenant

    for n in [*range(1, 10), 99]:
        await Tenant(id=PydanticObjectId("5c0000000000000000000%03d" % n), name=f"Fixture School {n}", code=f"FX{n}").insert()
    yield
    app.dependency_overrides.pop(get_current_user, None)


SCHOOL_A = "000000000000000000000a01"
SCHOOL_B = "000000000000000000000b01"
SECTION_A = "000000000000000000000c01"
SECTION_B = "000000000000000000000c02"
TEACHER_A = "000000000000000000000f01"
TEACHER_B = "000000000000000000000f02"


async def seed_teacher_access() -> None:
    """A class + section + assigned teacher in each of two schools. Teachers may only act on
    classes they are assigned to, so tests that act as a teacher need this to exist."""
    from beanie import PydanticObjectId

    from app.models.academic import Class, Section
    from app.models.teacher import Teacher

    for school_id, section_id, teacher_id in ((SCHOOL_A, SECTION_A, TEACHER_A), (SCHOOL_B, SECTION_B, TEACHER_B)):
        klass = Class(school_id=school_id, academic_year_id="ay-1", name="Class 1", order=1)
        await klass.insert()
        await Section(id=PydanticObjectId(section_id), school_id=school_id, class_id=str(klass.id), name="A").insert()
        await Teacher(
            id=PydanticObjectId(teacher_id),
            school_id=school_id,
            employee_no="T-001",
            first_name="Test",
            last_name="Teacher",
            phone="9000000000",
            assigned_class_ids=[str(klass.id)],
        ).insert()


@pytest_asyncio.fixture
async def teacher_access() -> None:
    await seed_teacher_access()


@pytest_asyncio.fixture
async def client() -> AsyncIterator[AsyncClient]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def override_current_user(current: CurrentUser) -> None:
    """Bypass real JWT auth in a test — inject a fake authenticated identity.
    Usage: override_current_user(make_current_user(Role.TEACHER, school_id, teacher_id=...))"""

    async def _fake() -> CurrentUser:
        return current

    app.dependency_overrides[get_current_user] = _fake


def make_current_user(
    role: Role,
    school_id: str | None,
    *,
    user_id: str = "000000000000000000000001",
    student_id: str | None = None,
    teacher_id: str | None = None,
    guardian_id: str | None = None,
) -> CurrentUser:
    from app.models.user import User

    user = User(
        id=user_id,
        school_id=school_id,
        email=f"{role.value.lower()}@test.local",
        hashed_password="x",
        role=role,
        full_name=f"Test {role.value.title()}",
        student_id=student_id,
        teacher_id=teacher_id,
        guardian_id=guardian_id,
    )
    return CurrentUser(id=user_id, school_id=school_id, role=role, user=user)
