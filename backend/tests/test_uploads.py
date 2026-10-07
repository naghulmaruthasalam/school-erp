import pytest

from app.api.v1.uploads import router as uploads_router
from app.core.config import get_settings
from app.core.enums import Role
from app.main import app as fastapi_app
from app.models.document import Document
from app.models.guardian import Guardian
from tests.conftest import make_current_user, override_current_user

_settings = get_settings()
if not any(r.path.startswith(f"{_settings.api_v1_prefix}/uploads") for r in fastapi_app.routes):
    fastapi_app.include_router(uploads_router, prefix=_settings.api_v1_prefix)


@pytest.fixture(autouse=True)
def _patch_s3(monkeypatch):
    calls = {"uploaded": [], "deleted": [], "presigned": []}

    def fake_upload_bytes(key, data, content_type):
        calls["uploaded"].append((key, data, content_type))

    def fake_delete_object(key):
        calls["deleted"].append(key)

    def fake_generate_presigned_get_url(key, expires_in=None):
        calls["presigned"].append(key)
        return f"https://fake-s3.example/{key}?sig=abc"

    monkeypatch.setattr("app.services.upload_service.upload_bytes", fake_upload_bytes)
    monkeypatch.setattr("app.services.upload_service.delete_object", fake_delete_object)
    monkeypatch.setattr(
        "app.services.upload_service.generate_presigned_get_url", fake_generate_presigned_get_url
    )
    return calls


def _files(filename: str = "photo.jpg", content: bytes = b"hello world", content_type: str = "image/jpeg"):
    return {"file": (filename, content, content_type)}


@pytest.mark.asyncio
async def test_staff_can_upload_and_fetch_document(client, _patch_s3):
    override_current_user(make_current_user(Role.SCHOOL_ADMIN, school_id="school-1"))

    r = await client.post(
        "/api/v1/uploads",
        data={"module": "OTHER"},
        files=_files(),
    )
    assert r.status_code == 201
    body = r.json()
    assert body["original_filename"] == "photo.jpg"
    assert body["size_bytes"] == len(b"hello world")
    assert body["url"].startswith("https://fake-s3.example/")
    assert len(_patch_s3["uploaded"]) == 1

    doc_id = body["id"]
    r_get = await client.get(f"/api/v1/uploads/{doc_id}")
    assert r_get.status_code == 200
    assert r_get.json()["id"] == doc_id

    r_url = await client.get(f"/api/v1/uploads/{doc_id}/url")
    assert r_url.status_code == 200
    assert "url" in r_url.json()


@pytest.mark.asyncio
async def test_student_can_upload_and_fetch_own_document_but_not_others(client, _patch_s3):
    override_current_user(
        make_current_user(
            Role.STUDENT, school_id="school-2", student_id="student-A", user_id="000000000000000000000021"
        )
    )

    r = await client.post(
        "/api/v1/uploads",
        data={"module": "STUDENT_DOCUMENT", "linked_entity_type": "student", "linked_entity_id": "student-A"},
        files=_files("report.pdf", b"pdfbytes", "application/pdf"),
    )
    assert r.status_code == 201
    doc_id = r.json()["id"]

    # Own document is fetchable
    r_get = await client.get(f"/api/v1/uploads/{doc_id}")
    assert r_get.status_code == 200

    # Cannot upload linked to a different student
    r_forbidden = await client.post(
        "/api/v1/uploads",
        data={"module": "STUDENT_DOCUMENT", "linked_entity_type": "student", "linked_entity_id": "student-B"},
        files=_files(),
    )
    assert r_forbidden.status_code == 403

    # Another student cannot fetch student-A's document
    override_current_user(
        make_current_user(
            Role.STUDENT, school_id="school-2", student_id="student-B", user_id="000000000000000000000022"
        )
    )
    r_denied = await client.get(f"/api/v1/uploads/{doc_id}")
    assert r_denied.status_code == 403


@pytest.mark.asyncio
async def test_parent_can_access_childs_document_via_guardian_link(client, _patch_s3):
    guardian = Guardian(
        school_id="school-3",
        full_name="Parent One",
        phone="9000000009",
        student_ids=["student-C"],
    )
    await guardian.insert()

    override_current_user(
        make_current_user(Role.PARENT, school_id="school-3", guardian_id=str(guardian.id))
    )

    r = await client.post(
        "/api/v1/uploads",
        data={"module": "STUDENT_DOCUMENT", "linked_entity_type": "student", "linked_entity_id": "student-C"},
        files=_files(),
    )
    assert r.status_code == 201
    doc_id = r.json()["id"]

    r_get = await client.get(f"/api/v1/uploads/{doc_id}")
    assert r_get.status_code == 200

    # Not linked to this guardian's students -> forbidden
    r_forbidden = await client.post(
        "/api/v1/uploads",
        data={"module": "STUDENT_DOCUMENT", "linked_entity_type": "student", "linked_entity_id": "student-Z"},
        files=_files(),
    )
    assert r_forbidden.status_code == 403


@pytest.mark.asyncio
async def test_file_too_large_rejected(client, _patch_s3):
    override_current_user(make_current_user(Role.SCHOOL_ADMIN, school_id="school-4"))

    big_content = b"x" * (10 * 1024 * 1024 + 1)
    r = await client.post(
        "/api/v1/uploads",
        data={"module": "OTHER"},
        files=_files("big.bin", big_content, "application/octet-stream"),
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_tenant_isolation_on_document_fetch(client, _patch_s3):
    override_current_user(make_current_user(Role.SCHOOL_ADMIN, school_id="school-5"))
    r = await client.post("/api/v1/uploads", data={"module": "OTHER"}, files=_files())
    doc_id = r.json()["id"]

    override_current_user(make_current_user(Role.SCHOOL_ADMIN, school_id="school-other"))
    r_get = await client.get(f"/api/v1/uploads/{doc_id}")
    assert r_get.status_code == 404


@pytest.mark.asyncio
async def test_delete_by_staff_and_uploader(client, _patch_s3):
    override_current_user(make_current_user(Role.SCHOOL_ADMIN, school_id="school-6", user_id="000000000000000000000010"))
    r = await client.post("/api/v1/uploads", data={"module": "OTHER"}, files=_files())
    doc_id = r.json()["id"]

    r_delete = await client.delete(f"/api/v1/uploads/{doc_id}")
    assert r_delete.status_code == 204
    assert _patch_s3["deleted"]

    remaining = await Document.get(doc_id)
    assert remaining is None


@pytest.mark.asyncio
async def test_delete_forbidden_for_unrelated_student(client, _patch_s3):
    override_current_user(
        make_current_user(
            Role.STUDENT, school_id="school-7", student_id="student-D", user_id="000000000000000000000011"
        )
    )
    r = await client.post(
        "/api/v1/uploads",
        data={"module": "STUDENT_DOCUMENT", "linked_entity_type": "student", "linked_entity_id": "student-D"},
        files=_files(),
    )
    doc_id = r.json()["id"]

    override_current_user(
        make_current_user(
            Role.STUDENT, school_id="school-7", student_id="student-E", user_id="000000000000000000000012"
        )
    )
    r_delete = await client.delete(f"/api/v1/uploads/{doc_id}")
    assert r_delete.status_code == 403
