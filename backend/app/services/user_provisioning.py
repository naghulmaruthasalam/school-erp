import secrets
import string

from app.core.enums import Role
from app.core.security import hash_password
from app.models.user import User
from app.services.email_service import send_email


def _generate_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def provision_user_account(
    school_id: str,
    role: Role,
    full_name: str,
    username: str,  # Student admission_no / Teacher emp_id / Guardian phone or email
    phone: str | None = None,
    email: str | None = None,
    *,
    password: str | None = None,
    student_id: str | None = None,
    teacher_id: str | None = None,
    guardian_id: str | None = None,
) -> tuple[User, str]:
    """Create the login (User) record backing a Student/Teacher/Guardian/staff profile.

    username is the login ID:
    - Students: admission_no (e.g., BPS-STU-001)
    - Teachers: employee_id (e.g., BPS-TCH-001)
    - Parents: phone number or email

    Raises ValueError if a User already exists for (school_id, username).
    """
    existing = await User.find_one(User.school_id == school_id, User.username == username)
    if existing is not None:
        raise ValueError(f"A user with username {username} already exists for this school")

    use_temp = password is None
    actual_password = _generate_temp_password() if use_temp else password
    user = User(
        school_id=school_id,
        username=username,
        email=email,
        hashed_password=hash_password(actual_password),
        role=role,
        full_name=full_name,
        phone=phone,
        must_change_password=use_temp,
        student_id=student_id,
        teacher_id=teacher_id,
        guardian_id=guardian_id,
    )
    await user.insert()

    return user, actual_password


async def link_guardian_to_student(guardian_id: str, student_id: str, make_primary: bool = False) -> None:
    """Keeps Guardian.student_ids and Student.guardian_ids/primary_guardian_id
    in sync — the only place that should mutate either side of this link."""
    from app.models.guardian import Guardian
    from app.models.student import Student

    guardian = await Guardian.get(guardian_id)
    student = await Student.get(student_id)
    if guardian is None or student is None:
        raise ValueError("Guardian or student not found")

    if student_id not in guardian.student_ids:
        guardian.student_ids.append(student_id)
        await guardian.save()

    if guardian_id not in student.guardian_ids:
        student.guardian_ids.append(guardian_id)
    if make_primary or student.primary_guardian_id is None:
        student.primary_guardian_id = guardian_id
    await student.save()
