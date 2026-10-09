"""Which language Riyah should answer in: the one the user typed or spoke, unless they chose a language explicitly."""
import re

ISO = {
    "en": "English", "ar": "Arabic", "hi": "Hindi", "ta": "Tamil", "ur": "Urdu", "fr": "French", "es": "Spanish", "bn": "Bengali",
    "ml": "Malayalam", "te": "Telugu", "kn": "Kannada", "mr": "Marathi", "gu": "Gujarati", "pa": "Punjabi", "fa": "Persian",
    "tr": "Turkish", "de": "German", "ru": "Russian", "zh": "Chinese", "id": "Indonesian", "si": "Sinhala", "ne": "Nepali",
    "sw": "Swahili", "pt": "Portuguese", "it": "Italian", "ja": "Japanese", "ko": "Korean",
}
_NAME_TO_ISO = {v.lower(): k for k, v in ISO.items()}
_SCRIPTS = [  # (language, unicode range)
    ("Arabic", r"[؀-ۿݐ-ݿ]"), ("Hindi", r"[ऀ-ॿ]"), ("Tamil", r"[஀-௿]"), ("Bengali", r"[ঀ-৿]"),
    ("Telugu", r"[ఀ-౿]"), ("Kannada", r"[ಀ-೿]"), ("Malayalam", r"[ഀ-ൿ]"), ("Gujarati", r"[઀-૿]"),
    ("Punjabi", r"[਀-੿]"),
]


def name_from_code(code: str | None) -> str | None:
    """"ar" / "ar-OM" / "arabic" -> "Arabic". None when it is not a language we know."""
    if not code:
        return None
    c = code.strip().lower()
    if c in _NAME_TO_ISO:
        return ISO[_NAME_TO_ISO[c]]
    return ISO.get(re.split(r"[-_]", c)[0])


def code_of(name: str | None) -> str:
    return _NAME_TO_ISO.get((name or "English").lower(), "en")


def detect_script_language(text: str) -> str | None:
    """The language a piece of text is written in, from its script (Arabic, Devanagari, Tamil, ...; Latin letters = English).
    None when there are too few letters to tell."""
    best, best_n = None, 0
    for lang, rx in _SCRIPTS:
        n = len(re.findall(rx, text))
        if n > best_n:
            best, best_n = lang, n
    latin = len(re.findall(r"[A-Za-z]", text))
    if best and best_n >= max(2, latin // 2):
        return best
    return "English" if latin >= 3 else None


def resolve_reply_language(message: str, requested: str | None, session_language: str | None) -> str:
    """An explicit choice wins; "auto" (or nothing) follows the language of the message, falling back to the session's."""
    if requested and requested.strip().lower() not in ("", "auto"):
        return name_from_code(requested) or requested.strip().title()
    return detect_script_language(message) or session_language or "English"
