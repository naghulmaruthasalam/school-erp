"""Read the textbook library (CurriculumUnit) in the reader's language.

The export holds one record per unit *per language*: the same unit number and title appear once with English text and once
with Arabic text. Callers used to get whichever record came first. Here the records of one unit are grouped and the one in
the requested language is chosen, falling back to the other language (and saying so) when only that edition exists.
"""
from app.core.lang import Lang, other_lang
from app.models.curriculum import CurriculumUnit
from app.services.academic_keys import subject_key
from app.services.syllabus_import_service import clean_unit_title

Group = dict[str, CurriculumUnit]  # language -> record of one unit


def unit_language(u: CurriculumUnit) -> str:
    return "ar" if (u.language or "").lower().startswith("ar") else "en"


async def load_units(school_id: str | None, grade: int | None = None, subject: str | None = None) -> list[CurriculumUnit]:
    """Units visible to a school: the shared library (no school) plus the school's own."""
    query: dict = {"$or": [{"school_id": None}, {"school_id": school_id}]} if school_id else {"school_id": None}
    if grade is not None:
        query["grade"] = grade
    units = await CurriculumUnit.find(query).sort(+CurriculumUnit.unit_number).to_list()
    if subject:
        want = subject_key(subject)
        units = [u for u in units if subject_key(u.subject) == want]
    return units


def group_by_unit(units: list[CurriculumUnit]) -> dict[tuple[int, str, int], Group]:
    groups: dict[tuple[int, str, int], Group] = {}
    for u in units:
        groups.setdefault((u.grade, subject_key(u.subject), u.unit_number), {}).setdefault(unit_language(u), u)
    return dict(sorted(groups.items()))


def pick(group: Group, lang: Lang) -> tuple[CurriculumUnit, str]:
    """(record, language it is actually in). Prefers `lang`; a unit with text beats an empty record in the right language."""
    for candidate in (lang, other_lang(lang)):
        unit = group.get(candidate)
        if unit is not None and unit.full_text.strip():
            return unit, candidate
    first = next(iter(group.values()))
    return first, unit_language(first)


def titles(group: Group) -> tuple[str | None, str | None]:
    """(English title, Arabic title) of a unit, from whichever record has them; file-name style titles are tidied."""
    en = next((u.unit_title_en for u in group.values() if u.unit_title_en), None)
    ar = next((t for t in (clean_unit_title(u.unit_title_ar) for u in group.values()) if t), None)
    return en, ar


def title_in(group: Group, lang: Lang) -> str:
    en, ar = titles(group)
    return (ar if lang == "ar" else en) or en or ar or ""


def describe(group: Group, lang: Lang) -> dict:
    unit, served = pick(group, lang)
    en, ar = titles(group)
    return {
        "id": str(unit.id), "unit_number": unit.unit_number, "title": title_in(group, lang), "title_en": en, "title_ar": ar,
        "total_pages": unit.total_pages, "language": served, "available_languages": sorted(group),
    }


def subject_display(units: list[CurriculumUnit]) -> dict[str, str]:
    """canonical subject key -> the name the library uses for it."""
    out: dict[str, str] = {}
    for u in units:
        out.setdefault(subject_key(u.subject), u.subject)
    return out


async def sync_to_syllabus(
    school_id: str, user_id: str, *, dry_run: bool = True, create_missing: bool = False, mode: str = "merge",
) -> dict:
    """Turn the textbook library into the school's syllabus (class -> subject -> chapter, both languages on each chapter).

    Library units are matched to the school's classes and subjects by grade number and canonical subject, so "Class 6" /
    "Grade 6" / "الصف السادس" and "Social Studies" / "Social Science" meet. This is what makes the browser, the Copilot, the
    question paper generator and the homework pages show the textbook for the class a student or teacher is actually in.
    """
    from app.services.syllabus_import_service import Row, clean_extracted_text, run_import

    rows = []
    for unit in await load_units(school_id):
        if not unit.grade:
            continue
        group = {unit_language(unit): unit}
        en, ar = titles(group)
        rows.append(Row(
            class_name=f"Class {unit.grade}", subject=unit.subject, chapter=en or ar or f"Unit {unit.unit_number}",
            content=clean_extracted_text(unit.full_text or "") or None, order=unit.unit_number,
            language=unit_language(unit), name_ar=ar,
        ))
    if not rows:
        return {"dry_run": dry_run, "problems": ["The textbook library is empty."], "syllabi": [], "totals": {}}
    return await run_import(school_id, user_id, "curriculum-library", b"", dry_run=dry_run, create_missing=create_missing, mode=mode,
                            rows_override=(rows, []))
