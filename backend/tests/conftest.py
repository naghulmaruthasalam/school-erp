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
    yield
    app.dependency_overrides.pop(get_current_user, None)


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
