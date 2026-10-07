"""Translate short UI strings that come from data (people's names, titles, notices, error texts) into Arabic or English.

Everything the application itself writes is translated at build time. What schools type (a homework title, a notice, a
student's name) is not, so the UI asks here for the text it is about to show in the other language. Results are cached
per text, so each string is translated by the model once.
"""
import hashlib
import logging
import re

from app.copilot import llm
from app.models.translation import TranslationCache

logger = logging.getLogger("translate")

MAX_ITEMS = 60
MAX_CHARS = 700
_LATIN = re.compile(r"[A-Za-z]")
_ARABIC = re.compile(r"[؀-ۿ]")
NAMES = {"ar": "Arabic (Modern Standard Arabic)", "en": "English"}

SYSTEM = """You translate short texts shown in a school management app into {language}.
Rules: translate meaning, not word for word, with school/education vocabulary used in Oman and the Gulf. Transliterate personal
names into the target script. Leave unchanged: emails, URLs, ids and codes (e.g. DEMO-STU-001, INV-2026-001), numbers, dates in numeric
form, formulas, and the product names Cogniitec and Copilot. If a text is already in the target language, return it as it is.
Keep the same line breaks and punctuation style. Respond ONLY with JSON: {{"translations": ["...", "..."]}} with exactly one entry per input, in order."""


def needs_translation(text: str, target: str) -> bool:
    if not text or len(text) > MAX_CHARS:
        return False
    if target == "ar":
        return bool(_LATIN.search(text)) and len(_LATIN.findall(text)) >= 2
    return bool(_ARABIC.search(text))


def _key(target: str, text: str) -> str:
    return hashlib.sha1(f"{target}\x00{text}".encode()).hexdigest()


async def translate_texts(texts: list[str], target: str) -> dict[str, str]:
    """{source: translation} for the texts that needed (and got) a translation. Never raises: on failure returns what it has."""
    target = "ar" if target.startswith("ar") else "en"
    wanted = list(dict.fromkeys(t.strip() for t in texts[:MAX_ITEMS] if needs_translation(t.strip(), target)))
    if not wanted:
        return {}
    out: dict[str, str] = {}
    cached = {c.key: c for c in await TranslationCache.find({"key": {"$in": [_key(target, t) for t in wanted]}}).to_list()}
    missing = []
    for t in wanted:
        hit = cached.get(_key(target, t))
        if hit:
            out[t] = hit.translated
        else:
            missing.append(t)
    if missing and llm.is_configured():
        try:
            import json

            data = await llm.call_json(SYSTEM.format(language=NAMES[target]), json.dumps(missing, ensure_ascii=False))
            items = data.get("translations") if isinstance(data, dict) else None
            if isinstance(items, list) and len(items) == len(missing):
                for src, tr in zip(missing, items):
                    tr = str(tr or "").strip()
                    if tr and tr != src:
                        out[src] = tr
                        await TranslationCache(key=_key(target, src), target=target, source=src, translated=tr).insert()
        except Exception as exc:  # noqa: BLE001 - untranslated text is still readable
            logger.warning("Translation failed: %s", type(exc).__name__)
    return out
