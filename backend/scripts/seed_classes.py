"""
Seed script to create classes (LKG to 12th) with sections (A-D).
Run this after creating an academic year.

Usage:
    python -m scripts.seed_classes <school_id> <academic_year_id>
"""
import asyncio
import sys
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from app.models.academic import AcademicYear, Class, Section
from app.core.config import settings

# Class names from LKG to 12th standard
CLASS_NAMES = [
    ("LKG", 1),
    ("UKG", 2),
    ("Class 1", 3),
    ("Class 2", 4),
    ("Class 3", 5),
    ("Class 4", 6),
    ("Class 5", 7),
    ("Class 6", 8),
    ("Class 7", 9),
    ("Class 8", 10),
    ("Class 9", 11),
    ("Class 10", 12),
    ("Class 11", 13),
    ("Class 12", 14),
]

# Sections for each class
SECTIONS = ["A", "B", "C", "D"]


async def seed_classes_and_sections(school_id: str, academic_year_id: str):
    """Create all classes and sections for a school."""

    # Verify academic year exists
    year = await AcademicYear.find_one(
        AcademicYear.school_id == school_id,
        AcademicYear.id == academic_year_id
    )
    if not year:
        print(f"Error: Academic year {academic_year_id} not found for school {school_id}")
        return

    print(f"Creating classes for academic year: {year.name}")

    created_classes = 0
    created_sections = 0

    for class_name, order in CLASS_NAMES:
        # Check if class already exists
        existing_class = await Class.find_one(
            Class.school_id == school_id,
            Class.academic_year_id == academic_year_id,
            Class.name == class_name
        )

        if existing_class:
            print(f"  Class '{class_name}' already exists, skipping...")
            cls = existing_class
        else:
            cls = Class(
                school_id=school_id,
                academic_year_id=academic_year_id,
                name=class_name,
                order=order
            )
            await cls.insert()
            created_classes += 1
            print(f"  Created class: {class_name}")

        # Create sections for this class
        for section_name in SECTIONS:
            existing_section = await Section.find_one(
                Section.school_id == school_id,
                Section.class_id == str(cls.id),
                Section.name == section_name
            )

            if existing_section:
                print(f"    Section '{section_name}' already exists, skipping...")
            else:
                section = Section(
                    school_id=school_id,
                    class_id=str(cls.id),
                    name=section_name
                )
                await section.insert()
                created_sections += 1
                print(f"    Created section: {class_name} - {section_name}")

    print(f"\nDone! Created {created_classes} classes and {created_sections} sections.")


async def main():
    if len(sys.argv) != 3:
        print("Usage: python -m scripts.seed_classes <school_id> <academic_year_id>")
        print("\nExample: python -m scripts.seed_classes abc123 def456")
        sys.exit(1)

    school_id = sys.argv[1]
    academic_year_id = sys.argv[2]

    # Connect to MongoDB
    client = AsyncIOMotorClient(settings.MONGO_URL)
    db = client[settings.MONGO_DB]

    await init_beanie(
        database=db,
        document_models=[AcademicYear, Class, Section]
    )

    await seed_classes_and_sections(school_id, academic_year_id)

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
