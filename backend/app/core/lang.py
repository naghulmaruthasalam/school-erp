"""Which language the caller wants: ?lang=ar, else the Accept-Language header the frontend sends, else English."""
from typing import Literal

from fastapi import Query, Request

Lang = Literal["en", "ar"]
LANG_NAMES = {"en": "English", "ar": "Arabic"}


def normalize_lang(value: str | None, default: Lang = "en") -> Lang:
    text = (value or "").strip().lower()
    if text.startswith("ar"):  # "ar", "ar-OM", "arabic"
        return "ar"
    if text.startswith("en"):
        return "en"
    return default


def other_lang(lang: Lang) -> Lang:
    return "en" if lang == "ar" else "ar"


def get_lang(request: Request, lang: str | None = Query(None, description="en or ar; defaults to Accept-Language")) -> Lang:
    if lang:
        return normalize_lang(lang)
    header = request.headers.get("accept-language", "")
    first = header.split(",")[0].split(";")[0] if header else ""
    return normalize_lang(first)
