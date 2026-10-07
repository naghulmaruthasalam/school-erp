import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from app.core.config import get_settings

async def check():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.mongodb_db_name]

    demo_school = "6ac499a90a88718fd65eb1f3"
    syllabus_class_id = "6ac510d27a6a0c7780d20f67"

    # Query syllabi like the API does
    print("=== Direct syllabus query (no filters) ===")
    syllabi = await db.syllabus.find({"school_id": demo_school}).to_list(10)
    print(f"Found {len(syllabi)} syllabi")
    for s in syllabi:
        print(f"  {s['title']} | class_id: {s['class_id']}")

    # Query with class_id filter
    print(f"\n=== Query with class_id={syllabus_class_id} ===")
    syllabi = await db.syllabus.find({"school_id": demo_school, "class_id": syllabus_class_id}).to_list(10)
    print(f"Found {len(syllabi)} syllabi")

    # Delete duplicate Class 6 entries (keep only one)
    print("\n=== Deleting duplicate Class 6 entries ===")
    dup1 = await db.classes.delete_one({"_id": ObjectId("6ac5619c164f6d02a2500c95")})
    dup2 = await db.classes.delete_one({"_id": ObjectId("6ac561e189263d0bb639a811")})
    print(f"Deleted {dup1.deleted_count + dup2.deleted_count} duplicate classes")

    print("\n=== Classes after cleanup ===")
    classes = await db.classes.find({"school_id": demo_school}).to_list(20)
    for c in classes:
        print(f"  {c.get('name')} | ID: {c['_id']}")

    client.close()

asyncio.run(check())
