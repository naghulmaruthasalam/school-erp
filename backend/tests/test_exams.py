import pytest

from app.api.v1.exams import router as exams_router
from app.core.enums import Role
from app.main import app
from app.models.academic import Class, Section, Subject
from app.models.exam import Exam, ExamSubject, Mark
from app.models.guardian import Guardian
from app.models.student import Student
from app.models.tenant import Tenant
from tests.conftest import make_current_user, override_current_user

# The exams router isn't wired into app/api/v1/router.py yet (that file is
# owned by the integration step across all parallel modules). Register it
# directly on the shared `app` singleton here so this module's tests can
# exercise it through the real HTTP layer without touching router.py.
if not any(getattr(r, "path", "") == "/api/v1/exams" for r in app.routes):
    app.include_router(exams_router, prefix="/api/v1")


async def _make_tenant(code: str) -> Tenant:
    tenant = Tenant(name=f"School {code}", code=code)
    await tenant.insert()
    return tenant


async def _make_exam_setup(school_id: str):
    """Creates an exam with one exam-subject, one class/section/subject, and
    two students in that class. Returns a dict of everything for reuse."""
    academic_year_id = "ay-2026"

    klass = Class(school_id=school_id, academic_year_id=academic_year_id, name="Class 8", order=8)
    await klass.insert()
    section = Section(school_id=school_id, class_id=str(klass.id), name="A")
    await section.insert()
    subject = Subject(school_id=school_id, name="Mathematics", code="MATH")
    await subject.insert()

    exam = Exam(
        school_id=school_id,
        academic_year_id=academic_year_id,
        name="Term 1 Final",
        start_date="2026-09-01",
        end_date="2026-09-10",
        class_ids=[str(klass.id)],
    )
    await exam.insert()

    exam_subject = ExamSubject(
        school_id=school_id,
        exam_id=str(exam.id),
        class_id=str(klass.id),
        subject_id=str(subject.id),
        max_marks=100,
        pass_marks=35,
    )
    await exam_subject.insert()

    student1 = Student(
        school_id=school_id,
        admission_no="ADM-001",
        first_name="Asha",
        last_name="Rao",
        academic_year_id=academic_year_id,
        class_id=str(klass.id),
        section_id=str(section.id),
        roll_number="1",
    )
    await student1.insert()

    student2 = Student(
        school_id=school_id,
        admission_no="ADM-002",
        first_name="Bala",
        last_name="Iyer",
        academic_year_id=academic_year_id,
        class_id=str(klass.id),
        section_id=str(section.id),
        roll_number="2",
    )
    await student2.insert()

    return {
        "academic_year_id": academic_year_id,
        "class": klass,
        "section": section,
        "subject": subject,
        "exam": exam,
        "exam_subject": exam_subject,
        "student1": student1,
        "student2": student2,
    }


@pytest.mark.asyncio
async def test_mark_entry_validates_max_marks(client):
    tenant = await _make_tenant("EX001")
    school_id = str(tenant.id)
    setup = await _make_exam_setup(school_id)

    teacher = make_current_user(Role.TEACHER, school_id, teacher_id="t1")
    override_current_user(teacher)

    r = await client.post(
        f"/api/v1/exams/subjects/{setup['exam_subject'].id}/marks",
        json={"marks": [{"student_id": str(setup["student1"].id), "marks_obtained": 150}]},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_mark_entry_upserts_on_re_entry(client):
    tenant = await _make_tenant("EX002")
    school_id = str(tenant.id)
    setup = await _make_exam_setup(school_id)

    teacher = make_current_user(Role.TEACHER, school_id, teacher_id="t1")
    override_current_user(teacher)

    exam_subject_id = str(setup["exam_subject"].id)
    student_id = str(setup["student1"].id)

    r1 = await client.post(
        f"/api/v1/exams/subjects/{exam_subject_id}/marks",
        json={"marks": [{"student_id": student_id, "marks_obtained": 80}]},
    )
    assert r1.status_code == 200
    assert r1.json()[0]["marks_obtained"] == 80
    assert r1.json()[0]["entered_by"] == teacher.id

    r2 = await client.post(
        f"/api/v1/exams/subjects/{exam_subject_id}/marks",
        json={"marks": [{"student_id": student_id, "marks_obtained": 95, "remarks": "Improved"}]},
    )
    assert r2.status_code == 200
    assert r2.json()[0]["marks_obtained"] == 95

    count = await Mark.find(
        Mark.exam_subject_id == exam_subject_id,
        Mark.student_id == student_id,
    ).count()
    assert count == 1


@pytest.mark.asyncio
async def test_student_can_only_fetch_own_result(client):
    tenant = await _make_tenant("EX003")
    school_id = str(tenant.id)
    setup = await _make_exam_setup(school_id)

    mark = Mark(
        school_id=school_id,
        exam_id=str(setup["exam"].id),
        exam_subject_id=str(setup["exam_subject"].id),
        student_id=str(setup["student1"].id),
        marks_obtained=85,
        entered_by="teacher-1",
    )
    await mark.insert()

    student1_user = make_current_user(Role.STUDENT, school_id, student_id=str(setup["student1"].id))
    override_current_user(student1_user)

    r_own = await client.get(f"/api/v1/exams/{setup['exam'].id}/students/{setup['student1'].id}/result")
    assert r_own.status_code == 200
    body = r_own.json()
    assert body["student_id"] == str(setup["student1"].id)
    assert body["subjects"][0]["marks_obtained"] == 85
    assert body["subjects"][0]["grade"] == "A"
    assert body["overall_grade"] == "A"

    r_other = await client.get(f"/api/v1/exams/{setup['exam'].id}/students/{setup['student2'].id}/result")
    assert r_other.status_code == 403


@pytest.mark.asyncio
async def test_parent_can_fetch_child_result_only(client):
    tenant = await _make_tenant("EX004")
    school_id = str(tenant.id)
    setup = await _make_exam_setup(school_id)

    guardian = Guardian(
        school_id=school_id,
        full_name="Parent One",
        relation="Mother",
        phone="9999999999",
        student_ids=[str(setup["student1"].id)],
    )
    await guardian.insert()

    parent_user = make_current_user(Role.PARENT, school_id, guardian_id=str(guardian.id))
    override_current_user(parent_user)

    r_child = await client.get(f"/api/v1/exams/{setup['exam'].id}/students/{setup['student1'].id}/result")
    assert r_child.status_code == 200

    r_not_child = await client.get(f"/api/v1/exams/{setup['exam'].id}/students/{setup['student2'].id}/result")
    assert r_not_child.status_code == 403


@pytest.mark.asyncio
async def test_tenant_isolation_on_exam_access(client):
    tenant_a = await _make_tenant("EX005A")
    tenant_b = await _make_tenant("EX005B")
    setup_a = await _make_exam_setup(str(tenant_a.id))

    admin_b = make_current_user(Role.SCHOOL_ADMIN, str(tenant_b.id))
    override_current_user(admin_b)

    r = await client.get(f"/api/v1/exams/{setup_a['exam'].id}")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_report_card_returns_pdf_bytes(client):
    tenant = await _make_tenant("EX006")
    school_id = str(tenant.id)
    setup = await _make_exam_setup(school_id)

    mark = Mark(
        school_id=school_id,
        exam_id=str(setup["exam"].id),
        exam_subject_id=str(setup["exam_subject"].id),
        student_id=str(setup["student1"].id),
        marks_obtained=72,
        entered_by="teacher-1",
    )
    await mark.insert()

    admin = make_current_user(Role.SCHOOL_ADMIN, school_id)
    override_current_user(admin)

    r = await client.get(f"/api/v1/exams/{setup['exam'].id}/students/{setup['student1'].id}/report-card")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert r.content.startswith(b"%PDF")


@pytest.mark.asyncio
async def test_create_and_list_exams_admin_only(client):
    tenant = await _make_tenant("EX007")
    school_id = str(tenant.id)

    teacher = make_current_user(Role.TEACHER, school_id, teacher_id="t1")
    override_current_user(teacher)
    r_forbidden = await client.post(
        "/api/v1/exams",
        json={
            "academic_year_id": "ay-2026",
            "name": "Unit Test 1",
            "start_date": "2026-10-01",
            "end_date": "2026-10-05",
        },
    )
    assert r_forbidden.status_code == 403

    admin = make_current_user(Role.SCHOOL_ADMIN, school_id)
    override_current_user(admin)
    r_create = await client.post(
        "/api/v1/exams",
        json={
            "academic_year_id": "ay-2026",
            "name": "Unit Test 1",
            "start_date": "2026-10-01",
            "end_date": "2026-10-05",
        },
    )
    assert r_create.status_code == 201

    r_list = await client.get("/api/v1/exams", params={"academic_year_id": "ay-2026"})
    assert r_list.status_code == 200
    assert r_list.json()["total"] == 1
