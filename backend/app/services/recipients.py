"""Who should hear about something: a student's parents and teachers, a school's leaders, the platform's super admins."""
from app.core.enums import Role
from app.models.academic import ClassSubjectTeacher, Section, TimetableSlot
from app.models.guardian import Guardian
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.user import User
from app.services.academic_keys import equivalent_class_ids


async def _users(query: dict) -> list[str]:
    return [str(u.id) for u in await User.find({**query, "is_active": True}).to_list()]


async def principal_ids(school_id: str) -> list[str]:
    return await _users({"school_id": school_id, "role": Role.PRINCIPAL.value})


async def school_admin_ids(school_id: str) -> list[str]:
    return await _users({"school_id": school_id, "role": Role.SCHOOL_ADMIN.value})


async def super_admin_ids() -> list[str]:
    return await _users({"school_id": None, "role": Role.SUPER_ADMIN.value})


async def parent_ids(school_id: str, student_id: str) -> list[str]:
    guardians = await Guardian.find({"school_id": school_id, "student_ids": student_id}).to_list()
    gids = [str(g.id) for g in guardians]
    return await _users({"school_id": school_id, "role": Role.PARENT.value, "guardian_id": {"$in": gids}}) if gids else []


async def teacher_user_ids(school_id: str, teacher_ids: list[str]) -> list[str]:
    return await _users({"school_id": school_id, "role": Role.TEACHER.value, "teacher_id": {"$in": teacher_ids}}) if teacher_ids else []


async def teachers_of(student: Student, subject_id: str | None = None) -> list[str]:
    """Teacher ids who teach this student: the section's subject teachers and timetable, else the teachers assigned to the
    student's grade (matching the subject when it is known)."""
    sid = student.school_id
    q: dict = {"school_id": sid, "section_id": student.section_id}
    if subject_id:
        q["subject_id"] = subject_id
    found = {c.teacher_id for c in await ClassSubjectTeacher.find(q).to_list()}
    found |= {t.teacher_id for t in await TimetableSlot.find(q).to_list()}
    section = await Section.get(student.section_id) if len(student.section_id) == 24 else None
    if section is not None and section.class_teacher_id:
        found.add(section.class_teacher_id)
    if found:
        return sorted(found)
    classes = await equivalent_class_ids(sid, student.class_id)
    assigned = await Teacher.find({"school_id": sid, "assigned_class_ids": {"$in": classes}}).to_list()
    if subject_id:
        matching = [t for t in assigned if subject_id in t.subject_ids]
        assigned = matching or assigned
    return sorted(str(t.id) for t in assigned)
