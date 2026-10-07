import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from app.core.config import get_settings

async def fix():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.mongodb_db_name]

    # Get Priya's student record
    user = await db.users.find_one({"full_name": "Priya Sharma"})
    if user:
        student = await db.students.find_one({"_id": ObjectId(user["student_id"])})
        priya_class = student["class_id"] if student else "N/A"
        priya_school = user["school_id"]
        print(f"Priya class_id: {priya_class}")
        print(f"Priya school_id: {priya_school}")

    # Check syllabus
    print("\n=== Current Syllabi ===")
    syllabi = await db.syllabus.find().to_list(5)
    for s in syllabi:
        print(f"Syllabus: {s['title']} | school: {s['school_id']} | class: {s['class_id']}")

    # If class_id doesn't match, update syllabus to match Priya's class
    if student and syllabi:
        if syllabi[0]["class_id"] != priya_class:
            print(f"\nMismatch! Updating syllabus class_id from {syllabi[0]['class_id']} to {priya_class}")
            await db.syllabus.update_many({}, {"$set": {"class_id": priya_class}})
            print("Updated!")
        else:
            print("\nClass IDs match!")

    # Update school name to Capital Private School
    print("\n=== Updating School Info ===")
    result = await db.tenants.update_one(
        {"_id": ObjectId(priya_school)},
        {"$set": {
            "name": "Capital Private School",
            "name_ar": "مدرسة العاصمة الخاصة",
            "address": "Al Maha St, Muscat, Oman",
            "phone": "+968 9980 1655",
        }}
    )
    print(f"Updated tenant: {result.modified_count}")

    client.close()

asyncio.run(fix())
