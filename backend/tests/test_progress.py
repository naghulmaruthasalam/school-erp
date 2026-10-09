"""Progress alerts: student progress -> parents, teachers and principal; teacher performance -> principal; weekly summaries."""
import datetime as dt

import pytest
from beanie import PydanticObjectId

from app.core.enums import AttendanceStatus, HomeworkSubmissionStatus, Role
from app.models.academic import Class, Section, Subject, TimetableSlot
from app.models.attendance import StudentAttendance
from app.models.exam import Exam, ExamSubject, Mark
from app.models.guardian import Guardian
from app.models.homework import Homework, HomeworkSubmission
from app.models.homework_validation import HomeworkValidation
from app.models.notification import Notification
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.ticket import Ticket
from app.models.user import User
from app.services import progress_service
from tests.conftest import make_current_user, override_current_user

SCHOOL = "5c0000000000000000000001"
IDS = {k: "000000000000000000000%03d" % n for k, n in dict(principal=501, teacher_u=502, parent_u=503, admin=504, other_parent_u=505).items()}
TODAY = dt.date(2026, 10, 14)  # a Wednesday


async def mk_user(uid, role, **kw):
    await User(id=PydanticObjectId(uid), school_id=SCHOOL, username=uid, hashed_password="x", role=role, full_name=f"{role.value} {uid[-3:]}", **kw).insert()


async def titles(user_id):
    return sorted(n.title for n in await Notification.find({"school_id": SCHOOL, "target_user_ids": user_id}).to_list())


@pytest.fixture
async def world():
    cls = Class(school_id=SCHOOL, academic_year_id="ay", name="Class 8", order=8)
    await cls.insert()
    sec = Section(school_id=SCHOOL, class_id=str(cls.id), name="A")
    await sec.insert()
    subj = Subject(school_id=SCHOOL, name="Maths", code="MATH")
    await subj.insert()
    teacher = Teacher(school_id=SCHOOL, employee_no="T1", first_name="Meera", last_name="S", phone="9", assigned_class_ids=[str(cls.id)], subject_ids=[str(subj.id)])
    await teacher.insert()
    studs = []
    for n, name in enumerate(("Asha", "Ravi", "Zoya")):
        s = Student(school_id=SCHOOL, admission_no=f"A{n}", first_name=name, last_name="K", academic_year_id="ay", class_id=str(cls.id), section_id=str(sec.id))
        await s.insert()
        studs.append(s)
    g = Guardian(school_id=SCHOOL, full_name="Parent", phone="9", student_ids=[str(studs[0].id)])
    await g.insert()
    await mk_user(IDS["principal"], Role.PRINCIPAL)
    await mk_user(IDS["admin"], Role.SCHOOL_ADMIN)
    await mk_user(IDS["teacher_u"], Role.TEACHER, teacher_id=str(teacher.id))
    await mk_user(IDS["parent_u"], Role.PARENT, guardian_id=str(g.id))
    g2 = Guardian(school_id=SCHOOL, full_name="Other parent", phone="8", student_ids=[str(studs[1].id)])
    await g2.insert()
    await mk_user(IDS["other_parent_u"], Role.PARENT, guardian_id=str(g2.id))
    exam = Exam(school_id=SCHOOL, academic_year_id="ay", name="Term 1", start_date=TODAY, end_date=TODAY, class_ids=[str(cls.id)])
    await exam.insert()
    es = ExamSubject(school_id=SCHOOL, exam_id=str(exam.id), class_id=str(cls.id), subject_id=str(subj.id), max_marks=100, pass_marks=40)
    await es.insert()
    return dict(cls=cls, sec=sec, subj=subj, teacher=teacher, studs=studs, es=es, exam=exam)


async def put_marks(w, values):
    marks = []
    for s, v in zip(w["studs"], values):
        if v is None:
            continue
        m = Mark(school_id=SCHOOL, exam_id=str(w["exam"].id), exam_subject_id=str(w["es"].id), student_id=str(s.id), marks_obtained=v, entered_by="t")
        await m.insert()
        marks.append(m)
    return marks


@pytest.mark.asyncio
async def test_low_marks_tell_parent_teacher_and_principal_once(world):
    marks = await put_marks(world, [30, None, None])
    assert await progress_service.on_marks_entered(world["es"], marks) == 3
    assert (await titles(IDS["parent_u"]))[0].startswith("Low marks: Asha") and (await titles(IDS["teacher_u"]))[0].startswith("Low marks: Asha K")
    assert (await titles(IDS["principal"]))[0].startswith("Low marks: Asha K")
    assert await titles(IDS["other_parent_u"]) == []  # another child's parent hears nothing
    assert await progress_service.on_marks_entered(world["es"], marks) == 0  # the same marks are not announced twice


@pytest.mark.asyncio
async def test_good_marks_and_a_sharp_drop(world):
    first = await put_marks(world, [90, None, None])
    await progress_service.on_marks_entered(world["es"], first)
    assert (await titles(IDS["parent_u"])) == ["Well done, Asha!"] and await titles(IDS["principal"]) == []  # good news is not for the principal
    es2 = ExamSubject(school_id=SCHOOL, exam_id=str(world["exam"].id), class_id=str(world["cls"].id), subject_id=str(world["subj"].id), max_marks=100, pass_marks=40)
    await es2.insert()
    m = Mark(school_id=SCHOOL, exam_id=str(world["exam"].id), exam_subject_id=str(es2.id), student_id=str(world["studs"][0].id), marks_obtained=55, entered_by="t")
    await m.insert()
    await progress_service.on_marks_entered(es2, [m])  # 90% earlier, 55% now: above the pass mark but down 35 points
    assert any(t.startswith("Marks have dropped") for t in await titles(IDS["parent_u"])) and any(t.startswith("Marks have dropped") for t in await titles(IDS["principal"]))


@pytest.mark.asyncio
async def test_entering_marks_through_the_api_raises_the_alert(client, world):
    override_current_user(make_current_user(Role.TEACHER, SCHOOL, user_id=IDS["teacher_u"], teacher_id=str(world["teacher"].id)))
    r = await client.post(f"/api/v1/exams/subjects/{world['es'].id}/marks", json={"marks": [{"student_id": str(world["studs"][0].id), "marks_obtained": 20}]})
    assert r.status_code in (200, 201), r.text
    assert (await titles(IDS["parent_u"]))[0].startswith("Low marks")


@pytest.mark.asyncio
async def test_ai_homework_score_alerts(world):
    hw = Homework(school_id=SCHOOL, section_id=str(world["sec"].id), subject_id=str(world["subj"].id), teacher_id=str(world["teacher"].id), title="Fractions",
                  assigned_date=TODAY, due_date=TODAY)
    await hw.insert()
    sub = HomeworkSubmission(school_id=SCHOOL, homework_id=str(hw.id), student_id=str(world["studs"][0].id), status=HomeworkSubmissionStatus.SUBMITTED)
    await sub.insert()
    val = HomeworkValidation(school_id=SCHOOL, homework_id=str(hw.id), student_id=str(world["studs"][0].id), submission_id=str(sub.id), total_score=3, max_score=10,
                             percentage=30, grade="D", overall_feedback="x")
    assert await progress_service.on_homework_scored(sub, val) == 3
    assert (await titles(IDS["principal"]))[0].startswith("Low homework score")
    assert await progress_service.on_homework_scored(sub, val) == 0  # once per submission, whatever the language it was marked in


@pytest.mark.asyncio
async def test_scan_low_attendance_and_overdue_homework(world):
    s = world["studs"][0]
    for d, status in ((1, "PRESENT"), (2, "ABSENT"), (5, "ABSENT"), (6, "ABSENT"), (7, "PRESENT"), (8, "PRESENT")):
        await StudentAttendance(school_id=SCHOOL, section_id=str(world["sec"].id), student_id=str(s.id), date=dt.date(2026, 10, d), status=AttendanceStatus(status), marked_by="t").insert()
    hw = Homework(school_id=SCHOOL, section_id=str(world["sec"].id), subject_id=str(world["subj"].id), teacher_id=str(world["teacher"].id), title="Fractions",
                  assigned_date=TODAY - dt.timedelta(days=6), due_date=TODAY - dt.timedelta(days=2))
    await hw.insert()
    await HomeworkSubmission(school_id=SCHOOL, homework_id=str(hw.id), student_id=str(s.id)).insert()  # pending, past its due date
    out = await progress_service.scan_students(SCHOOL, TODAY)
    assert out["low_attendance"] == 1 and out["overdue_homework"] == 1
    parent = await titles(IDS["parent_u"])
    assert any(t.startswith("Low attendance") for t in parent) and any(t.startswith("Homework not handed in") for t in parent)
    assert any(t.startswith("Low attendance") for t in await titles(IDS["teacher_u"]))
    assert (await titles(IDS["principal"]))[0].startswith("Student progress digest")  # the principal gets one digest, not one per event
    again = await progress_service.scan_students(SCHOOL, TODAY)
    assert again["low_attendance"] == 0 and again["overdue_homework"] == 0 and len(await titles(IDS["parent_u"])) == len(parent)


@pytest.mark.asyncio
async def test_scan_teacher_performance_goes_to_the_principal(world):
    await put_marks(world, [30, 35, 28])  # a weak class
    old = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=6)
    hw = Homework(school_id=SCHOOL, section_id=str(world["sec"].id), subject_id=str(world["subj"].id), teacher_id=str(world["teacher"].id), title="Old task",
                  assigned_date=TODAY - dt.timedelta(days=20), due_date=TODAY - dt.timedelta(days=15))
    await hw.insert()
    await HomeworkSubmission(school_id=SCHOOL, homework_id=str(hw.id), student_id=str(world["studs"][0].id), status=HomeworkSubmissionStatus.SUBMITTED, submitted_at=old).insert()
    await TimetableSlot(school_id=SCHOOL, section_id=str(world["sec"].id), day_of_week=0, period_number=1, start_time="09:00:00", end_time="09:40:00",
                        subject_id=str(world["subj"].id), teacher_id=str(world["teacher"].id)).insert()  # Mondays; nobody marked attendance
    for _ in range(2):
        await Ticket(school_id=SCHOOL, ticket_no="T", raised_by_user_id="u", raised_by_name="n", raised_by_role="STUDENT", teacher_id=str(world["teacher"].id),
                     subject="s", description="d").insert()
    out = await progress_service.scan_teachers(SCHOOL, TODAY)
    assert out["low_class_results"] == 1 and out["homework_not_set"] == 1 and out["feedback_pending"] == 1
    assert out["attendance_not_marked"] >= 1 and out["tickets_about_teacher"] == 1
    got = await titles(IDS["principal"])
    for prefix in ("Low class result", "No homework assigned", "Homework waiting for feedback", "Attendance not marked", "Tickets about a teacher"):
        assert any(t.startswith(prefix) for t in got), (prefix, got)
    assert await titles(IDS["parent_u"]) == [] and await titles(IDS["teacher_u"]) == []  # this is for the principal only
    assert sum((await progress_service.scan_teachers(SCHOOL, TODAY)).values()) == 0  # nothing repeats


@pytest.mark.asyncio
async def test_weekly_summary_once_per_week_for_parent_teacher_and_principal(world):
    out = await progress_service.weekly_summary(SCHOOL, TODAY)
    assert out == {"parents": 2, "teachers": 1, "principal": 1}
    assert await titles(IDS["parent_u"]) == ["Weekly progress summary"] and await titles(IDS["teacher_u"]) == ["Weekly teaching summary"]
    assert await titles(IDS["principal"]) == ["Weekly school summary"]
    assert await progress_service.weekly_summary(SCHOOL, TODAY) == {"parents": 0, "teachers": 0, "principal": 0}


@pytest.mark.asyncio
async def test_scan_endpoint_roles(client, world):
    override_current_user(make_current_user(Role.PRINCIPAL, SCHOOL, user_id=IDS["principal"]))
    r = await client.post("/api/v1/progress/scan", params={"summary": "true"})
    assert r.status_code == 200 and set(r.json()) == {"students", "teachers", "weekly_summary"}
    override_current_user(make_current_user(Role.TEACHER, SCHOOL, user_id=IDS["teacher_u"], teacher_id=str(world["teacher"].id)))
    assert (await client.post("/api/v1/progress/scan")).status_code == 403
    override_current_user(make_current_user(Role.SUPER_ADMIN, None, user_id="000000000000000000000599"))
    assert "schools" in (await client.post("/api/v1/progress/scan")).json()
