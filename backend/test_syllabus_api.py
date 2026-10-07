import asyncio
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from app.core.config import get_settings
from app.core.enums import Role
from app.models.user import User
from app.models.student import Student
from app.models.syllabus import Syllabus, SyllabusStatus
from app.schemas.common import PageParams

async def test():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.mongodb_uri)
    await init_beanie(database=client[settings.mongodb_db_name], document_models=[User, Student, Syllabus])

    # Get Priya's user
    user = await User.find_one(User.full_name == "Priya Sharma")
    print(f"User: {user.full_name}, role: {user.role}, student_id: {user.student_id}")

    # Get student
    student = await Student.get(user.student_id)
    print(f"Student class_id: {student.class_id}")
    print(f"Student school_id: {student.school_id}")

    # Build filters like the service does
    filters = {
        "school_id": user.school_id,
        "class_id": student.class_id,
        "status": SyllabusStatus.PUBLISHED.value
    }
    print(f"\nFilters: {filters}")

    # Query
    total = await Syllabus.find(filters).count()
    records = await Syllabus.find(filters).to_list()
    print(f"\nFound {total} syllabi:")
    for r in records:
        print(f"  - {r.title}")

    client.close()

asyncio.run(test())
