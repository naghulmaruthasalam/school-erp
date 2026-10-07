"""Dynamic text (names, titles, notices) is translated on demand and cached; app-written text never needs this."""
import pytest

from app.copilot import llm
from app.models.translation import TranslationCache
from app.services.translate_service import needs_translation
from tests.test_copilot import as_student, fake, school  # noqa: F401


def test_only_text_that_is_in_the_wrong_script_is_sent():
    assert needs_translation("Mid-Term Examination", "ar")
    assert not needs_translation("امتحان نصف الفصل", "ar")
    assert not needs_translation("12", "ar") and not needs_translation("", "ar")
    assert needs_translation("امتحان", "en") and not needs_translation("Exam", "en")


@pytest.mark.asyncio
async def test_translations_are_cached_per_text(client, school, fake):  # noqa: F811
    fake.json_by_hint["translate short texts"] = {"translations": ["امتحان منتصف الفصل", "آراف باتيل"]}
    as_student()
    body = {"texts": ["Mid-Term Examination", "Aarav Patel", "امتحان", "42"], "target": "ar"}
    r = (await client.post("/api/v1/i18n/translate", json=body)).json()
    assert r["available"] and r["translations"] == {"Mid-Term Examination": "امتحان منتصف الفصل", "Aarav Patel": "آراف باتيل"}
    calls = len(fake.calls)
    again = (await client.post("/api/v1/i18n/translate", json=body)).json()
    assert again["translations"] == r["translations"] and len(fake.calls) == calls  # second time: straight from the cache
    assert await TranslationCache.find().count() == 2


@pytest.mark.asyncio
async def test_model_failure_leaves_text_untranslated_not_broken(client, school, fake):  # noqa: F811
    fake.fail = True
    as_student()
    r = await client.post("/api/v1/i18n/translate", json={"texts": ["Library Book Return"], "target": "ar"})
    assert r.status_code == 200 and r.json()["translations"] == {}
