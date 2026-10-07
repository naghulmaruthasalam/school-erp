"""Load a curriculum file (CSV or JSON) into a school's syllabus.

Usage (from backend/):
    python -m scripts.import_syllabus <school_id> <file.csv|file.json> [--apply] [--create-missing] [--replace]

Without --apply it only prints what would change. Format: GET /api/v1/syllabus/import/template or see
app/services/syllabus_import_service.py.
"""
import argparse
import asyncio
import json
from pathlib import Path

from app.core.database import close_db, init_db
from app.core.enums import Role
from app.models.user import User
from app.services.syllabus_import_service import run_import


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("school_id")
    ap.add_argument("file")
    ap.add_argument("--apply", action="store_true", help="write to the database (default: preview only)")
    ap.add_argument("--create-missing", action="store_true", help="create classes and subjects that don't exist yet")
    ap.add_argument("--replace", action="store_true", help="the file becomes the whole chapter list of each syllabus")
    args = ap.parse_args()

    await init_db()
    try:
        admin = await User.find_one(User.school_id == args.school_id, User.role == Role.SCHOOL_ADMIN)
        path = Path(args.file)
        report = await run_import(
            args.school_id, str(admin.id) if admin else "import-script", path.name, path.read_bytes(),
            dry_run=not args.apply, create_missing=args.create_missing, mode="replace" if args.replace else "merge",
        )
        print(json.dumps(report, indent=2, ensure_ascii=False))
        if not args.apply:
            print("\nPreview only. Re-run with --apply to write.")
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
