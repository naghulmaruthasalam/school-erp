"""The textbook library for Std 1-12, in both languages.

Ingest: records (NDJSON / JSON) for any grade 1-12; the language of each record is detected from its text. Translate: when a unit
exists in only one language, the other is produced by the AI, checked automatically (numbers kept, script and length plausible,
a second AI pass that compares source and translation) and stored FLAGGED so a teacher or admin can review and approve it.
Nothing here can promise a perfect translation; what it does is make every translation checked, visible and correctable."""
import hashlib
import json
import logging
import re
from datetime import datetime, timezone

from app.core.lang import other_lang
from app.models.curriculum import CurriculumMetadata, CurriculumUnit, PageContent
from app.services.academic_keys import detect_language, grade_number, normalize_text, subject_key

logger = logging.getLogger("curriculum.library")
GRADES = tuple(range(1, 13))
_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
LANG_NAME = {"en": "English", "ar": "Modern Standard Arabic"}


def _hash(text: str) -> str:
    return hashlib.md5((text or "").encode("utf-8")).hexdigest()  # noqa: S324 - a change detector, not security


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ------------------------------------------------------------------ ingest

def parse_records(filename: str, data: bytes) -> tuple[list[dict], list[str]]:
    """NDJSON (one unit per line), a JSON list, or a JSON object with a "units" list -> (records, problems)."""
    text = data.decode("utf-8-sig", errors="replace").strip()
    problems: list[str] = []
    if not text:
        return [], ["The file is empty."]
    if text.startswith("["):
        try:
            return [r for r in json.loads(text) if isinstance(r, dict)], problems
        except json.JSONDecodeError as exc:
            return [], [f"Invalid JSON: {exc}"]
    if text.startswith("{"):
        try:
            obj = json.loads(text)
            if isinstance(obj, dict) and isinstance(obj.get("units"), list):
                return [r for r in obj["units"] if isinstance(r, dict)], problems
        except json.JSONDecodeError:
            pass  # several lines of JSON: NDJSON
    out = []
    for n, line in enumerate(text.splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            rec = json.loads(line)
            if isinstance(rec, dict):
                out.append(rec)
        except json.JSONDecodeError as exc:
            problems.append(f"Line {n}: invalid JSON ({exc.msg})")
    return out, problems


def _grade_of(rec: dict) -> int | None:
    raw = rec.get("class", rec.get("grade", rec.get("std")))
    if isinstance(raw, int):
        return raw
    n = grade_number(str(raw)) if raw not in (None, "") else None
    return n


async def ingest_records(records: list[dict], school_id: str | None) -> dict:
    """Store records in the library. A unit exists once per language; an original replaces an earlier machine translation of
    the same language, and is never replaced by one."""
    report = {"inserted": 0, "updated": 0, "unchanged": 0, "skipped": 0, "problems": [], "grades": [], "languages": {"en": 0, "ar": 0}}
    grades: set[int] = set()
    for i, rec in enumerate(records, 1):
        grade = _grade_of(rec)
        subject = str(rec.get("subject") or "").strip()
        try:
            unit_number = int(rec.get("unit_number"))
        except (TypeError, ValueError):
            unit_number = 0
        text = str(rec.get("full_text") or "").strip()
        if grade not in GRADES:
            report["problems"].append(f"Record {i}: class/grade must be 1 to 12 (got {rec.get('class', rec.get('grade'))!r})")
        elif not subject or unit_number <= 0:
            report["problems"].append(f"Record {i}: needs a subject and a unit number")
        elif not text:
            report["problems"].append(f"Record {i}: Grade {grade} {subject} unit {unit_number} has no text")
        else:
            lang = detect_language(text, rec.get("language"))
            skey = subject_key(subject)
            same = [u for u in await CurriculumUnit.find({"grade": grade, "unit_number": unit_number, "school_id": school_id}).to_list()
                    if subject_key(u.subject) == skey and detect_language(u.full_text, u.language) == lang]
            pages = [PageContent(page_number=int(p.get("page_number", n)), text=str(p.get("text", ""))) for n, p in enumerate(rec.get("pages") or [], 1) if isinstance(p, dict)]
            fields = dict(
                school_id=school_id, grade=grade, subject=subject, language=lang, unit_number=unit_number,
                unit_title_ar=rec.get("unit_title_ar"), unit_title_en=rec.get("unit_title_en"), source_zip=rec.get("source_zip"),
                source_file=rec.get("source_file"), total_pages=int(rec.get("total_pages") or len(pages) or 0),
                file_size_bytes=int(rec.get("file_size_bytes") or 0), content_hash_md5=_hash(text), full_text=text, pages=pages,
                metadata=CurriculumMetadata(**{k: (rec["metadata"] or {}).get(k) for k in ("curriculum", "semester", "grade_level", "content_type")}) if isinstance(rec.get("metadata"), dict) else None,
            )
            if same:
                u = same[0]
                if u.content_hash_md5 == fields["content_hash_md5"] and not u.translated_from:
                    report["unchanged"] += 1
                else:
                    for k, v in fields.items():
                        setattr(u, k, v if v is not None else getattr(u, k))
                    u.translated_from = u.translation_status = u.translation_source_hash = None  # an original replaces a translation
                    u.translation_flags = []
                    u.updated_at = _now()
                    await u.save()
                    report["updated"] += 1
            else:
                await CurriculumUnit(**fields).insert()
                report["inserted"] += 1
            report["languages"][lang] += 1
            grades.add(grade)
    report["grades"] = sorted(grades)
    report["skipped"] = len(report["problems"])
    return report


# ------------------------------------------------------------------ translation

def split_chunks(text: str, limit: int = 2200) -> list[str]:
    """Paragraph-sized pieces (never splitting inside a sentence unless a paragraph alone is longer than the limit)."""
    pieces: list[str] = []
    for para in re.split(r"\n\s*\n", text.strip()):
        para = para.strip()
        if not para:
            continue
        if len(para) <= limit:
            pieces.append(para)
            continue
        sentences = re.split(r"(?<=[.!?؟۔])\s+", para)
        cur = ""
        for s in sentences:
            while len(s) > limit:  # a "sentence" with no stops at all
                pieces.append(s[:limit]); s = s[limit:]
            if cur and len(cur) + len(s) + 1 > limit:
                pieces.append(cur); cur = s
            else:
                cur = f"{cur} {s}".strip()
        if cur:
            pieces.append(cur)
    chunks: list[str] = []
    cur = ""
    for p in pieces:  # pack small paragraphs together up to the limit, keeping their blank lines
        if cur and len(cur) + len(p) + 2 > limit:
            chunks.append(cur); cur = p
        else:
            cur = f"{cur}\n\n{p}" if cur else p
    if cur:
        chunks.append(cur)
    return chunks


def _numbers(text: str) -> list[str]:
    return sorted(re.findall(r"\d+(?:[.,]\d+)?", text.translate(_DIGITS)))


def check_chunk(source: str, translated: str, target: str) -> list[str]:
    """Automatic checks on one translated piece. Returns what looks wrong (empty = nothing found)."""
    issues = []
    if not translated.strip():
        return ["empty translation"]
    if _numbers(source) != _numbers(translated):
        issues.append("the numbers differ from the source")
    ratio = len(translated) / max(1, len(source))
    if not 0.4 <= ratio <= 2.5:
        issues.append(f"the length is implausible ({ratio:.1f}x the source)")
    letters = re.findall(r"[A-Za-z؀-ۿ]", translated)
    if letters:
        arabic = sum(1 for c in letters if c >= "؀") / len(letters)
        if target == "ar" and arabic < 0.6:
            issues.append("much of the text is not Arabic")
        if target == "en" and arabic > 0.3:
            issues.append("much of the text is still Arabic")
    if source.count("\n\n") > 0 and translated.count("\n\n") == 0 and len(source) > 400:
        issues.append("paragraph breaks were lost")
    return issues


def _system(target: str, grade: int, subject: str, glossary: list[tuple[str, str]]) -> str:
    terms = "\n".join(f"- {en} = {ar}" for en, ar in glossary[:40])
    src = other_lang(target)
    return (
        f"You are a professional translator of school textbooks. Translate the text from {LANG_NAME[src]} into {LANG_NAME[target]} for students in "
        f"grade {grade}, subject: {subject}.\nRules:\n"
        "1. Translate EVERYTHING faithfully. Do not summarise, explain, add or leave anything out.\n"
        "2. Keep every number, date, unit, formula, list marker and the paragraph / line structure exactly.\n"
        "3. Use the standard curriculum term for technical words, and the standard spelling for names of people and places "
        + ("(e.g. Muscat = مسقط).\n" if target == "ar" else "(e.g. مسقط = Muscat).\n")
        + "4. Write natural, correct text a teacher would be happy to hand out.\n"
        + (f"5. Use these established terms:\n{terms}\n" if terms else "")
        + "Output ONLY the translation, with no notes."
    )


async def _translate_piece(llm, source: str, target: str, system: str) -> tuple[str, list[str]]:
    """One piece: translate, run the automatic checks, then let a second AI pass compare source and translation and correct it."""
    translated = (await llm.call_text(system, source, temperature=0.1)).strip()
    issues = check_chunk(source, translated, target)
    try:
        verdict = await llm.call_json(
            "You check a school-textbook translation against its source. Respond ONLY with JSON: "
            '{"faithful": true or false, "issues": [short strings], "corrected": the full corrected translation, or null when it is faithful}. '
            "Faithful means: nothing omitted or added, all numbers/units/names preserved, correct terminology, natural wording.",
            json.dumps({"source_language": other_lang(target), "target_language": target, "source": source, "translation": translated}, ensure_ascii=False),
        )
    except Exception as exc:  # noqa: BLE001 - a failed check must not lose the translation; it is flagged instead
        logger.warning("Translation check failed: %s", exc)
        return translated, [*issues, "the second-pass check could not run"]
    if isinstance(verdict, dict) and verdict.get("faithful") is False:
        fixed = str(verdict.get("corrected") or "").strip()
        if fixed:
            again = check_chunk(source, fixed, target)
            if len(again) <= len(issues):  # the correction is no worse than the original
                translated, issues = fixed, again
            else:
                issues = [*issues, *[str(x) for x in verdict.get("issues") or []][:2]]
        else:
            issues = [*issues, *[str(x) for x in verdict.get("issues") or []][:2]]
    return translated, issues


async def translate_group(group: dict[str, CurriculumUnit], target: str, school_id: str | None, *, force: bool = False,
                          glossary: list[tuple[str, str]] | None = None) -> dict:
    """Make the `target`-language edition of one unit from the other. Returns {"action": translated|skipped, "reason"/"flags"}."""
    from app.copilot import llm

    src_lang = other_lang(target)
    src = group.get(src_lang)
    if src is None or not src.full_text.strip():
        return {"action": "skipped", "reason": f"no {src_lang} text to translate from"}
    existing = group.get(target)
    if existing is not None and existing.full_text.strip():
        if not existing.translated_from:
            return {"action": "skipped", "reason": "an original edition already exists"}
        if existing.translation_status == "reviewed" and not force:
            return {"action": "skipped", "reason": "already reviewed by a person"}
        if existing.translation_source_hash == _hash(src.full_text) and not force:
            return {"action": "skipped", "reason": "up to date"}
    system = _system(target, src.grade, src.subject, glossary or [])
    chunks = split_chunks(src.full_text)
    done: list[str] = []
    flags: list[str] = []
    for n, chunk in enumerate(chunks, 1):
        text, issues = await _translate_piece(llm, chunk, target, system)
        done.append(text)
        flags += [f"part {n}/{len(chunks)}: {i}" for i in issues]
    full = "\n\n".join(done)
    src_title = (src.unit_title_en if src_lang == "en" else src.unit_title_ar) or src.unit_title_en or src.unit_title_ar or ""
    title = ""
    if src_title.strip():
        try:
            title = (await llm.call_text(system, src_title.strip(), temperature=0.1)).strip().splitlines()[0][:200]
        except Exception:  # noqa: BLE001
            flags.append("the title could not be translated")
    fields = dict(
        full_text=full, content_hash_md5=_hash(full), language=target, translated_from=src_lang, translation_source_hash=_hash(src.full_text),
        translation_flags=flags, translation_status="needs_review" if flags else "ai_checked", translated_at=_now(), reviewed_by=None, reviewed_at=None,
        total_pages=src.total_pages, pages=[], updated_at=_now(),
    )
    if target == "ar":
        fields["unit_title_ar"] = title or (existing.unit_title_ar if existing else None)
        fields["unit_title_en"] = src.unit_title_en
    else:
        fields["unit_title_en"] = title or (existing.unit_title_en if existing else None)
        fields["unit_title_ar"] = src.unit_title_ar
    previous = existing.full_text if existing else None
    if existing is not None:
        for k, v in fields.items():
            setattr(existing, k, v)
        await existing.save()
        unit = existing
    else:
        unit = CurriculumUnit(school_id=school_id if school_id is not None else src.school_id, grade=src.grade, subject=src.subject, unit_number=src.unit_number, **fields)
        await unit.insert()
    return {"action": "translated", "flags": flags, "unit_id": str(unit.id), "previous_text": previous, "status": unit.translation_status}


# ------------------------------------------------------------------ putting a language into the syllabi

async def apply_to_syllabi(school_id: str, unit: CurriculumUnit, previous_text: str | None) -> int:
    """Write this unit's text (in its language) into the school's syllabus chapters for the same class, subject and chapter.
    A chapter's text is only replaced when it is empty or is still the earlier machine translation, so a teacher's edits stay."""
    from app.models.academic import Class, Subject
    from app.models.syllabus import Chapter, ChapterText, Syllabus
    from app.services.academic_keys import class_key
    from app.services.syllabus_import_service import clean_extracted_text, clean_unit_title

    lang = detect_language(unit.full_text, unit.language)
    new_text = clean_extracted_text(unit.full_text or "")
    old_text = clean_extracted_text(previous_text or "") if previous_text else None
    classes = {str(c.id) for c in await Class.find({"school_id": school_id}).to_list() if class_key(c.name) == str(unit.grade)}
    subjects = {str(s.id) for s in await Subject.find({"school_id": school_id}).to_list() if subject_key(s.name, s.code) == subject_key(unit.subject)}
    names = {normalize_text(x) for x in (unit.unit_title_en, clean_unit_title(unit.unit_title_ar)) if x}
    touched = 0
    for syl in await Syllabus.find({"school_id": school_id}).to_list():
        if syl.class_id not in classes or syl.subject_id not in subjects:
            continue
        changed = False
        for ch in syl.chapters:
            ar_name = (ch.translations.get("ar") or ChapterText()).name
            if not ({normalize_text(ch.name), normalize_text(ar_name or "")} & names):
                continue
            if lang == "ar":
                t = ch.translations.get("ar") or ChapterText()
                if not (t.content or "").strip() or (old_text and t.content.strip() == old_text.strip()):
                    t.content = new_text
                    if unit.unit_title_ar and not t.name:
                        t.name = clean_unit_title(unit.unit_title_ar)
                    ch.translations["ar"] = t
                    changed = True
            elif not (ch.content or "").strip() or (old_text and (ch.content or "").strip() == old_text.strip()):
                ch.content = new_text
                changed = True
        if changed:
            syl.updated_at = _now()
            await syl.save()
            touched += 1
    return touched


async def overview(school_id: str | None, grade: int | None = None) -> dict:
    """Per grade (1-12) the units in the library and which languages each has, with each translation's status."""
    from app.services.curriculum_service import group_by_unit, load_units, titles

    units = await load_units(school_id, grade)
    groups = group_by_unit(units)
    per_grade = {g: 0 for g in GRADES}
    rows = []
    for (g, skey, number), group in groups.items():
        per_grade[g] = per_grade.get(g, 0) + 1
        en, ar = titles(group)
        langs = {}
        for lang in ("en", "ar"):
            u = group.get(lang)
            langs[lang] = None if u is None else {
                "id": str(u.id), "chars": len(u.full_text or ""), "source": "translation" if u.translated_from else "original",
                "status": u.translation_status or "original", "flags": u.translation_flags or [],
            }
        rows.append({"grade": g, "subject": next(iter(group.values())).subject, "subject_key": skey, "unit_number": number, "title_en": en, "title_ar": ar, "languages": langs})
    return {"grades": [{"grade": g, "units": per_grade.get(g, 0)} for g in GRADES], "units": rows}


# ------------------------------------------------------------------ translation jobs (a grade can take minutes)

async def start_job(school_id: str | None, user_id: str, *, grade: int | None, subject: str | None, unit_number: int | None, target: str, force: bool):
    from app.models.translation_job import TranslationJob

    job = TranslationJob(school_id=school_id, created_by=user_id, grade=grade, subject=subject, unit_number=unit_number, target=target, force=force)
    await job.insert()
    return job


async def run_job(job_id: str) -> None:
    """Translate every unit in scope that lacks the target language. Progress and per-unit outcomes are kept on the job."""
    from app.models.tenant import Tenant
    from app.models.translation_job import TranslationJob
    from app.services.curriculum_service import group_by_unit, load_units, titles

    job = await TranslationJob.get(job_id)
    if job is None:
        return
    try:
        job.status = "running"
        await job.save()
        groups = group_by_unit(await load_units(job.school_id, job.grade, job.subject))
        targets = ["ar", "en"] if job.target == "both" else [job.target]
        work = [(key, g, t) for key, g in groups.items() for t in targets
                if (job.unit_number is None or key[2] == job.unit_number) and other_lang(t) in g]
        job.total = len(work)
        await job.save()
        glossary: dict[tuple[int, str], list[tuple[str, str]]] = {}
        for (grade, skey, _n), g in groups.items():
            en, ar = titles(g)
            if en and ar:
                glossary.setdefault((grade, skey), []).append((en, ar))
        schools = [job.school_id] if job.school_id else [str(t.id) for t in await Tenant.find_all().to_list()]
        for (grade, skey, number), group, target in work:
            label = f"Grade {grade} {next(iter(group.values())).subject} unit {number} -> {target}"
            try:
                res = await translate_group(group, target, job.school_id, force=job.force, glossary=glossary.get((grade, skey), []))
                if res["action"] == "translated":
                    unit = await CurriculumUnit.get(res["unit_id"])
                    for sid in schools:
                        await apply_to_syllabi(sid, unit, res.get("previous_text"))
                    job.translated += 1
                    job.messages.append(f"{label}: translated" + (f" ({len(res['flags'])} thing(s) to review)" if res["flags"] else " (checks passed)"))
                else:
                    job.skipped += 1
                    job.messages.append(f"{label}: skipped ({res['reason']})")
            except Exception as exc:  # noqa: BLE001 - one unit must not stop the rest
                logger.exception("Translation failed for %s", label)
                job.failed += 1
                job.messages.append(f"{label}: FAILED ({type(exc).__name__}: {str(exc)[:120]})")
            job.messages = job.messages[-200:]
            await job.save()
        job.status = "done"
    except Exception as exc:  # noqa: BLE001
        logger.exception("Translation job failed")
        job.status = "failed"
        job.messages.append(f"Job failed: {type(exc).__name__}: {str(exc)[:200]}")
    job.finished_at = _now()
    await job.save()
