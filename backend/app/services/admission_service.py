from datetime import date

from app.core.audit import record_audit
from app.core.deps import CurrentUser
from app.core.enums import AdmissionStatus, Role, StudentStatus
from app.core.exceptions import ConflictError, NotFoundError, PermissionDeniedError, ValidationAppError
from app.models.academic import AcademicYear, Section
from app.models.admission import Admission
from app.models.guardian import Guardian
from app.models.student import Student
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.admission import (
    AdmissionCreateRequest,
    AdmissionOut,
    AdmissionReviewRequest,
    AdmissionReviewResponse,
)
from app.schemas.common import PageParams, PageResponse
from app.services.user_provisioning import link_guardian_to_student, provision_user_account

ADMIN_ROLES = (Role.SCHOOL_ADMIN, Role.PRINCIPAL)


def to_out(admission: Admission) -> AdmissionOut:
    return AdmissionOut(
        id=str(admission.id),
        school_id=admission.school_id,
        applicant_first_name=admission.applicant_first_name,
        applicant_last_name=admission.applicant_last_name,
        dob=admission.dob,
        gender=admission.gender,
        applying_for_class_id=admission.applying_for_class_id,
        applicant_email=admission.applicant_email,
        guardian_name=admission.guardian_name,
        guardian_phone=admission.guardian_phone,
        guardian_email=admission.guardian_email,
        document_ids=admission.document_ids,
        status=admission.status,
        reviewed_by=admission.reviewed_by,
        review_notes=admission.review_notes,
        created_student_id=admission.created_student_id,
        created_at=admission.created_at,
        updated_at=admission.updated_at,
    )


async def create_admission(current: CurrentUser, payload: AdmissionCreateRequest) -> Admission:
    if current.role not in ADMIN_ROLES:
        raise PermissionDeniedError()
    admission = Admission(school_id=current.school_id, **payload.model_dump())
    await admission.insert()
    return admission


async def list_admissions(
    current: CurrentUser,
    status: AdmissionStatus | None,
    page_params: PageParams,
) -> PageResponse[AdmissionOut]:
    if current.role not in ADMIN_ROLES:
        raise PermissionDeniedError()

    query = Admission.find(Admission.school_id == current.school_id)
    if status is not None:
        query = query.find(Admission.status == status)

    total = await query.count()
    rows = await query.skip(page_params.skip).limit(page_params.page_size).to_list()
    return PageResponse(
        items=[to_out(a) for a in rows],
        total=total,
        page=page_params.page,
        page_size=page_params.page_size,
    )


async def _get_for_admin(current: CurrentUser, admission_id: str) -> Admission:
    if current.role not in ADMIN_ROLES:
        raise PermissionDeniedError()
    admission = await Admission.get(admission_id)
    if admission is None or admission.school_id != current.school_id:
        raise NotFoundError("Admission not found")
    return admission


async def get_admission(current: CurrentUser, admission_id: str) -> Admission:
    return await _get_for_admin(current, admission_id)


async def _generate_admission_no(school_id: str) -> str:
    """Generate admission number linked to school code: {SCHOOL_CODE}-STU-{SEQ}"""
    tenant = await Tenant.get(school_id)
    school_code = tenant.code if tenant else "SCH"
    count = await Student.find(Student.school_id == school_id).count()
    seq = str(count + 1).zfill(4)
    return f"{school_code}-STU-{seq}"


async def _generate_roll_number(school_id: str, section_id: str) -> str:
    """Generate roll number based on count of students in the section + 1"""
    count = await Student.find(
        Student.school_id == school_id,
        Student.section_id == section_id,
        Student.status == StudentStatus.ACTIVE,
    ).count()
    return str(count + 1)


async def review_admission(
    current: CurrentUser, admission_id: str, payload: AdmissionReviewRequest
) -> AdmissionReviewResponse:
    admission = await _get_for_admin(current, admission_id)

    if admission.status in (AdmissionStatus.CONVERTED, AdmissionStatus.REJECTED):
        raise ConflictError("This admission has already been reviewed")

    if payload.action == "reject":
        admission.status = AdmissionStatus.REJECTED
        admission.reviewed_by = current.id
        admission.review_notes = payload.review_notes
        await admission.save()
        await record_audit(
            school_id=current.school_id,
            actor_user_id=current.id,
            action="admission.rejected",
            entity_type="Admission",
            entity_id=str(admission.id),
            details={"notes": payload.review_notes},
        )
        return AdmissionReviewResponse(admission=to_out(admission))

    # --- approve: full conversion flow ---
    if not payload.academic_year_id or not payload.section_id:
        raise ValidationAppError("academic_year_id and section_id are required to approve an admission")

    academic_year = await AcademicYear.get(payload.academic_year_id)
    if academic_year is None or academic_year.school_id != current.school_id:
        raise ValidationAppError("Invalid academic_year_id")

    section = await Section.get(payload.section_id)
    if section is None or section.school_id != current.school_id:
        raise ValidationAppError("Invalid section_id")
    if section.class_id != admission.applying_for_class_id:
        raise ValidationAppError("Section does not belong to the class this admission applied for")

    admission_no = payload.admission_no or await _generate_admission_no(current.school_id)
    roll_number = payload.roll_number or await _generate_roll_number(current.school_id, payload.section_id)

    student = Student(
        school_id=current.school_id,
        admission_no=admission_no,
        first_name=admission.applicant_first_name,
        last_name=admission.applicant_last_name,
        dob=admission.dob,
        gender=admission.gender,
        academic_year_id=payload.academic_year_id,
        class_id=admission.applying_for_class_id,
        section_id=payload.section_id,
        roll_number=roll_number,
        admission_date=date.today(),
        status=StudentStatus.ACTIVE,
        email=admission.applicant_email,
        document_ids=admission.document_ids,
    )
    await student.insert()

    # Reuse an existing guardian by phone within this school (siblings share a guardian).
    guardian = await Guardian.find_one(
        Guardian.school_id == current.school_id, Guardian.phone == admission.guardian_phone
    )
    if guardian is None:
        guardian = Guardian(
            school_id=current.school_id,
            full_name=admission.guardian_name,
            phone=admission.guardian_phone,
            email=admission.guardian_email,
        )
        await guardian.insert()

    await link_guardian_to_student(str(guardian.id), str(student.id), make_primary=True)

    notes: list[str] = []

    student_login_created = False
    if admission.applicant_email:
        try:
            await provision_user_account(
                current.school_id,
                Role.STUDENT,
                student.full_name,
                admission.applicant_email,
                student_id=str(student.id),
            )
            student_login_created = True
        except ValueError as exc:
            notes.append(f"Student login not created: {exc}")
    else:
        notes.append("Student login not created: no applicant email was provided")

    guardian_login_created = False
    existing_guardian_user = await User.find_one(
        User.school_id == current.school_id, User.guardian_id == str(guardian.id)
    )
    if existing_guardian_user is not None:
        notes.append("Guardian already has a login")
    elif guardian.email:
        try:
            await provision_user_account(
                current.school_id,
                Role.PARENT,
                guardian.full_name,
                guardian.email,
                phone=guardian.phone,
                guardian_id=str(guardian.id),
            )
            guardian_login_created = True
        except ValueError as exc:
            notes.append(f"Guardian login not created: {exc}")
    else:
        notes.append("Guardian login not created: guardian has no email on file")

    admission.status = AdmissionStatus.CONVERTED
    admission.created_student_id = str(student.id)
    admission.reviewed_by = current.id
    admission.review_notes = payload.review_notes
    await admission.save()

    await record_audit(
        school_id=current.school_id,
        actor_user_id=current.id,
        action="admission.approved",
        entity_type="Admission",
        entity_id=str(admission.id),
        details={"student_id": str(student.id), "guardian_id": str(guardian.id)},
    )

    return AdmissionReviewResponse(
        admission=to_out(admission),
        student_id=str(student.id),
        guardian_id=str(guardian.id),
        student_login_created=student_login_created,
        guardian_login_created=guardian_login_created,
        notes=notes,
    )
