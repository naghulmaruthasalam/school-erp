"""
Upload a video to curriculum unit.

Usage:
    python -m scripts.upload_curriculum_video <video_file> --grade 6 --subject "Social Science" --unit 1 --title "Chapter Title"
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import get_settings
from app.core.s3 import upload_bytes, build_object_key
from app.core.enums import DocumentModule
from app.models.curriculum import CurriculumUnit, CurriculumResource
from app.models.document import Document

settings = get_settings()


async def init_db():
    client = AsyncIOMotorClient(settings.mongodb_uri)
    await init_beanie(
        database=client[settings.mongodb_db_name],
        document_models=[CurriculumUnit, Document]
    )
    return client


async def upload_video(
    video_path: str,
    grade: int,
    subject: str,
    unit_number: int,
    title: str,
    description: str | None = None,
):
    path = Path(video_path)
    if not path.exists():
        print(f"Error: File not found: {video_path}")
        return

    client = await init_db()

    try:
        unit = await CurriculumUnit.find_one(
            CurriculumUnit.grade == grade,
            CurriculumUnit.subject == subject,
            CurriculumUnit.unit_number == unit_number,
        )

        if not unit:
            print(f"Creating new unit: Grade {grade} - {subject} - Unit {unit_number}")
            unit = CurriculumUnit(
                grade=grade,
                subject=subject,
                unit_number=unit_number,
                unit_title_en=title,
            )
            await unit.insert()

        print(f"Reading video file: {path.name} ({path.stat().st_size / 1024 / 1024:.1f} MB)")
        video_bytes = path.read_bytes()

        content_type = "video/mp4"
        if path.suffix.lower() == ".webm":
            content_type = "video/webm"
        elif path.suffix.lower() == ".mov":
            content_type = "video/quicktime"

        object_key = build_object_key("curriculum", DocumentModule.OTHER, path.name)

        print(f"Uploading to storage...")
        upload_bytes(object_key, video_bytes, content_type)

        doc = Document(
            school_id=None,
            module=DocumentModule.OTHER,
            object_key=object_key,
            content_type=content_type,
            size_bytes=len(video_bytes),
            original_filename=path.name,
            uploaded_by="system",
            linked_entity_type="curriculum",
            linked_entity_id=str(unit.id),
        )
        await doc.insert()

        resource = CurriculumResource(
            resource_type="video",
            title=title,
            description=description or f"Video for {subject} Grade {grade} Chapter {unit_number}",
            document_id=str(doc.id),
            file_size_bytes=len(video_bytes),
        )

        unit.resources.append(resource)
        await unit.save()

        print(f"\n{'='*50}")
        print("VIDEO UPLOADED SUCCESSFULLY")
        print(f"{'='*50}")
        print(f"Unit ID: {unit.id}")
        print(f"Document ID: {doc.id}")
        print(f"Grade: {grade}")
        print(f"Subject: {subject}")
        print(f"Chapter: {unit_number}")
        print(f"Title: {title}")
        print(f"{'='*50}\n")

    finally:
        client.close()


def main():
    parser = argparse.ArgumentParser(description="Upload video to curriculum unit")
    parser.add_argument("file", help="Path to video file")
    parser.add_argument("--grade", type=int, required=True, help="Grade number")
    parser.add_argument("--subject", required=True, help="Subject name")
    parser.add_argument("--unit", type=int, required=True, help="Unit/chapter number")
    parser.add_argument("--title", required=True, help="Video title")
    parser.add_argument("--description", help="Optional description")

    args = parser.parse_args()
    asyncio.run(upload_video(
        args.file, args.grade, args.subject, args.unit, args.title, args.description
    ))


if __name__ == "__main__":
    main()
