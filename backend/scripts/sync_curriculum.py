"""Load the textbook library (curriculum_units, both languages) into a school's syllabus.

Usage (from backend/):
    python -m scripts.sync_curriculum <school_id> [--apply] [--create-missing]

Without --apply it only prints what would change. Library units are matched to the school's classes and subjects by grade
number and canonical subject name ("Class 6" = "Grade 6" = "الصف السادس"; "Social Studies" = "Social Science").
Run scripts.ingest_curriculum first to fill the library.
"""
import argparse
import asyncio
import json

from app.core.database import close_db, init_db
from app.core.enums import Role
from app.models.user import User
from app.services.curriculum_service import sync_to_syllabus


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("school_id")
    ap.add_argument("--apply", action="store_true", help="write to the database (default: preview only)")
    ap.add_argument("--create-missing", action="store_true", help="create classes and subjects the school doesn't have yet")
    args = ap.parse_args()
    await init_db()
    try:
        admin = await User.find_one(User.school_id == args.school_id, User.role == Role.SCHOOL_ADMIN)
        report = await sync_to_syllabus(
            args.school_id, str(admin.id) if admin else "sync-script", dry_run=not args.apply, create_missing=args.create_missing,
        )
        print(json.dumps(report, indent=2, ensure_ascii=False))
        if not args.apply:
            print("\nPreview only. Re-run with --apply to write.")
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
