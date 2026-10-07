"""Read-only report: why does (or doesn't) a student see textbook content, notes and videos?

Usage (from backend/):    python -m scripts.diagnose_content
Prints, per school: its classes and subjects, its syllabi (chapters, notes, videos), the textbook units in the database
(language, school stamp), and what the textbook sync would do right now (dry run, with its problems).
Send the whole output when something is missing.
"""
import asyncio
from collections import Counter

from app.core.database import close_db, init_db
from app.models.academic import AcademicYear, Class, Subject
from app.models.curriculum import CurriculumUnit
from app.models.syllabus import Syllabus
from app.models.tenant import Tenant
from app.services.curriculum_service import load_units, sync_to_syllabus, unit_language


async def main() -> None:
    await init_db()
    try:
        units = await CurriculumUnit.find_all().to_list()
        print(f"Textbook units in the database: {len(units)}")
        for k, n in sorted(Counter((u.grade, u.subject, unit_language(u), u.language, u.school_id) for u in units).items(), key=str):
            print(f"   grade {k[0]} | {k[1]} | text is {k[2]} (label {k[3]}) | stamped school: {k[4]} | {n} units")
        tenants = await Tenant.find_all().to_list()
        print(f"\nSchools: {len(tenants)}")
        for t in tenants:
            sid = str(t.id)
            print(f"\n=== {t.name} (code {t.code}, id {sid})")
            years = await AcademicYear.find(AcademicYear.school_id == sid).to_list()
            print("   academic years:", [(y.name, y.is_current) for y in years] or "NONE (the sync needs one)")
            classes = await Class.find(Class.school_id == sid).to_list()
            subjects = await Subject.find(Subject.school_id == sid).to_list()
            print("   classes:", sorted(c.name for c in classes))
            print("   subjects:", sorted(s.name for s in subjects))
            vis = await load_units(sid)
            print(f"   textbook units visible to this school: {len(vis)}")
            cn = {str(c.id): c.name for c in classes}
            sn = {str(s.id): s.name for s in subjects}
            for syl in await Syllabus.find(Syllabus.school_id == sid).to_list():
                notes = sum(1 for c in syl.chapters if (c.content or "").strip() or any((x.content or "").strip() for x in c.translations.values()))
                videos = sum(1 for c in syl.chapters if c.video_s3_key or c.video_url or any(x.video_s3_key or x.video_url for x in c.translations.values()))
                print(f"   syllabus {cn.get(syl.class_id, '?')} / {sn.get(syl.subject_id, '?')} [{syl.status}]: {len(syl.chapters)} chapters, {notes} with notes, {videos} with video")
            try:
                rep = await sync_to_syllabus(sid, "diagnose", dry_run=True, create_missing=True)
                print("   sync would do:", rep.get("totals"), "| problems:", rep.get("problems") or "none")
            except Exception as exc:  # noqa: BLE001
                print(f"   sync would FAIL: {type(exc).__name__}: {exc}")
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
