"""Stable keys for "the same class" and "the same subject", whatever the school's records call them.

A school can hold "Class 6", "Grade 6", "VI" or "الصف السادس" for one grade, and "Social Studies", "Social Science" or
"الدراسات الاجتماعية" for one subject, sometimes in duplicate records created by different imports. Syllabus and
textbook content is looked up by these keys, so a student in any "Class 6" gets the Class 6 Social Studies material
instead of an empty page because the ids of two equivalent records differ.
"""
import re
import unicodedata

from app.models.academic import Class, Subject

_ROMAN = {"i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8, "ix": 9, "x": 10, "xi": 11, "xii": 12}
_AR_ORDINALS = {
    "الاول": 1, "الثاني": 2, "الثالث": 3, "الرابع": 4, "الخامس": 5, "السادس": 6, "السابع": 7, "الثامن": 8, "التاسع": 9,
    "العاشر": 10, "الحادي عشر": 11, "الثاني عشر": 12,
}
_ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")


def normalize_text(value: str) -> str:
    """Lower-case, strip diacritics, unify Arabic letter variants, collapse spacing and punctuation."""
    text = unicodedata.normalize("NFKC", value or "").translate(_ARABIC_DIGITS).lower()
    text = re.sub(r"[ً-ٰٟـ]", "", text)  # tashkeel + tatweel
    text = text.translate(str.maketrans({"أ": "ا", "إ": "ا", "آ": "ا", "ى": "ي", "ة": "ه"}))
    return re.sub(r"[^a-z0-9؀-ۿ]+", " ", text).strip()


def detect_language(text: str | None, fallback: str | None = None) -> str:
    """"ar" or "en" from the script the text is written in. Textbook exports label their language by file name, and
    mislabelled records (Arabic text tagged "en", or the reverse) otherwise serve the wrong edition, so the text wins
    whenever there is enough of it; the label is only used for empty or very short text."""
    sample = (text or "")[:6000]
    arabic = len(re.findall(r"[\u0600-\u06FF]", sample))
    latin = len(re.findall(r"[A-Za-z]", sample))
    if arabic + latin >= 30:
        return "ar" if arabic > latin else "en"
    return "ar" if str(fallback or "").strip().lower().startswith("ar") else "en"


def class_key(name: str) -> str:
    """"Class 6", "Grade 6 - A", "6", "VI", "الصف السادس" -> "6"; other names keep their normalized text."""
    text = normalize_text(name)
    text = re.sub(r"\b(class|grade|standard|std|year|form)\b", " ", text)
    text = re.sub(r"\bالصف\b", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if text in _AR_ORDINALS:
        return str(_AR_ORDINALS[text])
    for ordinal, n in _AR_ORDINALS.items():  # "الصف السادس أ"
        if text.startswith(ordinal + " "):
            return str(n)
    m = re.match(r"^0?(\d{1,2})(?:\s*[a-z؀-ۿ])?$", text)  # "6", "6a", "6 a"
    if m:
        return str(int(m.group(1)))
    first = text.split(" ")[0] if text else ""
    if first in _ROMAN:
        return str(_ROMAN[first])
    return text


def grade_number(name: str) -> int | None:
    key = class_key(name)
    return int(key) if key.isdigit() else None


_SUBJECT_GROUPS: dict[str, tuple[str, ...]] = {
    "mathematics": ("mathematics", "maths", "math", "mth", "mat", "الرياضيات", "رياضيات"),
    "social_studies": ("social studies", "social science", "social sciences", "social", "sst", "ss", "الدراسات الاجتماعيه",
                       "دراسات اجتماعيه", "العلوم الاجتماعيه", "الاجتماعيات"),
    "science": ("science", "general science", "sci", "العلوم", "علوم", "العلوم العامه"),
    "english": ("english", "english language", "eng", "اللغه الانجليزيه", "الانجليزيه", "انجليزي"),
    "arabic": ("arabic", "arabic language", "ara", "ar", "اللغه العربيه", "العربيه", "عربي"),
    "islamic_education": ("islamic education", "islamic studies", "islamic", "religion", "التربيه الاسلاميه", "الاسلاميه", "تربيه اسلاميه"),
    "physics": ("physics", "phy", "الفيزياء", "فيزياء"),
    "chemistry": ("chemistry", "chem", "الكيمياء", "كيمياء"),
    "biology": ("biology", "bio", "الاحياء", "احياء"),
    "computer": ("computer science", "computer", "computers", "ict", "cs", "information technology", "الحاسوب", "تقنيه المعلومات", "علوم الحاسوب"),
    "geography": ("geography", "geo", "الجغرافيا", "جغرافيا"),
    "history": ("history", "hist", "التاريخ", "تاريخ"),
    "physical_education": ("physical education", "pe", "p e", "sports", "التربيه البدنيه", "الرياضه البدنيه"),
    "art": ("art", "art and craft", "arts", "التربيه الفنيه", "الفنون"),
}
_SUBJECT_LOOKUP = {normalize_text(alias): key for key, aliases in _SUBJECT_GROUPS.items() for alias in aliases}


def subject_key(name: str, code: str | None = None) -> str:
    """"Social Studies" / "Social Science" / "الدراسات الاجتماعية" -> "social_studies"; unknown subjects keep their text."""
    for candidate in (name, code or ""):
        norm = normalize_text(candidate)
        if norm in _SUBJECT_LOOKUP:
            return _SUBJECT_LOOKUP[norm]
        if norm.startswith("ال") and norm[2:] in _SUBJECT_LOOKUP:
            return _SUBJECT_LOOKUP[norm[2:]]
    return normalize_text(name)


async def equivalent_class_ids(school_id: str, class_id: str) -> list[str]:
    """The class itself plus every class in the school that is the same grade (duplicate records, other years)."""
    classes = await Class.find(Class.school_id == school_id).to_list()
    mine = next((c for c in classes if str(c.id) == class_id), None)
    if mine is None:
        return [class_id]
    key = class_key(mine.name)
    return [str(c.id) for c in classes if class_key(c.name) == key] or [class_id]


async def equivalent_subject_ids(school_id: str, subject_id: str) -> list[str]:
    subjects = await Subject.find(Subject.school_id == school_id).to_list()
    mine = next((s for s in subjects if str(s.id) == subject_id), None)
    if mine is None:
        return [subject_id]
    key = subject_key(mine.name, mine.code)
    return [str(s.id) for s in subjects if subject_key(s.name, s.code) == key] or [subject_id]
