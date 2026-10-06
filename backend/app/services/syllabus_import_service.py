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
from app.core.enums import Role, SyllabusStatus
from app.core.exceptions import PermissionDeniedError, ValidationAppError
from app.models.academic import AcademicYear, Class, Subject
from app.models.base import utcnow
from app.models.syllabus import Chapter, Syllabus

_WRITE_ROLES = (Role.TEACHER, Role.SCHOOL_ADMIN, Role.PRINCIPAL)
MAX_ROWS = 5000
MAX_BYTES = 5 * 1024 * 1024
_ROMAN = {"i": 1, "ii": 2, "iii": 3, "iv": 4, "v": 5, "vi": 6, "vii": 7, "viii": 8, "ix": 9, "x": 10, "xi": 11, "xii": 12}
_ALIASES = {
    "class": "class", "grade": "class", "standard": "class", "std": "class",
    "subject": "subject",
    "chapter": "chapter", "chapter_name": "chapter", "unit": "chapter", "lesson": "chapter",
    "topics": "topics", "topic": "topics", "subtopics": "topics",
    "description": "description", "summary": "description",
    "content": "content", "notes": "content", "text": "content",
    "order": "order", "chapter_no": "order", "chapter_number": "order", "no": "order",
}


def class_key(name: str) -> str:
    text = re.sub(r"\b(class|grade|standard|std)\b\.?", " ", name.lower())
    text = re.sub(r"[^a-z0-9]+", " ", text).strip()
    return str(_ROMAN.get(text, text))


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


def _split_topics(value) -> list[str]:
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    return [t.strip() for t in re.split(r"[;|\n]", str(value or "")) if t.strip()]


def _to_order(value) -> int | None:
    try:
        return int(float(str(value).strip())) if str(value).strip() else None
    except ValueError:
        return None


def _flat_row(raw: dict) -> Row:
    mapped = {}
    for key, value in raw.items():
        alias = _ALIASES.get(re.sub(r"[\s-]+", "_", str(key).strip().lower()))
        if alias:
            mapped[alias] = value
    class_name, subject, chapter = (str(mapped.get(k) or "").strip() for k in ("class", "subject", "chapter"))
    if not (class_name and subject and chapter):
        raise ValueError("needs class, subject and chapter")
    return Row(
        class_name=class_name, subject=subject, chapter=chapter,
        topics=_split_topics(mapped.get("topics")),
        description=(str(mapped["description"]).strip() or None) if mapped.get("description") else None,
        content=(str(mapped["content"]).strip() or None) if mapped.get("content") else None,
        order=_to_order(mapped.get("order", "")),
    )


def parse_rows(filename: str, data: bytes) -> tuple[list[Row], list[str]]:
    """(rows, per-row problems). Raises ValidationAppError when the file can't be read at all."""
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise ValidationAppError("The file must be UTF-8 text (CSV or JSON)") from exc
    problems: list[str] = []
    rows: list[Row] = []
    name = filename.lower()
    if name.endswith(".json") or text.lstrip().startswith(("{", "[")):
        try:
            doc = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ValidationAppError(f"That isn't valid JSON: {exc.msg} (line {exc.lineno})") from exc
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
                    rows.append(_flat_row(raw if isinstance(raw, dict) else {}))
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
                rows.append(_flat_row(raw))
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
) -> dict:
    if current.role not in _WRITE_ROLES:
        raise PermissionDeniedError("Only teachers or school admins/principals can import a syllabus")
    return await run_import(
        current.school_id, str(current.user.id), filename, data,
        dry_run=dry_run, create_missing=create_missing, mode=mode, status=status,
    )


async def run_import(
    school_id: str, user_id: str, filename: str, data: bytes, *, dry_run: bool = True,
    create_missing: bool = False, mode: str = "merge", status: SyllabusStatus = SyllabusStatus.PUBLISHED,
) -> dict:
    """The import itself, with no request context (also used by scripts/import_syllabus.py)."""
    if mode not in ("merge", "replace"):
        raise ValidationAppError("mode must be 'merge' or 'replace'")
    rows, problems = parse_rows(filename, data)

    year = await AcademicYear.find_one(AcademicYear.school_id == school_id, AcademicYear.is_current == True)  # noqa: E712
    if year is None:
        year = await AcademicYear.find(AcademicYear.school_id == school_id).sort("-start_date").first_or_none()
    if year is None:
        raise ValidationAppError("Create an academic year first")

    classes = await Class.find(Class.school_id == school_id, Class.academic_year_id == str(year.id)).to_list()
    by_class = {class_key(c.name): c for c in classes}
    subjects = await Subject.find(Subject.school_id == school_id).to_list()
    by_subject = {_norm(s.name): s for s in subjects} | {_norm(s.code): s for s in subjects}

    groups: dict[tuple[str, str], list[Row]] = {}
    for r in rows:
        groups.setdefault((class_key(r.class_name), _norm(r.subject)), []).append(r)

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
            school_class = Class(school_id=school_id, academic_year_id=str(year.id), name=class_name.strip(), order=len(by_class) + 1)
            if not dry_run:
                await school_class.insert()
            by_class[class_key(class_name)] = school_class
            report["created_classes"].append(class_name.strip())
        subject = by_subject.get(_norm(subject_name))
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
            if key in index:
                c = chapters[index[key]]
                c.description = r.description or c.description
                c.topics = r.topics or c.topics
                c.content = r.content or c.content
                if r.order:
                    c.order = r.order
                updated += 1
            else:
                chapters.append(Chapter(
                    name=r.chapter, description=r.description, topics=r.topics, content=r.content,
                    order=r.order or len(chapters) + 1,
                ))
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
