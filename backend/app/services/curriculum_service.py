"""Read the textbook library (CurriculumUnit) in the reader's language.

The export holds one record per unit *per language*: the same unit number and title appear once with English text and once
with Arabic text. Callers used to get whichever record came first. Here the records of one unit are grouped and the one in
the requested language is chosen, falling back to the other language (and saying so) when only that edition exists.
"""
from app.core.lang import Lang, other_lang
from app.models.curriculum import CurriculumUnit
from app.services.academic_keys import detect_language, subject_key
from app.services.syllabus_import_service import clean_unit_title

Group = dict[str, CurriculumUnit]  # language -> record of one unit


def unit_language(u: CurriculumUnit) -> str:
    """The language the unit's text is really in (its label can be wrong), falling back to the label for empty text."""
    return detect_language(u.full_text, u.language)


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
    only_missing: bool = False,
) -> dict:
    """Turn the textbook library into the school's syllabus (class -> subject -> chapter, both languages on each chapter).

    Library units are matched to the school's classes and subjects by grade number and canonical subject, so "Class 6" /
    "Grade 6" / "الصف السادس" and "Social Studies" / "Social Science" meet. This is what makes the browser, the Copilot, the
    question paper generator and the homework pages show the textbook for the class a student or teacher is actually in.
    """
    from app.services.syllabus_import_service import Row, clean_extracted_text, run_import

    rows = []
    covered: set[tuple[str, str]] = set()
    school_grades: set[str] = set()
    if only_missing:  # leave class+subject pairs that already have a syllabus (and any edits teachers made) alone
        from app.models.academic import Class, Subject
        from app.models.syllabus import Syllabus
        from app.services.academic_keys import class_key

        classes = {str(c.id): class_key(c.name) for c in await Class.find(Class.school_id == school_id).to_list()}
        subjects = {str(x.id): subject_key(x.name, x.code) for x in await Subject.find(Subject.school_id == school_id).to_list()}
        for syl in await Syllabus.find(Syllabus.school_id == school_id).to_list():
            # "covered" = already has textbook notes. A syllabus that is only a list of chapter names (no notes anywhere) is a
            # skeleton: the library's chapters and notes are added to it, and its own chapters are kept.
            has_notes = any((c.content or "").strip() or any((t.content or "").strip() for t in c.translations.values()) for c in syl.chapters)
            if has_notes and syl.class_id in classes and syl.subject_id in subjects:
                covered.add((classes[syl.class_id], subjects[syl.subject_id]))
        school_grades = set(classes.values())
    for unit in await load_units(school_id):
        if not unit.grade or (str(unit.grade), subject_key(unit.subject)) in covered:
            continue
        if only_missing and str(unit.grade) not in school_grades:
            continue  # automatic loading never invents classes the school doesn't have
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
                            rows_override=(rows, []), create_classes=not only_missing)


_last_checked: dict[str, float] = {}
CHECK_EVERY_SECONDS = 60


async def ensure_synced(school_id: str | None) -> None:
    """Make sure every class+subject the textbook library covers (and the school has) also has a syllabus, so a student or
    teacher who opens a chapter always finds the library content. Existing syllabi are never touched; missing ones are
    created, published, from the library. Cheap: at most one check per school per minute. Never raises."""
    import logging
    import time

    if not school_id or time.monotonic() - _last_checked.get(school_id, -1e9) < CHECK_EVERY_SECONDS:
        return
    _last_checked[school_id] = time.monotonic()
    try:
        # create_missing adds subjects the school lacks (e.g. Social Studies) to classes it has; classes are never created here
        await sync_to_syllabus(school_id, "library-sync", dry_run=False, create_missing=True, only_missing=True)
    except Exception:  # noqa: BLE001 - reading must never fail because the library sync did
        logging.getLogger("curriculum.sync").exception("Library sync failed for %s", school_id)
