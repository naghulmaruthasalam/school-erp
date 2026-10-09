"""Translate textbook units that exist in only one language into the other (checked, stored flagged for review).

Usage (from backend/):
    python -m scripts.translate_curriculum --grade 3 --target ar
    python -m scripts.translate_curriculum --target both --school-id <id> [--subject Science] [--unit 2] [--force]
"""
import argparse
import asyncio

from app.core.database import close_db, init_db
from app.services import curriculum_library as lib


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--grade", type=int, choices=range(1, 13))
    ap.add_argument("--subject")
    ap.add_argument("--unit", type=int)
    ap.add_argument("--target", choices=["ar", "en", "both"], default="both")
    ap.add_argument("--school-id", default=None, help="apply the translations to this school's syllabus (default: every school)")
    ap.add_argument("--force", action="store_true", help="redo translations that are up to date or reviewed")
    a = ap.parse_args()
    await init_db()
    job = await lib.start_job(a.school_id, "script", grade=a.grade, subject=a.subject, unit_number=a.unit, target=a.target, force=a.force)
    await lib.run_job(str(job.id))
    from app.models.translation_job import TranslationJob

    job = await TranslationJob.get(job.id)
    print(f"{job.status}: translated {job.translated}, skipped {job.skipped}, failed {job.failed} of {job.total}")
    for m in job.messages:
        print("  " + m)
    await close_db()


if __name__ == "__main__":
    asyncio.run(main())
