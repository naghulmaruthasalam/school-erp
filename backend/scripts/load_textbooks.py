"""Load the textbook file (NDJSON) into the database and copy it into every school's syllabus, in one step.

Usage (from backend/):
    python -m scripts.load_textbooks cls6_all_units_mongodb.ndjson

1. The units are stored once for all schools, one record per language.
2. For every school: classes it has (by grade number, "Class 6" = "Grade 6") get a syllabus per subject; subjects the school
   lacks (e.g. Social Studies) are created; a syllabus that has chapter names but no notes gets the textbook chapters and notes.
It prints what it did per school, and every problem it hit (nothing is hidden). Safe to re-run.
"""
import argparse
import asyncio
import json

from app.core.database import close_db, init_db
from app.services.curriculum_service import sync_all_schools
from scripts.ingest_curriculum import ingest_ndjson


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file")
    args = ap.parse_args()
    await ingest_ndjson(args.file, None)  # shared by every school
    await init_db()
    try:
        for rep in await sync_all_schools(create_missing=True, only_missing=False):
            print("\n== " + rep["school"])
            print("   totals:", json.dumps(rep.get("totals", {})))
            for s in rep.get("syllabi", []):
                print(f"   {s['class']} / {s['subject']}: {s['action']}, chapters +{s['chapters_added']} ~{s['chapters_updated']}")
            for p in rep.get("problems", []):
                print("   PROBLEM:", p)
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
