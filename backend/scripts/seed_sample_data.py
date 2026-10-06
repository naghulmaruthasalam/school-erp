"""
Seed script to create sample school with test accounts.

Run with: python -m scripts.seed_sample_data

Sample Credentials:
==================
School: Cogniitec Demo School

| Role         | Username        | Password    |
|--------------|-----------------|-------------|
| Super Admin  | superadmin      | Super@123   |
| School Admin | admin@demo      | Admin@123   |
| Principal    | principal@demo  | Principal@123 |
| Teacher      | DEMO-TCH-001    | Teacher@123 |
| Student      | DEMO-STU-001    | Student@123 |
| Parent       | 9876543210      | Parent@123  |
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import date
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from app.core.config import get_settings
from app.core.enums import Role, StudentStatus, TeacherStatus
from app.core.security import hash_password
from app.models.user import User
from app.models.tenant import Tenant
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.guardian import Guardian
from app.models.academic import AcademicYear, Class, Section, Subject


settings = get_settings()

SCHOOL_ID = "demo-school-001"
SCHOOL_NAME = "Cogniitec Demo School"

# Credentials
CREDENTIALS = {
    "super_admin": {"username": "superadmin", "password": "Super@123"},
    "school_admin": {"username": "admin@demo", "password": "Admin@123"},
    "principal": {"username": "principal@demo", "password": "Principal@123"},
    "teacher": {"username": "DEMO-TCH-001", "password": "Teacher@123"},
    "student": {"username": "DEMO-STU-001", "password": "Student@123"},
    "parent": {"username": "9876543210", "password": "Parent@123"},
}


async def init_db():
    from app.core.database import get_all_models
    from app.core.tenant_db import get_client

    client = get_client()
    await init_beanie(database=client[settings.mongodb_db_name], document_models=get_all_models())
    return client


async def create_school():
    """Create demo school/tenant."""
    existing = await Tenant.find_one(Tenant.code == "DEMO")
    if existing:
        print(f"School already exists: {existing.name}")
        return str(existing.id)

    tenant = Tenant(
        name=SCHOOL_NAME,
        code="DEMO",
        email="demo@cogniitec.com",
        phone="9876543210",
        address="123 Demo Street, Demo City",
        is_active=True,
    )
    await tenant.insert()
    print(f"Created school: {tenant.name} (ID: {tenant.id})")
    return str(tenant.id)


async def create_super_admin():
    """Create super admin user."""
    creds = CREDENTIALS["super_admin"]
    # Check by email since that's the unique constraint
    existing = await User.find_one(User.email == "superadmin@cogniitec.com")
    if existing:
        # The API creates a super admin on startup; give it the documented demo login.
        existing.username = creds["username"]
        existing.hashed_password = hash_password(creds["password"])
        existing.must_change_password = False
        await existing.save()
        print(f"Super Admin ready: {creds['username']} / {creds['password']}")
        return

    user = User(
        school_id=None,  # Super admin has no school
        username=creds["username"],
        email="superadmin@cogniitec.com",
        hashed_password=hash_password(creds["password"]),
        role=Role.SUPER_ADMIN,
        full_name="Super Administrator",
        is_active=True,
        must_change_password=False,
    )
    await user.insert()
    print(f"Created Super Admin: {creds['username']} / {creds['password']}")


async def create_school_admin(school_id: str):
    """Create school admin user."""
    creds = CREDENTIALS["school_admin"]
    existing = await User.find_one(User.school_id == school_id, User.username == creds["username"])
    if existing:
        print(f"School Admin already exists: {creds['username']}")
        return

    user = User(
        school_id=school_id,
        username=creds["username"],
        email="admin@demo.cogniitec.com",
        hashed_password=hash_password(creds["password"]),
        role=Role.SCHOOL_ADMIN,
        full_name="School Administrator",
        is_active=True,
        must_change_password=False,
    )
    await user.insert()
    print(f"Created School Admin: {creds['username']} / {creds['password']}")


async def create_principal(school_id: str):
    """Create principal user."""
    creds = CREDENTIALS["principal"]
    existing = await User.find_one(User.school_id == school_id, User.username == creds["username"])
    if existing:
        print(f"Principal already exists: {creds['username']}")
        return

    user = User(
        school_id=school_id,
        username=creds["username"],
        email="principal@demo.cogniitec.com",
        hashed_password=hash_password(creds["password"]),
        role=Role.PRINCIPAL,
        full_name="Dr. Ramesh Kumar",
        is_active=True,
        must_change_password=False,
    )
    await user.insert()
    print(f"Created Principal: {creds['username']} / {creds['password']}")


async def create_academic_structure(school_id: str):
    """Create academic year, classes, sections, subjects."""
    # Academic Year
    existing_year = await AcademicYear.find_one(AcademicYear.school_id == school_id, AcademicYear.is_current == True)
    if existing_year:
        print(f"Academic year exists: {existing_year.name}")
        year_id = str(existing_year.id)
    else:
        year = AcademicYear(
            school_id=school_id,
            name="2026-2027",
            start_date=date(2026, 4, 1),
            end_date=date(2027, 3, 31),
            is_current=True,
        )
        await year.insert()
        year_id = str(year.id)
        print(f"Created Academic Year: {year.name}")

    # Classes
    class_ids = {}
    for order, name in [(10, "Class 10"), (9, "Class 9"), (8, "Class 8")]:
        existing = await Class.find_one(Class.school_id == school_id, Class.name == name)
        if existing:
            class_ids[name] = str(existing.id)
        else:
            cls = Class(school_id=school_id, academic_year_id=year_id, name=name, order=order)
            await cls.insert()
            class_ids[name] = str(cls.id)
            print(f"Created Class: {name}")

    # Sections for Class 10
    section_id = None
    existing_section = await Section.find_one(Section.school_id == school_id, Section.class_id == class_ids["Class 10"], Section.name == "A")
    if existing_section:
        section_id = str(existing_section.id)
    else:
        section = Section(school_id=school_id, class_id=class_ids["Class 10"], name="A", room_no="101")
        await section.insert()
        section_id = str(section.id)
        print("Created Section: Class 10-A")

    # Subjects
    subjects = [
        ("Mathematics", "MATH"), ("English", "ENG"), ("Physics", "PHY"),
        ("Chemistry", "CHEM"), ("Hindi", "HIN"), ("Computer Science", "CS")
    ]
    subject_ids = []
    for name, code in subjects:
        existing = await Subject.find_one(Subject.school_id == school_id, Subject.code == code)
        if existing:
            subject_ids.append(str(existing.id))
        else:
            subj = Subject(school_id=school_id, name=name, code=code)
            await subj.insert()
            subject_ids.append(str(subj.id))
            print(f"Created Subject: {name}")

    return year_id, class_ids["Class 10"], section_id, subject_ids


async def create_teacher(school_id: str, class_id: str, subject_ids: list[str]):
    """Create teacher with user account."""
    creds = CREDENTIALS["teacher"]
    existing = await User.find_one(User.school_id == school_id, User.username == creds["username"])
    if existing:
        print(f"Teacher already exists: {creds['username']}")
        return

    # Create Teacher profile
    teacher = Teacher(
        school_id=school_id,
        employee_no=creds["username"],
        first_name="Meera",
        last_name="Sharma",
        phone="9876543221",
        email="meera.sharma@demo.cogniitec.com",
        qualifications=["M.Sc. Mathematics", "B.Ed."],
        subject_ids=subject_ids[:2],  # Math and English
        assigned_class_ids=[class_id],
        joining_date=date(2020, 6, 1),
        status=TeacherStatus.ACTIVE,
    )
    await teacher.insert()

    # Create User
    user = User(
        school_id=school_id,
        username=creds["username"],
        email=teacher.email,
        hashed_password=hash_password(creds["password"]),
        role=Role.TEACHER,
        full_name=teacher.full_name,
        phone=teacher.phone,
        teacher_id=str(teacher.id),
        is_active=True,
        must_change_password=False,
    )
    await user.insert()
    print(f"Created Teacher: {creds['username']} / {creds['password']}")
    return str(teacher.id)


async def create_student_and_parent(school_id: str, year_id: str, class_id: str, section_id: str):
    """Create student with parent account."""
    student_creds = CREDENTIALS["student"]
    parent_creds = CREDENTIALS["parent"]

    existing_student = await User.find_one(User.school_id == school_id, User.username == student_creds["username"])
    if existing_student:
        print(f"Student already exists: {student_creds['username']}")
        return

    # Create Student profile
    student = Student(
        school_id=school_id,
        admission_no=student_creds["username"],
        first_name="Aarav",
        last_name="Patel",
        dob=date(2010, 5, 15),
        gender="M",
        academic_year_id=year_id,
        class_id=class_id,
        section_id=section_id,
        roll_number="15",
        admission_date=date(2024, 4, 1),
        status=StudentStatus.ACTIVE,
        phone="9876543230",
        email="aarav.patel@demo.cogniitec.com",
        address="456 Student Lane, Demo City",
    )
    await student.insert()
    student_id = str(student.id)

    # Create Guardian profile
    guardian = Guardian(
        school_id=school_id,
        full_name="Rajesh Patel",
        relation="Father",
        phone=parent_creds["username"],
        email="rajesh.patel@demo.cogniitec.com",
        occupation="Business Owner",
        address="456 Student Lane, Demo City",
        student_ids=[student_id],
    )
    await guardian.insert()
    guardian_id = str(guardian.id)

    # Update student with guardian
    student.guardian_ids = [guardian_id]
    student.primary_guardian_id = guardian_id
    await student.save()

    # Create Student User
    student_user = User(
        school_id=school_id,
        username=student_creds["username"],
        email=student.email,
        hashed_password=hash_password(student_creds["password"]),
        role=Role.STUDENT,
        full_name=student.full_name,
        phone=student.phone,
        student_id=student_id,
        is_active=True,
        must_change_password=False,
    )
    await student_user.insert()
    print(f"Created Student: {student_creds['username']} / {student_creds['password']}")

    # Create Parent User
    parent_user = User(
        school_id=school_id,
        username=parent_creds["username"],
        email=guardian.email,
        hashed_password=hash_password(parent_creds["password"]),
        role=Role.PARENT,
        full_name=guardian.full_name,
        phone=guardian.phone,
        guardian_id=guardian_id,
        is_active=True,
        must_change_password=False,
    )
    await parent_user.insert()
    print(f"Created Parent: {parent_creds['username']} / {parent_creds['password']}")


async def seed_all() -> None:
    """Create the sample school, accounts and academic data (idempotent).

    Assumes Beanie is already initialised, so it can also run inside the API
    process (SEED_DEMO_DATA=true).
    """
    school_id = await create_school()

    await create_super_admin()
    await create_school_admin(school_id)
    await create_principal(school_id)

    year_id, class_id, section_id, subject_ids = await create_academic_structure(school_id)
    await create_teacher(school_id, class_id, subject_ids)
    await create_student_and_parent(school_id, year_id, class_id, section_id)

    from scripts.seed_demo_content import seed_demo_content

    await seed_demo_content(school_id)


async def main():
    print("\n" + "="*60)
    print("COGNIITEC SCHOOL ERP - SAMPLE DATA SEEDER")
    print("="*60 + "\n")

    client = await init_db()

    try:
        await seed_all()

        print("\n" + "="*60)
        print("SAMPLE CREDENTIALS")
        print("="*60)
        print(f"\nSchool: {SCHOOL_NAME} (school code: DEMO)\n")
        print(f"{'Role':<15} {'Username':<20} {'Password':<15}")
        print("-"*50)
        print(f"{'Super Admin':<15} {'superadmin':<20} {'Super@123':<15}")
        print(f"{'School Admin':<15} {'admin@demo':<20} {'Admin@123':<15}")
        print(f"{'Principal':<15} {'principal@demo':<20} {'Principal@123':<15}")
        print(f"{'Teacher':<15} {'DEMO-TCH-001':<20} {'Teacher@123':<15}")
        print(f"{'Student':<15} {'DEMO-STU-001':<20} {'Student@123':<15}")
        print(f"{'Parent':<15} {'9876543210':<20} {'Parent@123':<15}")
        print("\n" + "="*60 + "\n")

    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
