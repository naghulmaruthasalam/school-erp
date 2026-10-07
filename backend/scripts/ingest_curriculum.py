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
    """Ingest NDJSON curriculum file into MongoDB."""

    path = Path(file_path)
    if not path.exists():
        print(f"Error: File not found: {file_path}")
        return

    client = await init_db()

    try:
        inserted = 0
        updated = 0
        errors = 0

        with open(path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue

                try:
                    data = json.loads(line)

                    grade = data.get("class", data.get("grade", 0))
                    subject = data.get("subject", "")
                    unit_number = data.get("unit_number", 0)

                    from app.services.academic_keys import detect_language

                    language = detect_language(data.get("full_text"), data.get("language"))  # the text decides, not the file label
                    # A unit exists once per language. Matching on grade/subject/unit alone made the English record
                    # overwrite the Arabic one (or the reverse), leaving a mix of languages in the database.
                    existing = await CurriculumUnit.find_one(
                        CurriculumUnit.grade == grade,
                        CurriculumUnit.subject == subject,
                        CurriculumUnit.unit_number == unit_number,
                        CurriculumUnit.language == language,
                    )

                    pages = [
                        PageContent(page_number=p["page_number"], text=p["text"])
                        for p in data.get("pages", [])
                    ]

                    meta_data = data.get("metadata", {})
                    metadata = CurriculumMetadata(
                        curriculum=meta_data.get("curriculum"),
                        semester=meta_data.get("semester"),
                        grade_level=meta_data.get("grade_level"),
                        content_type=meta_data.get("content_type"),
                    ) if meta_data else None

                    if existing:
                        existing.school_id = school_id
                        existing.language = language
                        existing.unit_title_ar = data.get("unit_title_ar")
                        existing.unit_title_en = data.get("unit_title_en")
                        existing.source_zip = data.get("source_zip")
                        existing.source_file = data.get("source_file")
                        existing.total_pages = data.get("total_pages", 0)
                        existing.file_size_bytes = data.get("file_size_bytes", 0)
                        existing.content_hash_md5 = data.get("content_hash_md5")
                        existing.full_text = data.get("full_text", "")
                        existing.pages = pages
                        existing.metadata = metadata
                        await existing.save()
                        updated += 1
                        print(f"  Updated: Grade {grade} - {subject} - Unit {unit_number}")
                    else:
                        unit = CurriculumUnit(
                            school_id=school_id,
                            grade=grade,
                            subject=subject,
                            language=language,
                            unit_number=unit_number,
                            unit_title_ar=data.get("unit_title_ar"),
                            unit_title_en=data.get("unit_title_en"),
                            source_zip=data.get("source_zip"),
                            source_file=data.get("source_file"),
                            total_pages=data.get("total_pages", 0),
                            file_size_bytes=data.get("file_size_bytes", 0),
                            content_hash_md5=data.get("content_hash_md5"),
                            full_text=data.get("full_text", ""),
                            pages=pages,
                            metadata=metadata,
                        )
                        await unit.insert()
                        inserted += 1
                        print(f"  Inserted: Grade {grade} - {subject} - Unit {unit_number}")

                except json.JSONDecodeError as e:
                    print(f"  Error line {line_num}: Invalid JSON - {e}")
                    errors += 1
                except Exception as e:
                    print(f"  Error line {line_num}: {e}")
                    errors += 1

        print(f"\n{'='*50}")
        print(f"INGESTION COMPLETE")
        print(f"{'='*50}")
        print(f"Inserted: {inserted}")
        print(f"Updated:  {updated}")
        print(f"Errors:   {errors}")
        print(f"{'='*50}\n")

    finally:
        client.close()


def main():
    parser = argparse.ArgumentParser(description="Ingest curriculum NDJSON into MongoDB")
    parser.add_argument("file", help="Path to NDJSON file")
    parser.add_argument("--school-id", help="Optional school ID to associate with content")

    args = parser.parse_args()
    asyncio.run(ingest_ndjson(args.file, args.school_id))


if __name__ == "__main__":
    main()
