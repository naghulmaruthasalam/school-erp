from app.core.deps import CurrentUser
from app.core.enums import Role
from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationAppError
from app.core.pdf import build_simple_pdf
from app.models.academic import Class, Section, Subject
from app.models.base import utcnow
from app.models.exam import Exam, ExamSubject, Mark
from app.models.guardian import Guardian
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.tenant import Tenant
from app.schemas.common import PageParams, PageResponse
from app.schemas.exam import (
    ExamCreateRequest,
    ExamOut,
    ExamSubjectCreateRequest,
    ExamSubjectOut,
    ExamSubjectUpdateRequest,
    ExamUpdateRequest,
    MarkEntryItem,
    MarkOut,
    ResultOut,
    ResultSubjectOut,
)

# ---------------------------------------------------------------------------
# Grading scheme
# ---------------------------------------------------------------------------


def grade_for_percentage(percentage: float) -> str:
    """Single source of truth for the marks->grade mapping. Adjust here only."""
    if percentage >= 90:
        return "A+"
    if percentage >= 80:
        return "A"
    if percentage >= 70:
        return "B"
    if percentage >= 60:
        return "C"
    if percentage >= 50:
        return "D"
    if percentage >= 40:
        return "E"
    return "F"


# ---------------------------------------------------------------------------
# Converters
# ---------------------------------------------------------------------------


def to_exam_out(exam: Exam) -> ExamOut:
    return ExamOut(
        id=str(exam.id),
        school_id=exam.school_id,
        academic_year_id=exam.academic_year_id,
        name=exam.name,
        term=exam.term,
        start_date=exam.start_date,
        end_date=exam.end_date,
        class_ids=exam.class_ids,
        created_at=exam.created_at,
        updated_at=exam.updated_at,
    )


def to_exam_subject_out(exam_subject: ExamSubject) -> ExamSubjectOut:
    return ExamSubjectOut(
        id=str(exam_subject.id),
        school_id=exam_subject.school_id,
        exam_id=exam_subject.exam_id,
        class_id=exam_subject.class_id,
        subject_id=exam_subject.subject_id,
        max_marks=exam_subject.max_marks,
        pass_marks=exam_subject.pass_marks,
        exam_date=exam_subject.exam_date,
    )


def to_mark_out(mark: Mark) -> MarkOut:
    return MarkOut(
        id=str(mark.id),
        school_id=mark.school_id,
        exam_id=mark.exam_id,
        exam_subject_id=mark.exam_subject_id,
        student_id=mark.student_id,
        marks_obtained=mark.marks_obtained,
        remarks=mark.remarks,
        entered_by=mark.entered_by,
        entered_at=mark.entered_at,
    )


# ---------------------------------------------------------------------------
# Internal fetch helpers (school-scoped, 404 on miss/cross-tenant)
# ---------------------------------------------------------------------------


async def _get_exam_or_404(exam_id: str, school_id: str) -> Exam:
    exam = await Exam.get(exam_id)
    if exam is None or exam.school_id != school_id:
        raise NotFoundError("Exam not found")
    return exam


async def _get_exam_subject_or_404(exam_subject_id: str, school_id: str) -> ExamSubject:
    exam_subject = await ExamSubject.get(exam_subject_id)
    if exam_subject is None or exam_subject.school_id != school_id:
        raise NotFoundError("Exam subject not found")
    return exam_subject


async def _verify_teacher_class_access(current: CurrentUser, class_id: str) -> None:
    """Ensure a teacher has access to the class. Admins/Principals have full access."""
    if current.role in (Role.SCHOOL_ADMIN, Role.PRINCIPAL):
        return
    if current.role == Role.TEACHER:
        if not current.user.teacher_id:
            raise PermissionDeniedError("No teacher profile linked to this account")
        teacher = await Teacher.get(current.user.teacher_id)
        if teacher is None:
            raise NotFoundError("Teacher profile not found")
        if class_id not in teacher.assigned_class_ids:
            raise PermissionDeniedError("You are not assigned to this class/grade")


# ---------------------------------------------------------------------------
# Exam CRUD
# ---------------------------------------------------------------------------


async def create_exam(payload: ExamCreateRequest, school_id: str) -> ExamOut:
    exam = Exam(
        school_id=school_id,
        academic_year_id=payload.academic_year_id,
        name=payload.name,
        term=payload.term,
        start_date=payload.start_date,
        end_date=payload.end_date,
        class_ids=payload.class_ids,
    )
    await exam.insert()
    return to_exam_out(exam)


async def list_exams(school_id: str, academic_year_id: str | None, params: PageParams) -> PageResponse[ExamOut]:
    query = {"school_id": school_id}
    if academic_year_id:
        query["academic_year_id"] = academic_year_id
    total = await Exam.find(query).count()
    exams = await Exam.find(query).skip(params.skip).limit(params.page_size).to_list()
    return PageResponse(
        items=[to_exam_out(e) for e in exams],
        total=total,
        page=params.page,
        page_size=params.page_size,
    )


async def get_exam(exam_id: str, school_id: str) -> ExamOut:
    exam = await _get_exam_or_404(exam_id, school_id)
    return to_exam_out(exam)


async def update_exam(exam_id: str, payload: ExamUpdateRequest, school_id: str) -> ExamOut:
    exam = await _get_exam_or_404(exam_id, school_id)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(exam, field, value)
    exam.updated_at = utcnow()
    await exam.save()
    return to_exam_out(exam)


# ---------------------------------------------------------------------------
# ExamSubject CRUD
# ---------------------------------------------------------------------------


async def create_exam_subject(exam_id: str, payload: ExamSubjectCreateRequest, school_id: str) -> ExamSubjectOut:
    await _get_exam_or_404(exam_id, school_id)
    exam_subject = ExamSubject(
        school_id=school_id,
        exam_id=exam_id,
        class_id=payload.class_id,
        subject_id=payload.subject_id,
        max_marks=payload.max_marks,
        pass_marks=payload.pass_marks,
        exam_date=payload.exam_date,
    )
    await exam_subject.insert()
    return to_exam_subject_out(exam_subject)


async def list_exam_subjects(exam_id: str, school_id: str, class_id: str | None = None) -> list[ExamSubjectOut]:
    await _get_exam_or_404(exam_id, school_id)
    query = {"school_id": school_id, "exam_id": exam_id}
    if class_id:
        query["class_id"] = class_id
    exam_subjects = await ExamSubject.find(query).to_list()
    return [to_exam_subject_out(es) for es in exam_subjects]


async def update_exam_subject(exam_subject_id: str, payload: ExamSubjectUpdateRequest, school_id: str) -> ExamSubjectOut:
    exam_subject = await _get_exam_subject_or_404(exam_subject_id, school_id)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(exam_subject, field, value)
    exam_subject.updated_at = utcnow()
    await exam_subject.save()
    return to_exam_subject_out(exam_subject)


# ---------------------------------------------------------------------------
# Marks
# ---------------------------------------------------------------------------


async def enter_marks(exam_subject_id: str, items: list[MarkEntryItem], current: CurrentUser) -> list[MarkOut]:
    school_id = current.school_id
    exam_subject = await _get_exam_subject_or_404(exam_subject_id, school_id)

    await _verify_teacher_class_access(current, exam_subject.class_id)

    for item in items:
        if not (0 <= item.marks_obtained <= exam_subject.max_marks):
            raise ValidationAppError(
                f"marks_obtained for student {item.student_id} must be between 0 and "
                f"{exam_subject.max_marks} (max_marks for this exam subject)"
            )

    saved: list[Mark] = []
    for item in items:
        existing = await Mark.find_one(
            Mark.exam_subject_id == exam_subject_id,
            Mark.student_id == item.student_id,
            Mark.school_id == school_id,
        )
        if existing is not None:
            existing.marks_obtained = item.marks_obtained
            existing.remarks = item.remarks
            existing.entered_by = current.id
            existing.entered_at = utcnow()
            existing.updated_at = utcnow()
            await existing.save()
            saved.append(existing)
        else:
            mark = Mark(
                school_id=school_id,
                exam_id=exam_subject.exam_id,
                exam_subject_id=exam_subject_id,
                student_id=item.student_id,
                marks_obtained=item.marks_obtained,
                remarks=item.remarks,
                entered_by=current.id,
            )
            await mark.insert()
            saved.append(mark)

    return [to_mark_out(m) for m in saved]


async def list_marks(exam_subject_id: str, current: CurrentUser) -> list[MarkOut]:
    school_id = current.school_id
    await _get_exam_subject_or_404(exam_subject_id, school_id)

    marks = await Mark.find(
        Mark.exam_subject_id == exam_subject_id,
        Mark.school_id == school_id,
    ).to_list()

    if current.role == Role.STUDENT:
        allowed = {current.user.student_id} if current.user.student_id else set()
        marks = [m for m in marks if m.student_id in allowed]
    elif current.role == Role.PARENT:
        guardian = await Guardian.get(current.user.guardian_id) if current.user.guardian_id else None
        allowed = set(guardian.student_ids) if guardian else set()
        marks = [m for m in marks if m.student_id in allowed]
    # Staff roles (SCHOOL_ADMIN / PRINCIPAL / TEACHER) see every mark, unfiltered.

    return [to_mark_out(m) for m in marks]


# ---------------------------------------------------------------------------
# Result / report card
# ---------------------------------------------------------------------------


async def _resolve_student_for_access(student_id: str, school_id: str, current: CurrentUser) -> Student:
    student = await Student.get(student_id)
    if student is None or student.school_id != school_id:
        raise NotFoundError("Student not found")

    if current.role == Role.STUDENT:
        if current.user.student_id != student_id:
            raise PermissionDeniedError("You may only view your own results")
    elif current.role == Role.PARENT:
        guardian = await Guardian.get(current.user.guardian_id) if current.user.guardian_id else None
        if guardian is None or student_id not in guardian.student_ids:
            raise PermissionDeniedError("You may only view your child's results")
    # Staff roles may view any student's results.

    return student


async def _build_result(exam: Exam, student: Student, school_id: str) -> ResultOut:
    exam_subjects = await ExamSubject.find(
        ExamSubject.school_id == school_id,
        ExamSubject.exam_id == str(exam.id),
        ExamSubject.class_id == student.class_id,
    ).to_list()

    subjects: list[ResultSubjectOut] = []
    total_obtained = 0.0
    total_max = 0.0

    for es in exam_subjects:
        mark = await Mark.find_one(
            Mark.exam_subject_id == str(es.id),
            Mark.student_id == str(student.id),
            Mark.school_id == school_id,
        )
        marks_obtained = mark.marks_obtained if mark is not None else None
        grade = None
        if marks_obtained is not None and es.max_marks:
            grade = grade_for_percentage(marks_obtained / es.max_marks * 100)

        subjects.append(
            ResultSubjectOut(
                exam_subject_id=str(es.id),
                subject_id=es.subject_id,
                max_marks=es.max_marks,
                pass_marks=es.pass_marks,
                marks_obtained=marks_obtained,
                grade=grade,
            )
        )
        total_max += es.max_marks
        total_obtained += marks_obtained or 0.0

    percentage = (total_obtained / total_max * 100) if total_max else 0.0
    overall_grade = grade_for_percentage(percentage) if total_max else "N/A"

    return ResultOut(
        exam_id=str(exam.id),
        student_id=str(student.id),
        student_name=student.full_name,
        class_id=student.class_id,
        section_id=student.section_id,
        roll_number=student.roll_number,
        subjects=subjects,
        total_marks_obtained=total_obtained,
        total_max_marks=total_max,
        percentage=percentage,
        overall_grade=overall_grade,
    )


async def get_student_result(exam_id: str, student_id: str, current: CurrentUser) -> ResultOut:
    school_id = current.school_id
    exam = await _get_exam_or_404(exam_id, school_id)
    student = await _resolve_student_for_access(student_id, school_id, current)
    return await _build_result(exam, student, school_id)


def _fmt_number(value: float) -> str:
    if value == int(value):
        return str(int(value))
    return f"{value:.2f}"


async def _display_name(model, doc_id: str) -> str:
    """Best-effort lookup of a related document's `name` for nicer PDF output.
    Falls back to the raw id if the document is missing or the id isn't a
    valid reference (these ids aren't enforced foreign keys)."""
    try:
        doc = await model.get(doc_id)
    except Exception:
        return doc_id
    return doc.name if doc is not None else doc_id


async def get_report_card_pdf(exam_id: str, student_id: str, current: CurrentUser) -> bytes:
    school_id = current.school_id
    exam = await _get_exam_or_404(exam_id, school_id)
    student = await _resolve_student_for_access(student_id, school_id, current)
    result = await _build_result(exam, student, school_id)

    tenant = await Tenant.get(school_id)
    school_name = tenant.name if tenant is not None else "School"

    class_name = await _display_name(Class, student.class_id)
    section_name = await _display_name(Section, student.section_id)

    table_rows: list[list[str]] = []
    for subject in result.subjects:
        subject_name = await _display_name(Subject, subject.subject_id)
        table_rows.append(
            [
                subject_name,
                _fmt_number(subject.max_marks),
                _fmt_number(subject.marks_obtained) if subject.marks_obtained is not None else "-",
                subject.grade or "-",
            ]
        )

    meta = {
        "Student Name": student.full_name,
        "Admission No": student.admission_no,
        "Class": class_name,
        "Section": section_name,
        "Roll Number": student.roll_number or "-",
        "Exam Dates": f"{exam.start_date.isoformat()} to {exam.end_date.isoformat()}",
    }

    footer_lines = [
        f"Total: {_fmt_number(result.total_marks_obtained)} / {_fmt_number(result.total_max_marks)}",
        f"Percentage: {result.percentage:.2f}%",
        f"Overall Grade: {result.overall_grade}",
    ]

    return build_simple_pdf(
        school_name=school_name,
        document_title=f"Report Card — {exam.name}",
        meta=meta,
        table_headers=["Subject", "Max Marks", "Marks Obtained", "Grade"],
        table_rows=table_rows,
        footer_lines=footer_lines,
    )
