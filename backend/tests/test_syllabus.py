import pytest

from app.core.enums import Role
from tests.conftest import make_current_user, override_current_user

SCHOOL = "5c0000000000000000000001"


def _payload(**extra) -> dict:
    return {
        "academic_year_id": "ay-1",
        "class_id": "class-1",
        "subject_id": "subject-1",
        "title": "Mathematics - Term 1",
        "description": "Numbers and algebra",
        "chapters": [{"name": "Integers", "order": 1}, {"name": "Fractions", "description": "Basics", "order": 2}],
        **extra,
    }


@pytest.mark.asyncio
async def test_create_returns_status_chapters_and_documents_fields(client):
    override_current_user(make_current_user(Role.SCHOOL_ADMIN, SCHOOL))

    r = await client.post("/api/v1/syllabus", json=_payload(status="DRAFT"))
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "DRAFT"
    assert body["chapters_count"] == 2
    assert [c["name"] for c in body["chapters"]] == ["Integers", "Fractions"]
    assert body["chapters"][0]["syllabus_id"] == body["id"] and body["chapters"][0]["id"]
    assert body["documents"] == []


@pytest.mark.asyncio
async def test_drafts_are_hidden_from_students_but_visible_to_staff(client):
    override_current_user(make_current_user(Role.SCHOOL_ADMIN, SCHOOL))
    draft = (await client.post("/api/v1/syllabus", json=_payload(status="DRAFT"))).json()
    published = (await client.post("/api/v1/syllabus", json=_payload(status="PUBLISHED", title="Published one"))).json()

    staff_list = await client.get("/api/v1/syllabus")
    assert staff_list.json()["total"] == 2
    only_drafts = await client.get("/api/v1/syllabus", params={"status": "DRAFT"})
    assert [s["id"] for s in only_drafts.json()["items"]] == [draft["id"]]

    from app.models.student import Student

    student = Student(
        school_id=SCHOOL,
        admission_no="S-1",
        first_name="A",
        last_name="B",
        academic_year_id="ay-1",
        class_id="class-1",
        section_id="section-1",
    )
    await student.insert()
    override_current_user(make_current_user(Role.STUDENT, SCHOOL, student_id=str(student.id)))
    visible = await client.get("/api/v1/syllabus")
    assert [s["id"] for s in visible.json()["items"]] == [published["id"]]
    hidden = await client.get(f"/api/v1/syllabus/{draft['id']}")
    assert hidden.status_code == 404


@pytest.mark.asyncio
async def test_upload_document_attaches_file_and_serves_a_link(client, monkeypatch):
    uploaded = {}
    monkeypatch.setattr("app.services.upload_service.upload_bytes", lambda key, data, ct: uploaded.update({key: data}))
    monkeypatch.setattr(
        "app.services.upload_service.generate_presigned_get_url", lambda key, expires_in=None: f"https://files.test/{key}"
    )
    override_current_user(make_current_user(Role.TEACHER, SCHOOL, teacher_id="000000000000000000000f09"))

    created = (await client.post("/api/v1/syllabus", json=_payload())).json()
    r = await client.post(
        f"/api/v1/syllabus/{created['id']}/documents",
        files={"file": ("outline.pdf", b"%PDF-1.4 outline", "application/pdf")},
    )
    assert r.status_code == 201
    doc = r.json()
    assert doc["filename"] == "outline.pdf"
    assert len(uploaded) == 1

    fetched = (await client.get(f"/api/v1/syllabus/{created['id']}")).json()
    assert [d["id"] for d in fetched["documents"]] == [doc["id"]]

    # Any signed-in member of the school can open class material
    override_current_user(make_current_user(Role.PARENT, SCHOOL, guardian_id="000000000000000000000e01"))
    link = await client.get(f"/api/v1/uploads/{doc['id']}/url")
    assert link.status_code == 200 and link.json()["url"].startswith("https://files.test/")
    via_syllabus = await client.get(f"/api/v1/syllabus/documents/{doc['id']}/url")
    assert via_syllabus.status_code == 200
