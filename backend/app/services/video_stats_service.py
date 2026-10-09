"""Video views: a view is counted when a student plays a chapter video to its end.

Students record their own views; teachers see the counts and who watched for the classes they teach; the principal and
school admins see every class. Counts are kept per video language, because each language has its own video file."""
import re
from collections import defaultdict
from datetime import timedelta

from app.core.deps import CurrentUser
from app.core.enums import ADMIN_ROLES, Role, StudentStatus
from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationAppError
from app.models.academic import Class, Subject
from app.models.base import utcnow
from app.models.student import Student
from app.models.syllabus import Chapter, Syllabus
from app.models.video_watch import VideoWatch
from app.services.academic_keys import equivalent_class_ids

LANGS = ("en", "ar")
_MIN_GAP = timedelta(seconds=10)  # a second "ended" report inside this window is a duplicate, not another watch


_EMBEDDED = re.compile(r"youtube\.com|youtu\.be|vimeo\.com", re.I)


def _has_video(ch: Chapter, lang: str) -> bool:
    """A video that can be counted: an uploaded file, or a direct video link. YouTube / Vimeo embeds can't report that
    they ended, so they are left out."""
    loc = ch.localized(lang)
    if loc.video_language != lang:
        return False
    return bool(loc.video_s3_key) or (bool(loc.video_url) and not _EMBEDDED.search(loc.video_url))


async def _syllabus_for(current: CurrentUser, syllabus_id: str) -> Syllabus:
    from app.services import syllabus_service as svc

    syllabus = await svc._get_syllabus_or_404(current, syllabus_id)  # noqa: SLF001
    await svc._check_syllabus_read_access(current, syllabus)  # noqa: SLF001
    return syllabus


def _chapter(syllabus: Syllabus, index: int) -> Chapter:
    if not 0 <= index < len(syllabus.chapters):
        raise NotFoundError("Chapter not found")
    return syllabus.chapters[index]


async def record_view(current: CurrentUser, syllabus_id: str, index: int, language: str) -> dict:
    """A student's video played to the end. Only students are counted; anyone else gets recorded=False."""
    if current.role != Role.STUDENT:
        return {"recorded": False, "reason": "only students' views are counted"}
    if language not in LANGS:
        raise ValidationAppError("Unknown language")
    syllabus = await _syllabus_for(current, syllabus_id)
    chapter = _chapter(syllabus, index)
    if not _has_video(chapter, language):
        raise ValidationAppError("This chapter has no video in that language")
    student_id = str(current.user.student_id)
    now = utcnow()
    doc = await VideoWatch.find_one({"school_id": current.school_id, "student_id": student_id,
                                     "syllabus_id": syllabus_id, "chapter_key": chapter.name, "language": language})
    if doc is None:
        await VideoWatch(school_id=current.school_id, syllabus_id=syllabus_id, chapter_key=chapter.name, language=language,
                         student_id=student_id, views=1, first_at=now, last_at=now).insert()
        return {"recorded": True, "views": 1}
    last = doc.last_at if doc.last_at.tzinfo else doc.last_at.replace(tzinfo=now.tzinfo)
    if now - last < _MIN_GAP:
        return {"recorded": False, "views": doc.views, "reason": "duplicate"}
    doc.views += 1
    doc.last_at = now
    await doc.save()
    return {"recorded": True, "views": doc.views}


async def watched_by_student(current: CurrentUser, syllabus_ids: list[str]) -> dict[tuple[str, str], set[str]]:
    """{(syllabus_id, chapter_key): languages this student has watched}. Empty for anyone but a student."""
    if current.role != Role.STUDENT or not current.user.student_id or not syllabus_ids:
        return {}
    docs = await VideoWatch.find({"school_id": current.school_id, "student_id": str(current.user.student_id),
                                  "syllabus_id": {"$in": syllabus_ids}}).to_list()
    out: dict[tuple[str, str], set[str]] = defaultdict(set)
    for d in docs:
        out[(d.syllabus_id, d.chapter_key)].add(d.language)
    return out


async def _may_see_stats(current: CurrentUser, syllabus: Syllabus) -> None:
    if current.role in ADMIN_ROLES:
        return
    if current.role == Role.TEACHER:
        from app.copilot.grounding import allowed_class_ids

        mine, _ = await allowed_class_ids(current)
        allowed: set[str] = set()
        for cid in mine or set():
            allowed.update(await equivalent_class_ids(current.school_id, cid))
        if syllabus.class_id in allowed:
            return
        raise PermissionDeniedError("You do not teach this class")
    raise PermissionDeniedError("Only teachers and school leaders can see video views")


async def _roster(school_id: str, class_id: str) -> list[Student]:
    ids = await equivalent_class_ids(school_id, class_id)
    return await Student.find({"school_id": school_id, "class_id": {"$in": ids}, "status": StudentStatus.ACTIVE.value}).to_list()


async def chapter_stats(current: CurrentUser, syllabus_id: str, index: int) -> dict:
    """Views and unique students per language for one chapter, and who has and hasn't watched."""
    syllabus = await _syllabus_for(current, syllabus_id)
    await _may_see_stats(current, syllabus)
    chapter = _chapter(syllabus, index)
    docs = await VideoWatch.find({"school_id": current.school_id, "syllabus_id": syllabus_id, "chapter_key": chapter.name}).to_list()
    roster = await _roster(current.school_id, syllabus.class_id)
    names = {str(s.id): s.full_name for s in roster}
    languages = {}
    for lang in LANGS:
        mine = [d for d in docs if d.language == lang]
        languages[lang] = {"has_video": _has_video(chapter, lang), "views": sum(d.views for d in mine), "students": len({d.student_id for d in mine})}
    per_student: dict[str, dict] = {}
    for d in docs:
        row = per_student.setdefault(d.student_id, {"id": d.student_id, "name": names.get(d.student_id, "—"), "views": {l: 0 for l in LANGS}, "last_at": d.last_at})
        row["views"][d.language] = d.views
        if d.last_at > row["last_at"]:
            row["last_at"] = d.last_at
    watched_ids = set(per_student)
    return {
        "chapter": chapter.name, "class_size": len(roster), "languages": languages,
        "watched": sorted(per_student.values(), key=lambda r: r["name"].lower()),
        "not_watched": sorted(({"id": sid, "name": n} for sid, n in names.items() if sid not in watched_ids), key=lambda r: r["name"].lower()),
    }


async def school_report(current: CurrentUser) -> dict:
    """Every chapter video in the school: views, unique students and how much of the class has watched it (principal and admins)."""
    if current.role not in ADMIN_ROLES:
        raise PermissionDeniedError("Only the principal and school admins can see the school-wide report")
    syllabi = await Syllabus.find(Syllabus.school_id == current.school_id).to_list()
    watches = await VideoWatch.find(VideoWatch.school_id == current.school_id).to_list()
    by_key: dict[tuple[str, str, str], list[VideoWatch]] = defaultdict(list)
    for w in watches:
        by_key[(w.syllabus_id, w.chapter_key, w.language)].append(w)
    classes = {str(c.id): c.name for c in await Class.find(Class.school_id == current.school_id).to_list()}
    subjects = {str(s.id): s.name for s in await Subject.find(Subject.school_id == current.school_id).to_list()}
    sizes: dict[str, int] = {}
    rows = []
    for syl in syllabi:
        for ch in syl.chapters:
            for lang in LANGS:
                if not _has_video(ch, lang):
                    continue
                if syl.class_id not in sizes:
                    sizes[syl.class_id] = len(await _roster(current.school_id, syl.class_id))
                mine = by_key.get((str(syl.id), ch.name, lang), [])
                students = len({w.student_id for w in mine})
                size = sizes[syl.class_id]
                rows.append({
                    "syllabus_id": str(syl.id), "class": classes.get(syl.class_id, "—"), "subject": subjects.get(syl.subject_id, "—"),
                    "chapter": ch.localized(lang).name if lang == "ar" and ch.translations.get("ar") else ch.name, "language": lang,
                    "views": sum(w.views for w in mine), "students": students, "class_size": size,
                    "percent": round(100 * students / size) if size else 0,
                })
    rows.sort(key=lambda r: (r["class"], r["subject"], r["chapter"], r["language"]))
    return {"rows": rows, "total_views": sum(r["views"] for r in rows)}
