import datetime as dt

import pytest

from app.core.enums import HomeworkSubmissionStatus, InvoiceStatus, Role, StudentStatus
from app.models.academic import Subject
from app.models.fee import Invoice
from app.models.guardian import Guardian
from app.models.homework import Homework, HomeworkSubmission
from app.models.student import Student
from app.services.chatbot_service import _money, match_intent
from tests.conftest import make_current_user, override_current_user

SCHOOL = "5c0000000000000000000001"


@pytest.mark.parametrize(
    "message,intent",
    [
        ("hello there", "greeting"),
        ("Which subjects?", "unknown"),  # "hi" inside "which" must not read as a greeting
        ("what homework do I have", "homework"),
        ("homework due tomorrow", "homework"),  # homework wins over the generic 'due'
        ("any fees due?", "fees"),
        ("who is absent today", "attendance"),
        ("show my timetable", "timetable"),
        ("upcoming exams", "exams"),
        ("any announcements", "notifications"),
        ("how many students are there", "school_info"),
    ],
)
def test_match_intent(message, intent):
    assert match_intent(message) == intent


def test_money_uses_indian_grouping():
    assert _money(0) == "₹0"
    assert _money(999) == "₹999"
    assert _money(12345) == "₹12,345"
    assert _money(1234567) == "₹12,34,567"


async def _student_with_homework():
    subject = Subject(school_id=SCHOOL, name="Mathematics", code="MATH")
    await subject.insert()
    student = Student(
        school_id=SCHOOL, admission_no="C1", first_name="Chat", last_name="Kid", academic_year_id="ay", class_id="c", section_id="s",
        status=StudentStatus.ACTIVE,
    )
    await student.insert()
    hw = Homework(
        school_id=SCHOOL, section_id="s", subject_id=str(subject.id), teacher_id="t", title="Fractions worksheet",
        assigned_date=dt.date.today(), due_date=dt.date.today() + dt.timedelta(days=2),
    )
    await hw.insert()
    await HomeworkSubmission(school_id=SCHOOL, homework_id=str(hw.id), student_id=str(student.id), status=HomeworkSubmissionStatus.PENDING).insert()
    return student


@pytest.mark.asyncio
async def test_student_assistant_lists_real_pending_homework_and_fees(client):
    student = await _student_with_homework()
    await Invoice(
        school_id=SCHOOL, student_id=str(student.id), academic_year_id="ay", total_amount=30000, amount_paid=10000,
        due_date=dt.date.today() + dt.timedelta(days=9), status=InvoiceStatus.PARTIALLY_PAID,
    ).insert()
    override_current_user(make_current_user(Role.STUDENT, SCHOOL, student_id=str(student.id)))

    hw = (await client.post("/api/v1/ai/student", json={"message": "what homework do I have?"})).json()["response"]
    assert "Fractions worksheet" in hw and "Mathematics" in hw

    fees = (await client.post("/api/v1/ai/student", json={"message": "any fees due?"})).json()["response"]
    assert "₹20,000" in fees  # outstanding

    other_role = (await client.post("/api/v1/ai/student", json={"message": "how many students are there"})).json()["response"]
    assert "isn't available" in other_role


@pytest.mark.asyncio
async def test_parent_assistant_only_sees_own_children(client):
    child = await _student_with_homework()
    stranger = Student(
        school_id=SCHOOL, admission_no="C2", first_name="Other", last_name="Kid", academic_year_id="ay", class_id="c", section_id="s",
    )
    await stranger.insert()
    guardian = Guardian(school_id=SCHOOL, full_name="Pat Parent", relation="Mother", phone="9000000009", student_ids=[str(child.id)])
    await guardian.insert()
    override_current_user(make_current_user(Role.PARENT, SCHOOL, guardian_id=str(guardian.id)))

    text = (await client.post("/api/v1/ai/parent", json={"message": "homework"})).json()["response"]
    assert "Chat Kid" in text and "Fractions worksheet" in text
    assert "Other Kid" not in text


@pytest.mark.asyncio
async def test_principal_assistant_summarises_the_school(client):
    await _student_with_homework()
    override_current_user(make_current_user(Role.PRINCIPAL, SCHOOL))
    body = (await client.post("/api/v1/ai/principal", json={"message": "school summary"})).json()["response"]
    assert "Students enrolled: 1" in body
