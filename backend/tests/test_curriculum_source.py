"""The curriculum source: a school gives a link (and maybe an API key); we fetch, preview, sync and keep it in sync."""
import io
import json
import zipfile

import httpx
import pytest

from app.core.config import get_settings
from app.models.academic import Class
from app.models.syllabus import Syllabus
from app.services import curriculum_source_service as svc
from tests.test_copilot import SCHOOL, as_student, as_teacher, school  # noqa: F401
from tests.test_syllabus_import import as_admin, move_to_year, year  # noqa: F401

URL = "https://curriculum.example.test/bucket/syllabus.json"
DOC = {"data": [
    {"gradeName": "Grade 10", "subjectName": "Physics", "chapterName": "Light", "topics": ["Reflection", "Refraction"],
     "content": ["Light travels in straight lines.", "It bends when entering water."], "chapterNo": 1},
    {"gradeName": "Grade 10", "subjectName": "Physics", "chapterName": "Sound", "chapterNo": 2},
]}

# One record per textbook unit with the PDF's extracted text, as the school's own export looks
UNIT = {
    "class": 6, "subject": "Social Studies", "language": "en", "unit_number": 2,
    "unit_title_ar": "Unit2_عمان_في_عصر_الخلافة_الراشدة", "unit_title_en": "Oman in the Rashidun Caliphate Era",
    "source_zip": "cls6_social_english.zip", "source_file": "cls6_social_english/Unit2.pdf", "total_pages": 22,
    "file_size_bytes": 2468873, "content_hash_md5": "a2ca0340bdb398b19d88b00e6d6ad689",
    "full_text": "ÿ\n!\nThe  most  severe\nÿ ÿ\nThe  Caliphate  in  \nthe  \nera  of  Manÿ\nUnity\n!!\nSecond\n40\nMachine Translated by Google\n\n4141\nÿ\nIn  unity.\nThe  historical  information",
}


class Source:
    """A fake bucket: records requests and serves whatever `body` is."""

    def __init__(self):
        self.body: bytes = json.dumps(DOC).encode()
        self.status = 200
        self.requests: list[httpx.Request] = []
        self.headers: dict[str, str] = {}

    def __call__(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return httpx.Response(self.status, content=self.body, headers=self.headers)


@pytest.fixture
def bucket(monkeypatch):
    src = Source()
    monkeypatch.setattr(svc, "_transport", httpx.MockTransport(src))
    monkeypatch.setattr(get_settings(), "curriculum_allow_private_urls", True)  # the fake host doesn't resolve
    return src


async def put(client, **over):
    body = {"url": URL, "api_key": "s3cr3t", **over}
    return await client.put("/api/v1/syllabus/source", json=body)


@pytest.mark.asyncio
async def test_the_key_is_stored_encrypted_and_never_returned(client, school, year, bucket):
    as_admin()
    r = await put(client)
    assert r.status_code == 200
    out = r.json()
    assert out["configured"] and out["has_api_key"] and "s3cr3t" not in json.dumps(out)
    stored = await svc.get_source(SCHOOL)
    assert stored.api_key_encrypted and "s3cr3t" not in stored.api_key_encrypted
    assert "s3cr3t" not in json.dumps((await client.get("/api/v1/syllabus/source")).json())
    # leaving the key out keeps it; "" removes it
    assert (await put(client, api_key=None)).json()["has_api_key"] is True
    assert (await put(client, api_key="")).json()["has_api_key"] is False


@pytest.mark.asyncio
async def test_only_admin_or_principal_manage_the_source(client, school, year, bucket):
    for who in (as_student, as_teacher):
        who()
        assert (await client.get("/api/v1/syllabus/source")).status_code == 403
        assert (await put(client)).status_code == 403
        assert (await client.post("/api/v1/syllabus/source/sync")).status_code == 403


@pytest.mark.asyncio
async def test_preview_reads_other_field_names_and_sends_the_key(client, school, year, bucket):
    as_admin()
    r = await client.post("/api/v1/syllabus/source/test", json={"url": URL, "api_key": "s3cr3t"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["dry_run"] and body["records_read"] == 2 and body["totals"]["chapters_added"] == 2
    assert bucket.requests[-1].headers["authorization"] == "Bearer s3cr3t"
    assert await Syllabus.find(Syllabus.title == "Physics - Grade 10").count() == 0  # a test saves nothing

    await client.post("/api/v1/syllabus/source/test", json={"url": URL, "api_key": "k", "api_key_header": "x-api-key"})
    assert bucket.requests[-1].headers["x-api-key"] == "k"


@pytest.mark.asyncio
async def test_sync_loads_the_syllabus_then_skips_an_unchanged_file(client, school, year, bucket):
    as_admin()
    await put(client)
    r = await client.post("/api/v1/syllabus/source/sync")
    assert r.status_code == 200, r.text
    syl = next(s for s in await Syllabus.find(Syllabus.school_id == SCHOOL).to_list() if s.title == "Physics - Grade 10")
    light = next(c for c in syl.chapters if c.name == "Light")
    assert light.topics == ["Reflection", "Refraction"] and "bends when entering water" in light.content
    assert [c.name for c in syl.chapters] == ["Light", "Sound"]

    again = (await client.post("/api/v1/syllabus/source/sync")).json()
    assert again["unchanged"] is True
    assert (await client.get("/api/v1/syllabus/source")).json()["last_status"] == "unchanged"
    forced = (await client.post("/api/v1/syllabus/source/sync?force=true")).json()
    assert forced["unchanged"] is False and forced["totals"]["chapters_added"] == 0

    bucket.body = json.dumps({"data": [{**DOC["data"][0], "chapterName": "Light", "topics": ["Mirrors"]}]}).encode()
    changed = (await client.post("/api/v1/syllabus/source/sync")).json()
    assert changed["totals"]["chapters_updated"] == 1
    assert next(c for c in (await Syllabus.get(syl.id)).chapters if c.name == "Light").topics == ["Mirrors"]


@pytest.mark.asyncio
async def test_unit_records_with_extracted_pdf_text(client, school, year, bucket):
    """class 6 / Social Studies / unit_number / unit_title_en / full_text: the export the school actually has."""
    as_admin()
    arabic = {**UNIT, "language": "ar", "full_text": "نص عربي"}
    bucket.body = json.dumps([arabic, UNIT]).encode()  # both languages of the same unit
    await put(client)
    r = await client.post("/api/v1/syllabus/source/sync")
    assert r.status_code == 200, r.text
    assert r.json()["created_classes"] == ["Class 6"] and r.json()["created_subjects"] == ["Social Studies"]
    assert await Class.find(Class.school_id == SCHOOL, Class.name == "Class 6").count() == 1
    syl = next(s for s in await Syllabus.find(Syllabus.school_id == SCHOOL).to_list() if s.title == "Social Studies - Class 6")
    assert [(c.name, c.order) for c in syl.chapters] == [("Oman in the Rashidun Caliphate Era", 2)]
    text = syl.chapters[0].content
    assert "The most severe" in text and "In unity." in text  # the English text is the one kept
    assert "Machine Translated" not in text and "ÿ" not in text and "\n!\n" not in text
    assert "نص عربي" not in text
    assert "4141" not in text.split() and "40" not in text.split()  # page numbers are dropped


@pytest.mark.asyncio
async def test_zip_with_several_files_and_a_non_chapter_file(client, school, year, bucket):
    as_admin()
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("textbook/chapters.json", json.dumps(DOC))
        zf.writestr("textbook/subjects_mapping.json", json.dumps([{"_id": {"$oid": "a" * 24}, "title": "Physics"}]))
        zf.writestr("textbook/readme.txt", "ignore me")
    bucket.body = buf.getvalue()
    r = (await client.post("/api/v1/syllabus/source/test", json={"url": URL})).json()
    assert r["records_read"] == 2 and r["source_files"] == ["textbook/chapters.json"]
    assert len(r["skipped_files"]) == 1 and "subjects_mapping.json" in r["skipped_files"][0]


@pytest.mark.asyncio
async def test_a_source_that_only_has_ids_uses_the_school_supplied_names(client, school, year, bucket):
    as_admin()
    bucket.body = json.dumps([{"gradeId": "ObjectId('" + "b" * 24 + "')", "subjectId": {"$oid": "c" * 24}, "chapterName": "Light"}]).encode()
    r = await client.post("/api/v1/syllabus/source/test", json={"url": URL})
    assert r.json()["syllabi"][0]["class"] == "b" * 24  # without a mapping the preview shows the raw ids, so it is obvious
    payload = {"url": URL, "value_map": {"class": {"b" * 24: "Class 10"}, "subject": {"c" * 24: "Physics"}}}
    ok = (await client.post("/api/v1/syllabus/source/test", json=payload)).json()
    assert ok["syllabi"][0]["class"] == "Class 10" and ok["syllabi"][0]["subject"] == "Physics"


@pytest.mark.asyncio
async def test_field_map_renames_odd_columns(client, school, year, bucket):
    as_admin()
    bucket.body = json.dumps([{"std": "Grade 10", "sub": "Physics", "lesson_heading": "Light", "brief": "How light moves"}]).encode()
    r = await client.post("/api/v1/syllabus/source/test", json={"url": URL, "field_map": {"sub": "subject", "lesson_heading": "chapter", "brief": "description"}})
    assert r.status_code == 200 and r.json()["records_read"] == 1
    assert (await client.post("/api/v1/syllabus/source/test", json={"url": URL, "field_map": {"x": "password"}})).status_code == 422


@pytest.mark.asyncio
async def test_clear_messages_when_the_source_misbehaves(client, school, year, bucket):
    as_admin()
    bucket.status = 403
    r = await client.post("/api/v1/syllabus/source/test", json={"url": URL})
    assert r.status_code == 502 and "refused access" in r.json()["detail"] and "expired" in r.json()["detail"]
    bucket.status = 404
    assert "HTTP 404" in (await client.post("/api/v1/syllabus/source/test", json={"url": URL})).json()["detail"]
    bucket.status, bucket.body = 200, b"<html>sign in</html>"
    assert (await client.post("/api/v1/syllabus/source/test", json={"url": URL})).status_code == 422
    bucket.status, bucket.body = 302, b""
    assert "redirects" in (await client.post("/api/v1/syllabus/source/test", json={"url": URL})).json()["detail"]
    bucket.status, bucket.body = 200, json.dumps({"data": [{"title": "only a title"}]}).encode()
    assert "found fields" in (await client.post("/api/v1/syllabus/source/test", json={"url": URL})).json()["detail"]
    await put(client)
    bucket.status = 403
    assert (await client.post("/api/v1/syllabus/source/sync")).status_code == 502
    assert (await client.get("/api/v1/syllabus/source")).json()["last_status"] == "error"


@pytest.mark.asyncio
async def test_internal_addresses_and_plain_http_are_refused(client, school, year, monkeypatch):
    as_admin()
    for url in ("https://127.0.0.1/x.json", "https://169.254.169.254/latest/meta-data", "http://example.com/x.json", "ftp://x/y", "https://user:pw@example.com/x"):
        r = await client.post("/api/v1/syllabus/source/test", json={"url": url})
        assert r.status_code == 422, url


@pytest.mark.asyncio
async def test_auto_sync_runs_only_due_sources(client, school, year, bucket):
    as_admin()
    await put(client, auto_sync_minutes=60)
    assert (await put(client, auto_sync_minutes=5)).status_code == 422
    await svc.sync_due()  # never synced: due
    assert (await svc.get_source(SCHOOL)).last_status == "ok"
    n = len(bucket.requests)
    await svc.sync_due()  # synced a moment ago: not due
    assert len(bucket.requests) == n
