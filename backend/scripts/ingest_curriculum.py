"""
Ingest curriculum NDJSON file into MongoDB.

Usage:
    python -m scripts.ingest_curriculum <ndjson_file> [--school-id <id>]

Example:
    python -m scripts.ingest_curriculum cls6_all_units_mongodb.ndjson
    python -m scripts.ingest_curriculum cls6_all_units_mongodb.ndjson --school-id demo-school
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import get_settings
from app.models.curriculum import CurriculumUnit, PageContent, CurriculumMetadata

settings = get_settings()


async def init_db():
    client = AsyncIOMotorClient(settings.mongodb_uri)
    await init_beanie(
        database=client[settings.mongodb_db_name],
        document_models=[CurriculumUnit]
    )
    return client


async def ingest_ndjson(file_path: str, school_id: str | None = None):
    """Ingest an NDJSON / JSON curriculum file (any grade 1-12, either language) into MongoDB."""
    from app.services import curriculum_library as lib

    path = Path(file_path)
    if not path.exists():
        print(f"Error: File not found: {file_path}")
        return

    client = await init_db()
    try:
        records, problems = lib.parse_records(path.name, path.read_bytes())
        report = await lib.ingest_records(records, school_id)
        for p in [*problems, *report["problems"]]:
            print(f"  Problem: {p}")
        print(f"\n{'='*50}\nINGESTION COMPLETE\n{'='*50}")
        print(f"Inserted: {report['inserted']}   Updated: {report['updated']}   Unchanged: {report['unchanged']}   Skipped: {report['skipped']}")
        print(f"Grades: {report['grades']}   Languages (detected): {report['languages']}")
    finally:
        client.close()


async def main():
    parser = argparse.ArgumentParser(description="Ingest curriculum NDJSON/JSON")
    parser.add_argument("file", help="Path to the NDJSON or JSON file")
    parser.add_argument("--school-id", default=None, help="Optional school id (default: shared by every school)")
    args = parser.parse_args()
    await ingest_ndjson(args.file, args.school_id)


if __name__ == "__main__":
    asyncio.run(main())
