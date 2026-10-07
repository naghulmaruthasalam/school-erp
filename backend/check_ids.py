import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from app.core.config import get_settings

async def check():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri)
    db = client[settings.mongodb_db_name]

    # Check Priya Sharma
    user = await db.users.find_one({"full_name": {"$regex": "Priya", "$options": "i"}})
    if user:
        print(f"User: {user.get('full_name')} | student_id: {user.get('student_id')} | school_id: {user.get('school_id')}")
        if user.get("student_id"):
            student = await db.students.find_one({"_id": ObjectId(user["student_id"])})
            if student:
                print(f"Priya Student class_id: {student.get('class_id')}")
            else:
                print("Priya student record NOT FOUND")
    else:
        print("Priya user NOT FOUND")

    # Demo student
    demo_student = await db.students.find_one({"admission_no": "DEMO-STU-001"})
    print(f"Demo Student class_id: {demo_student['class_id'] if demo_student else 'NOT FOUND'}")

    # Syllabi
    syllabi = await db.syllabus.find().to_list(10)
    for s in syllabi:
        print(f"Syllabus: {s['title']} | class_id: {s['class_id']} | status: {s.get('status')}")

    client.close()

asyncio.run(check())
