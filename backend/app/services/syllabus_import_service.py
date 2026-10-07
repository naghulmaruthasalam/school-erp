"""Bulk-load a curriculum (class -> subject -> chapter -> topics/notes) into the syllabus collection.

Accepted input (CSV or JSON, UTF-8):
  flat rows   class, subject, chapter, topics, description, content, order   (CSV, or a JSON list of objects)
  nested JSON {"classes": [{"name": "Class 8", "subjects": [{"name": "Science",
               "chapters": [{"name": "Force", "topics": ["Push and pull"], "description": "...", "content": "..."}]}]}]}
Topics in a CSV cell are separated by ";" or "|". Classes and subjects are matched by name inside the school;
"Class 8", "Grade 8", "8" and "VIII" are the same class. Re-running the same file updates chapters by name
(merge) instead of duplicating them; mode="replace" makes the file the whole chapter list.
"""
import csv
import io
import json
import re
from dataclasses import dataclass, field

from app.core.deps import CurrentUser
from app.services.academic_keys import class_key, subject_key
from app.core.enums import Role, SyllabusStatus
from app.core.exceptions import PermissionDeniedError, ValidationAppError
from app.models.academic import AcademicYear, Class, Subject
from app.models.base import utcnow
from app.models.syllabus import Chapter, ChapterText, Syllabus

_WRITE_ROLES = (Role.TEACHER, Role.SCHOOL_ADMIN, Role.PRINCIPAL)
MAX_ROWS = 5000
MAX_BYTES = 5 * 1024 * 1024
_CANON = ("class", "subject", "chapter", "topics", "description", "content", "order", "language", "name_ar")
_ROMAN = {"i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8, "ix": 9, "x": 10, "xi": 11, "xii": 12}
_ALIASES = {
    "class": "class", "grade": "class", "standard": "class", "std": "class", "class_name": "class", "grade_name": "class",
    "classname": "class", "gradename": "class", "class_title": "class", "grade_level": "class",
    "grade_id": "class", "gradeid": "class", "class_id": "class", "classid": "class",
    "subject_id": "subject", "subjectid": "subject",
    "subject": "subject", "subject_name": "subject", "subjectname": "subject", "subject_title": "subject",
    "chapter": "chapter", "chapter_name": "chapter", "chaptername": "chapter", "chapter_title": "chapter",
    "unit": "chapter", "lesson": "chapter", "title": "chapter", "name": "chapter",
    "topics": "topics", "topic": "topics", "subtopics": "topics", "sub_topics": "topics", "key_topics": "topics",
    "description": "description", "summary": "description", "overview": "description",
    "content": "content", "notes": "content", "text": "content", "body": "content", "chapter_content": "content",
    "order": "order", "chapter_no": "order", "chapter_number": "order", "chapterno": "order", "no": "order",
    "sequence": "order", "index": "order",
    # one record per textbook unit, with the PDF's extracted text (unit_title_ar is left out on purpose)
    "unit_title_en": "chapter", "unit_title": "chapter", "unit_number": "order", "unit_no": "order", "full_text": "content",
    "language": "language", "lang": "language",
    "unit_title_ar": "name_ar", "chapter_ar": "name_ar", "name_ar": "name_ar", "title_ar": "name_ar",
}
_LIST_KEYS = ("data", "chapters", "items", "results", "rows", "textbooks", "curriculum", "records", "documents")


def _norm(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().lower())


@dataclass
class Row:
    class_name: str
    subject: str
    chapter: str
    topics: list[str] = field(default_factory=list)
    description: str | None = None
    content: str | None = None
    order: int | None = None
    language: str = ""
    name_ar: str | None = None  # the chapter's Arabic title (for a unit that comes in both languages)


def clean_unit_title(raw: str | None) -> str | None:
    """"Unit1_القياس_الكتلة_والسعة_والطول.pdf" -> "القياس الكتلة والسعة والطول" (file-name titles from the textbook export)."""
    text = re.sub(r"\.(pdf|docx?|txt)$", "", (raw or "").strip(), flags=re.I)
    text = re.sub(r"^(unit|chapter|lesson)[\s_-]*\d+[\s_.:-]*", "", text, flags=re.I)
    text = re.sub(r"\s+", " ", text.replace("_", " ")).strip()
    return text or None


def clean_extracted_text(text: str) -> str:
    """Tidy text pulled out of a PDF: drop the translator watermark, stray glyphs and one- or two-character fragments."""
    text = re.sub(r"Machine\s+Translated\s+by\s+Google", " ", text, flags=re.I)
    text = text.replace("\u00ff", " ").replace("\ufffd", " ")
    lines = []
    for line in text.splitlines():
        line = re.sub(r"[ \t\u00a0]+", " ", line).strip()
        if len(line) <= 2 and not line.isalnum():
            continue
        if line.isdigit() and len(line) <= 4:  # page numbers
            continue
        lines.append(line)
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def _split_topics(value) -> list[str]:
    if isinstance(value, list):
        return [t for t in (_text(v) for v in value) if t]
    return [t.strip() for t in re.split(r"[;|\n]", str(value or "")) if t.strip()]


def _to_order(value) -> int | None:
    try:
        return int(float(str(value).strip())) if str(value).strip() else None
    except ValueError:
        return None


def _text(value) -> str:
    """A cell that may be a string, a {name|title: ...} object, a number, or a list of paragraphs."""
    if value is None:
        return ""
    if isinstance(value, dict):
        if "$oid" in value:
            return str(value["$oid"])
        for key in ("name", "title", "label", "en", "text"):
            if value.get(key):
                return _text(value[key])
        return ""
    if isinstance(value, list):
        return "\n\n".join(t for t in (_text(v) for v in value) if t)
    text = str(value).strip()
    repr_id = re.fullmatch(r"ObjectId\('([0-9a-fA-F]{24})'\)", text)  # an id exported as a Python repr
    return repr_id.group(1) if repr_id else text


def _flat_row(raw: dict, field_map: dict[str, str] | None = None, value_map: dict[str, dict[str, str]] | None = None) -> Row:
    mapped = {}
    lowered = {re.sub(r"[\s-]+", "_", str(k).strip().lower()): v for k, v in raw.items()}
    for source, target in (field_map or {}).items():  # explicit mapping from the school's source settings wins
        key = re.sub(r"[\s-]+", "_", source.strip().lower())
        if key in lowered and target in _CANON:
            mapped[target] = lowered[key]
    for key, value in lowered.items():
        alias = _ALIASES.get(key)
        if alias and alias not in mapped:
            mapped[alias] = value
    class_name, subject, chapter = (_text(mapped.get(k)) for k in ("class", "subject", "chapter"))
    # sources that only carry ids: the school supplies id -> name tables (e.g. {"class": {"64f...": "Class 8"}})
    class_name = (value_map or {}).get("class", {}).get(class_name, class_name)
    subject = (value_map or {}).get("subject", {}).get(subject, subject)
    if not (class_name and subject and chapter):
        raise ValueError(f"needs class, subject and chapter (found fields: {', '.join(list(raw)[:12])})")
    content = _text(mapped.get("content")) or None
    if content and "full_text" in lowered and lowered["full_text"] and _text(lowered["full_text"]) == content:
        content = clean_extracted_text(content) or None
    return Row(
        class_name=class_name, subject=subject, chapter=chapter,
        topics=_split_topics(mapped.get("topics")),
        description=_text(mapped.get("description")) or None,
        content=content,
        order=_to_order(_text(mapped.get("order", ""))),
        language=_text(mapped.get("language")).lower()[:5],
        name_ar=clean_unit_title(_text(mapped.get("name_ar"))) if re.search(r"[\u0600-\u06FF]", _text(mapped.get("name_ar"))) else None,
    )


def parse_rows(
    filename: str, data: bytes, field_map: dict[str, str] | None = None, value_map: dict[str, dict[str, str]] | None = None,
) -> tuple[list[Row], list[str]]:
    """(rows, per-row problems). Raises ValidationAppError when the file can't be read at all."""
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValidationAppError("The file must be UTF-8 text (CSV or JSON)") from exc
    problems: list[str] = []
    rows: list[Row] = []
    name = filename.lower()
    if name.endswith((".json", ".ndjson", ".jsonl")) or text.lstrip().startswith(("{", "[")):
        try:
            doc = json.loads(text)
        except json.JSONDecodeError as exc:
            # NDJSON / JSON Lines (one record per line, e.g. a MongoDB export)
            lines = [ln for ln in text.splitlines() if ln.strip()]
            try:
                doc = [json.loads(ln) for ln in lines]
            except json.JSONDecodeError:
                raise ValidationAppError(f"That isn't valid JSON: {exc.msg} (line {exc.lineno})") from exc
        if isinstance(doc, dict) and "classes" not in doc:
            wrapped = next((doc[k] for k in _LIST_KEYS if isinstance(doc.get(k), list)), None)
            if wrapped is None:
                wrapped = next((v for v in doc.values() if isinstance(v, list) and v and isinstance(v[0], dict)), None)
            if wrapped is not None:
                doc = wrapped
        if isinstance(doc, dict):
            for ci, c in enumerate(doc.get("classes") or [], 1):
                for s in c.get("subjects") or []:
                    for pos, ch in enumerate(s.get("chapters") or [], 1):
                        try:
                            rows.append(_flat_row({
                                "class": c.get("name"), "subject": s.get("name"), "chapter": ch.get("name"),
                                "topics": ch.get("topics"), "description": ch.get("description"),
                                "content": ch.get("content"), "order": ch.get("order", pos),
                            }))
                        except ValueError as exc:
                            problems.append(f"class {ci}: {exc}")
        elif isinstance(doc, list):
            for i, raw in enumerate(doc, 1):
                try:
                    rows.append(_flat_row(raw if isinstance(raw, dict) else {}, field_map, value_map))
                except ValueError as exc:
                    problems.append(f"item {i}: {exc}")
        else:
            raise ValidationAppError("JSON must be a list of rows or an object with a 'classes' list")
    else:
        reader = csv.DictReader(io.StringIO(text))
        for i, raw in enumerate(reader, 2):  # row 1 is the header
            if not any((v or "").strip() for v in raw.values() if isinstance(v, str)):
                continue
            try:
                rows.append(_flat_row(raw, field_map, value_map))
            except ValueError as exc:
                problems.append(f"row {i}: {exc}")
    if len(rows) > MAX_ROWS:
        raise ValidationAppError(f"Too many rows ({len(rows)}); the limit is {MAX_ROWS} per file")
    if not rows and not problems:
        raise ValidationAppError("No chapters found in the file")
    return rows, problems


TEMPLATE_CSV = (
    "class,subject,chapter,topics,description,content,order\n"
    'Class 8,Science,Force and Pressure,"Push and pull; Types of force; Pressure",'
    '"How forces change motion","A force is a push or a pull...",1\n'
    'Class 8,Mathematics,Rational Numbers,"Properties; Number line",,,1\n'
)


async def import_curriculum(
    current: CurrentUser, filename: str, data: bytes, *, dry_run: bool = True,
    create_missing: bool = False, mode: str = "merge", status: SyllabusStatus = SyllabusStatus.PUBLISHED,
    field_map: dict[str, str] | None = None,
) -> dict:
    if current.role not in _WRITE_ROLES:
        raise PermissionDeniedError("Only teachers or school admins/principals can import a syllabus")
    return await run_import(
        current.school_id, str(current.user.id), filename, data,
        dry_run=dry_run, create_missing=create_missing, mode=mode, status=status, field_map=field_map,
    )


async def run_import(
    school_id: str, user_id: str, filename: str, data: bytes, *, dry_run: bool = True,
    create_missing: bool = False, mode: str = "merge", status: SyllabusStatus = SyllabusStatus.PUBLISHED,
    field_map: dict[str, str] | None = None, rows_override: tuple | None = None,
) -> dict:
    """The import itself, with no request context (also used by scripts/import_syllabus.py)."""
    if mode not in ("merge", "replace"):
        raise ValidationAppError("mode must be 'merge' or 'replace'")
    rows, problems = rows_override if rows_override is not None else parse_rows(filename, data, field_map)

    year = await AcademicYear.find_one(AcademicYear.school_id == school_id, AcademicYear.is_current == True)  # noqa: E712
    if year is None:
        year = await AcademicYear.find(AcademicYear.school_id == school_id).sort("-start_date").first_or_none()
    if year is None:
        raise ValidationAppError("Create an academic year first")

    classes = await Class.find(Class.school_id == school_id, Class.academic_year_id == str(year.id)).to_list()
    by_class = {class_key(c.name): c for c in classes}
    subjects = await Subject.find(Subject.school_id == school_id).to_list()
    by_subject = {subject_key(s.name, s.code): s for s in subjects} | {_norm(s.name): s for s in subjects} | {_norm(s.code): s for s in subjects}

    groups: dict[tuple[str, str], list[Row]] = {}
    for r in rows:  # a unit that arrives once per language becomes one chapter with both texts
        groups.setdefault((class_key(r.class_name), subject_key(r.subject)), []).append(r)

    report = {"academic_year": year.name, "dry_run": dry_run, "problems": list(problems), "syllabi": [],
              "created_classes": [], "created_subjects": [],
              "totals": {"syllabi_created": 0, "syllabi_updated": 0, "chapters_added": 0, "chapters_updated": 0, "skipped_groups": 0}}

    for group in groups.values():
        class_name, subject_name = group[0].class_name, group[0].subject
        school_class = by_class.get(class_key(class_name))
        if school_class is None:
            if not create_missing:
                report["problems"].append(f"Class '{class_name}' doesn't exist in {year.name} (tick 'create missing classes and subjects')")
                report["totals"]["skipped_groups"] += 1
                continue
            new_name = f"Class {class_name.strip()}" if class_name.strip().isdigit() else class_name.strip()
            school_class = Class(school_id=school_id, academic_year_id=str(year.id), name=new_name, order=len(by_class) + 1)
            if not dry_run:
                await school_class.insert()
            by_class[class_key(class_name)] = school_class
            report["created_classes"].append(new_name)
        subject = by_subject.get(_norm(subject_name)) or by_subject.get(subject_key(subject_name))
        if subject is None:
            if not create_missing:
                report["problems"].append(f"Subject '{subject_name}' doesn't exist (tick 'create missing classes and subjects')")
                report["totals"]["skipped_groups"] += 1
                continue
            code = re.sub(r"[^A-Z0-9]", "", subject_name.upper())[:6] or "SUBJ"
            subject = Subject(school_id=school_id, name=subject_name.strip(), code=code)
            if not dry_run:
                await subject.insert()
            by_subject[_norm(subject_name)] = subject
            report["created_subjects"].append(subject_name.strip())

        class_id = str(school_class.id) if school_class.id else f"new:{class_name}"
        subject_id = str(subject.id) if subject.id else f"new:{subject_name}"
        existing = None
        if not class_id.startswith("new:") and not subject_id.startswith("new:"):
            found = await Syllabus.find(
                Syllabus.school_id == school_id, Syllabus.academic_year_id == str(year.id),
                Syllabus.class_id == class_id, Syllabus.subject_id == subject_id,
            ).to_list()
            # a class+subject can have a draft next to the published syllabus: load into the published one
            existing = next((x for x in found if x.status == SyllabusStatus.PUBLISHED), found[0] if found else None)
        chapters = list(existing.chapters) if existing and mode == "merge" else []
        index = {_norm(c.name): i for i, c in enumerate(chapters)}
        added = updated = 0
        for pos, r in enumerate(group, 1):
            key = _norm(r.chapter)
            arabic = r.language.startswith("ar")
            if key in index:
                c = chapters[index[key]]
                if arabic:  # the Arabic edition of a chapter is stored next to the English one, not over it
                    c.translations["ar"] = ChapterText(
                        name=r.name_ar or (c.translations.get("ar") or ChapterText()).name,
                        description=r.description or (c.translations.get("ar") or ChapterText()).description,
                        topics=r.topics or (c.translations.get("ar") or ChapterText()).topics,
                        content=r.content or (c.translations.get("ar") or ChapterText()).content,
                    )
                else:
                    c.description = r.description or c.description
                    c.topics = r.topics or c.topics
                    c.content = r.content or c.content
                if r.order:
                    c.order = r.order
                updated += 1
            else:
                new = Chapter(
                    name=r.chapter, description=None if arabic else r.description, topics=[] if arabic else r.topics,
                    content=None if arabic else r.content, order=r.order or len(chapters) + 1,
                )
                if arabic:
                    new.translations["ar"] = ChapterText(name=r.name_ar, description=r.description, topics=r.topics, content=r.content)
                chapters.append(new)
                index[key] = len(chapters) - 1
                added += 1
        chapters.sort(key=lambda c: c.order)

        if not dry_run:
            if existing:
                existing.chapters = chapters
                existing.updated_at = utcnow()
                await existing.save()
            else:
                await Syllabus(
                    school_id=school_id, academic_year_id=str(year.id), class_id=class_id, subject_id=subject_id,
                    title=f"{subject.name} - {school_class.name}", status=status, chapters=chapters,
                    created_by=user_id,
                ).insert()
        t = report["totals"]
        t["syllabi_updated" if existing else "syllabi_created"] += 1
        t["chapters_added"] += added
        t["chapters_updated"] += updated
        report["syllabi"].append({
            "class": school_class.name, "subject": subject.name, "action": "update" if existing else "create",
            "chapters_added": added, "chapters_updated": updated, "chapters": [c.name for c in chapters],
        })
    return report
