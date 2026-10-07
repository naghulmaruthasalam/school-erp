from datetime import date

from beanie.operators import In

from app.core.deps import CurrentUser
from app.core.enums import HomeworkSubmissionStatus, Role, StudentStatus
from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationAppError
from app.models.academic import ClassSubjectTeacher, Section, TimetableSlot
from app.models.base import utcnow
from app.models.guardian import Guardian
from app.models.homework import Homework, HomeworkSubmission
from app.models.student import Student
from app.models.teacher import Teacher
from app.schemas.common import PageParams, PageResponse
from app.schemas.homework import (
    HomeworkCreateRequest,
    HomeworkOut,
    HomeworkSubmissionOut,
    HomeworkSubmissionUpdateRequest,
    HomeworkUpdateRequest,
    PendingHomeworkOut,
)

_STAFF_WRITE_ROLES = (Role.TEACHER, Role.SCHOOL_ADMIN, Role.PRINCIPAL)

from app.services.academic_keys import equivalent_class_ids


async def _verify_teacher_section_access(current: CurrentUser, section_id: str) -> None:
    """Ensure a teacher has access to the section's class. Admins/Principals have full access."""
    if current.role in (Role.SCHOOL_ADMIN, Role.PRINCIPAL):
        return
    if current.role == Role.TEACHER:
        if not current.user.teacher_id:
            raise PermissionDeniedError("No teacher profile linked to this account")
        teacher = await Teacher.get(current.user.teacher_id)
        if teacher is None:
            raise NotFoundError("Teacher profile not found")
        section = await Section.get(section_id)
        if section is None:
            raise NotFoundError(f"Section {section_id} not found")
        if section.class_id not in teacher.assigned_class_ids:
            # A duplicate record of the same grade ("Grade 6" vs "Class 6") counts as the same class.
            same_grade = await equivalent_class_ids(current.school_id, section.class_id)
            if not set(same_grade) & set(teacher.assigned_class_ids):
                raise PermissionDeniedError("You are not assigned to this class/grade")


def to_homework_out(doc: Homework) -> HomeworkOut:
    return HomeworkOut(
        id=str(doc.id),
        school_id=doc.school_id,
        section_id=doc.section_id,
        subject_id=doc.subject_id,
        teacher_id=doc.teacher_id,
        title=doc.title,
        description=doc.description,
        chapter=doc.chapter,
        attachment_document_ids=doc.attachment_document_ids,
        assigned_date=doc.assigned_date,
        due_date=doc.due_date,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


def to_submission_out(doc: HomeworkSubmission) -> HomeworkSubmissionOut:
    return HomeworkSubmissionOut(
        id=str(doc.id),
        school_id=doc.school_id,
        homework_id=doc.homework_id,
        student_id=doc.student_id,
        status=doc.status,
        submitted_at=doc.submitted_at,
        attachment_document_ids=doc.attachment_document_ids,
        remarks=doc.remarks,
        teacher_feedback=doc.teacher_feedback,
        teacher_feedback_at=doc.teacher_feedback_at,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


async def _guardian_student_ids(current: CurrentUser) -> list[str]:
    if not current.user.guardian_id:
        raise PermissionDeniedError("No guardian profile linked to this account")
    guardian = await Guardian.get(current.user.guardian_id)
    if guardian is None:
        raise NotFoundError("Guardian profile not found")
    return guardian.student_ids


async def _own_student(current: CurrentUser) -> Student:
    if not current.user.student_id:
        raise PermissionDeniedError("No student profile linked to this account")
    student = await Student.get(current.user.student_id)
    if student is None or student.school_id != current.school_id:
        raise PermissionDeniedError("No student profile linked to this account")
    return student


# ---------------------------------------------------------------------------
# Homework CRUD
# ---------------------------------------------------------------------------


async def _resolve_section_subject_teacher(school_id: str, section_id: str, subject_id: str) -> str | None:
    assignment = await ClassSubjectTeacher.find_one(
        ClassSubjectTeacher.school_id == school_id,
        ClassSubjectTeacher.section_id == section_id,
        ClassSubjectTeacher.subject_id == subject_id,
    )
    if assignment is not None:
        return assignment.teacher_id
    slot = await TimetableSlot.find_one(
        TimetableSlot.school_id == school_id,
        TimetableSlot.section_id == section_id,
        TimetableSlot.subject_id == subject_id,
    )
    return slot.teacher_id if slot is not None else None


async def _stored_chapter_name(school_id: str, section_id: str, subject_id: str, chapter: str | None) -> str | None:
    """A chapter picked in Arabic is filed under its stored (English) name, so every language finds the same homework."""
    from app.services import syllabus_service

    found = await syllabus_service.find_chapter(school_id, section_id, subject_id, chapter)
    return found.name if found else (chapter or None)


async def create_homework(current: CurrentUser, payload: HomeworkCreateRequest) -> HomeworkOut:
    if current.role not in _STAFF_WRITE_ROLES:
        raise PermissionDeniedError("Only teachers or school admins/principals can create homework")

    await _verify_teacher_section_access(current, payload.section_id)

    teacher_id = payload.teacher_id
    if current.role == Role.TEACHER:
        if not current.user.teacher_id:
            raise PermissionDeniedError("No teacher profile linked to this account")
        teacher_id = current.user.teacher_id
    if not teacher_id:
        # Admins/principals may omit the teacher: fall back to whoever teaches this subject in the section.
        teacher_id = await _resolve_section_subject_teacher(current.school_id, payload.section_id, payload.subject_id)
    if not teacher_id:
        raise ValidationAppError(
            "No teacher is assigned to this subject in the section; select a teacher (teacher_id)"
        )

    homework = Homework(
        school_id=current.school_id,
        section_id=payload.section_id,
        subject_id=payload.subject_id,
        teacher_id=teacher_id,
        title=payload.title,
        description=payload.description,
        chapter=await _stored_chapter_name(current.school_id, payload.section_id, payload.subject_id, payload.chapter),
        attachment_document_ids=payload.attachment_document_ids,
        assigned_date=payload.assigned_date,
        due_date=payload.due_date,
    )
    await homework.insert()

    active_students = await Student.find(
        Student.school_id == current.school_id,
        Student.section_id == payload.section_id,
        Student.status == StudentStatus.ACTIVE,
    ).to_list()
    if active_students:
        submissions = [
            HomeworkSubmission(
                school_id=current.school_id,
                homework_id=str(homework.id),
                student_id=str(student.id),
                status=HomeworkSubmissionStatus.PENDING,
            )
            for student in active_students
        ]
        await HomeworkSubmission.insert_many(submissions)

    return to_homework_out(homework)


async def list_homework(
    current: CurrentUser,
    section_id: str | None,
    subject_id: str | None,
    date_from: date | None,
    date_to: date | None,
    params: PageParams,
) -> PageResponse[HomeworkOut]:
    filters = [Homework.school_id == current.school_id]

    if current.role == Role.STUDENT:
        student = await _own_student(current)
        filters.append(Homework.section_id == student.section_id)
    elif current.role == Role.PARENT:
        child_ids = await _guardian_student_ids(current)
        children = [c for c in [await Student.get(cid) for cid in child_ids] if c is not None]
        child_section_ids = {c.section_id for c in children}
        if not child_section_ids:
            return PageResponse(items=[], total=0, page=params.page, page_size=params.page_size)
        if section_id:
            if section_id not in child_section_ids:
                raise PermissionDeniedError("Not one of your children's sections")
            filters.append(Homework.section_id == section_id)
        else:
            filters.append(In(Homework.section_id, list(child_section_ids)))
    elif current.role in _STAFF_WRITE_ROLES:
        if section_id:
            filters.append(Homework.section_id == section_id)
    else:
        raise PermissionDeniedError("Not allowed to view homework")

    if subject_id:
        filters.append(Homework.subject_id == subject_id)
    if date_from:
        filters.append(Homework.due_date >= date_from)
    if date_to:
        filters.append(Homework.due_date <= date_to)

    total = await Homework.find(*filters).count()
    records = (
        await Homework.find(*filters).sort(-Homework.due_date).skip(params.skip).limit(params.page_size).to_list()
    )
    return PageResponse(
        items=[to_homework_out(r) for r in records], total=total, page=params.page, page_size=params.page_size
    )


async def _check_homework_read_access(current: CurrentUser, homework: Homework) -> None:
    if current.role == Role.STUDENT:
        student = await _own_student(current)
        if student.section_id != homework.section_id:
            raise PermissionDeniedError("Not your section's homework")
    elif current.role == Role.PARENT:
        child_ids = await _guardian_student_ids(current)
        children = [c for c in [await Student.get(cid) for cid in child_ids] if c is not None]
        if not any(c.section_id == homework.section_id for c in children):
            raise PermissionDeniedError("Not your child's homework")
    # Staff roles may view any homework in-school.


async def _get_homework_or_404(current: CurrentUser, homework_id: str) -> Homework:
    homework = await Homework.get(homework_id)
    if homework is None or homework.school_id != current.school_id:
        raise NotFoundError("Homework not found")
    return homework


async def get_homework(current: CurrentUser, homework_id: str) -> HomeworkOut:
    homework = await _get_homework_or_404(current, homework_id)
    await _check_homework_read_access(current, homework)
    return to_homework_out(homework)


async def update_homework(current: CurrentUser, homework_id: str, payload: HomeworkUpdateRequest) -> HomeworkOut:
    if current.role not in _STAFF_WRITE_ROLES:
        raise PermissionDeniedError("Only teachers or school admins/principals can update homework")
    homework = await _get_homework_or_404(current, homework_id)

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if field == "chapter":
            value = await _stored_chapter_name(current.school_id, homework.section_id, homework.subject_id, value)
        setattr(homework, field, value)
    homework.updated_at = utcnow()
    await homework.save()
    return to_homework_out(homework)


async def delete_homework(current: CurrentUser, homework_id: str) -> None:
    if current.role not in _STAFF_WRITE_ROLES:
        raise PermissionDeniedError("Only teachers or school admins/principals can delete homework")
    homework = await _get_homework_or_404(current, homework_id)

    await HomeworkSubmission.find(
        HomeworkSubmission.school_id == current.school_id,
        HomeworkSubmission.homework_id == str(homework.id),
    ).delete()
    await homework.delete()


# ---------------------------------------------------------------------------
# Submissions
# ---------------------------------------------------------------------------


async def get_submission(current: CurrentUser, submission_id: str) -> HomeworkSubmissionOut:
    """Get a single homework submission."""
    submission = await HomeworkSubmission.get(submission_id)
    if submission is None or submission.school_id != current.school_id:
        raise NotFoundError("Submission not found")
    return to_submission_out(submission)


async def list_submissions(current: CurrentUser, homework_id: str) -> list[HomeworkSubmissionOut]:
    homework = await _get_homework_or_404(current, homework_id)

    submissions = await HomeworkSubmission.find(
        HomeworkSubmission.school_id == current.school_id,
        HomeworkSubmission.homework_id == str(homework.id),
    ).to_list()

    if current.role in _STAFF_WRITE_ROLES:
        pass  # staff sees all
    elif current.role == Role.STUDENT:
        student = await _own_student(current)
        submissions = [s for s in submissions if s.student_id == str(student.id)]
    elif current.role == Role.PARENT:
        child_ids = set(await _guardian_student_ids(current))
        submissions = [s for s in submissions if s.student_id in child_ids]
    else:
        raise PermissionDeniedError("Not allowed to view submissions")

    return [to_submission_out(s) for s in submissions]


async def update_submission(
    current: CurrentUser, submission_id: str, payload: HomeworkSubmissionUpdateRequest
) -> HomeworkSubmissionOut:
    submission = await HomeworkSubmission.get(submission_id)
    if submission is None or submission.school_id != current.school_id:
        raise NotFoundError("Submission not found")

    if current.role == Role.STUDENT:
        student = await _own_student(current)
        if submission.student_id != str(student.id):
            raise PermissionDeniedError("You may only update your own submission")
        # A student may only mark their own submission as submitted (plus attachments/remarks).
        submission.status = HomeworkSubmissionStatus.SUBMITTED
        submission.submitted_at = utcnow()
        if payload.attachment_document_ids is not None:
            submission.attachment_document_ids = payload.attachment_document_ids
        if payload.remarks is not None:
            submission.remarks = payload.remarks
    elif current.role in _STAFF_WRITE_ROLES:
        data = payload.model_dump(exclude_unset=True)
        if "status" in data and data["status"] is not None:
            submission.status = data["status"]
            if submission.status == HomeworkSubmissionStatus.SUBMITTED and submission.submitted_at is None:
                submission.submitted_at = utcnow()
        if "attachment_document_ids" in data and data["attachment_document_ids"] is not None:
            submission.attachment_document_ids = data["attachment_document_ids"]
        if "remarks" in data and data["remarks"] is not None:
            submission.remarks = data["remarks"]
        if "teacher_feedback" in data:  # the teacher's own comments: second to the AI feedback, which is generated on hand-in
            text = (data["teacher_feedback"] or "").strip()
            submission.teacher_feedback = text or None
            submission.teacher_feedback_at = utcnow() if text else None
            submission.teacher_feedback_by = str(current.user.id) if text else None
    else:
        raise PermissionDeniedError("Not allowed to update homework submissions")

    submission.updated_at = utcnow()
    await submission.save()
    return to_submission_out(submission)


# ---------------------------------------------------------------------------
# Pending homework (student/parent convenience view)
# ---------------------------------------------------------------------------


async def _pending_for_student(current: CurrentUser, student: Student) -> list[PendingHomeworkOut]:
    today = date.today()
    homeworks = await Homework.find(
        Homework.school_id == current.school_id,
        Homework.section_id == student.section_id,
        Homework.due_date >= today,
    ).to_list()

    student_id = str(student.id)
    pending: list[PendingHomeworkOut] = []
    for hw in homeworks:
        submission = await HomeworkSubmission.find_one(
            HomeworkSubmission.school_id == current.school_id,
            HomeworkSubmission.homework_id == str(hw.id),
            HomeworkSubmission.student_id == student_id,
        )
        if submission is None or submission.status == HomeworkSubmissionStatus.PENDING:
            pending.append(PendingHomeworkOut(**to_homework_out(hw).model_dump(), student_id=student_id))
    return pending


async def pending_homework(current: CurrentUser) -> list[PendingHomeworkOut]:
    if current.role == Role.STUDENT:
        student = await _own_student(current)
        return await _pending_for_student(current, student)
    elif current.role == Role.PARENT:
        child_ids = await _guardian_student_ids(current)
        result: list[PendingHomeworkOut] = []
        for cid in child_ids:
            student = await Student.get(cid)
            if student is None or student.school_id != current.school_id:
                continue
            result.extend(await _pending_for_student(current, student))
        return result
    else:
        raise PermissionDeniedError("Only students or parents can view pending homework")
