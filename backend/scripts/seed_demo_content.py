"""Richer sample data for the demo school, so every screen has something to show.

Called from seed_sample_data.seed_all() after the accounts exist. Idempotent: if the school already
has homework it assumes this content was seeded and does nothing.
"""

from datetime import date, datetime, time, timedelta, timezone

from app.core.enums import (
    AttendanceStatus,
    CalendarEventType,
    FeeFrequency,
    HomeworkSubmissionStatus,
    InvoiceStatus,
    PaymentMethod,
    PaymentStatus,
    Role,
    StudentStatus,
    SyllabusStatus,
    TeacherStatus,
)
from app.core.security import hash_password
from app.models.academic import CalendarEvent, Class, Section, Subject, TimetableSlot
from app.models.attendance import StaffAttendance, StudentAttendance
from app.models.exam import Exam, ExamSubject, Mark
from app.models.fee import FeeAssignment, FeeCategory, FeeStructure, Invoice, Payment
from app.models.guardian import Guardian
from app.models.homework import Homework, HomeworkSubmission
from app.models.leave import LeaveRequest, LeaveStatus, LeaveType
from app.models.library import Book
from app.models.notification import Notification, NotificationPriority, NotificationType
from app.models.student import Student
from app.models.syllabus import Chapter, Syllabus
from app.models.teacher import Teacher
from app.models.tenant import Tenant
from app.models.transport import Route, StudentTransport, Vehicle
from app.models.user import User
from app.models.academic import AcademicYear

STUDENT_NAMES = [
    ("Priya", "Sharma", "F"), ("Rohan", "Mehta", "M"), ("Ananya", "Iyer", "F"), ("Kabir", "Singh", "M"),
    ("Diya", "Nair", "F"), ("Arjun", "Reddy", "M"), ("Ishita", "Gupta", "F"), ("Vihaan", "Joshi", "M"),
    ("Saanvi", "Rao", "F"), ("Reyansh", "Menon", "M"), ("Myra", "Kapoor", "F"),
]
EXTRA_TEACHERS = [
    ("Rahul", "Verma", "Physics"), ("Sunita", "Devi", "English"), ("Amit", "Joshi", "Chemistry"),
]


async def seed_demo_content(school_id: str) -> None:
    if await Homework.find(Homework.school_id == school_id).count() > 0:
        print("Demo content already present")
        return

    tenant = await Tenant.get(school_id)
    admin = await User.find_one(User.school_id == school_id, User.role == Role.SCHOOL_ADMIN)
    admin_id = str(admin.id) if admin else "system"
    admin_name = admin.full_name if admin else "Administrator"
    year = await AcademicYear.find_one(AcademicYear.school_id == school_id, AcademicYear.is_current == True)  # noqa: E712
    year_id = str(year.id)
    class10 = await Class.find_one(Class.school_id == school_id, Class.name == "Class 10")
    section_a = await Section.find_one(Section.school_id == school_id, Section.class_id == str(class10.id), Section.name == "A")
    section_b = await Section.find_one(Section.school_id == school_id, Section.class_id == str(class10.id), Section.name == "B")
    if section_b is None:
        section_b = Section(school_id=school_id, class_id=str(class10.id), name="B", room_no="102")
        await section_b.insert()
    subjects = {s.code: s for s in await Subject.find(Subject.school_id == school_id).to_list()}
    demo_teacher = await Teacher.find_one(Teacher.school_id == school_id, Teacher.employee_no == "DEMO-TCH-001")
    demo_student = await Student.find_one(Student.school_id == school_id, Student.admission_no == "DEMO-STU-001")
    demo_guardian = await Guardian.get(demo_student.primary_guardian_id) if demo_student.primary_guardian_id else None
    today = date.today()

    # ---- more teachers
    teachers = [demo_teacher]
    for i, (first, last, subject_name) in enumerate(EXTRA_TEACHERS, start=2):
        t = Teacher(
            school_id=school_id,
            employee_no=f"DEMO-TCH-00{i}",
            first_name=first,
            last_name=last,
            phone=f"98765432{20 + i}",
            email=f"{first.lower()}.{last.lower()}@demo.cogniitec.com",
            qualifications=["M.Sc.", "B.Ed."],
            subject_ids=[str(next((s.id for s in subjects.values() if s.name == subject_name), demo_teacher.subject_ids[0]))],
            assigned_class_ids=[str(class10.id)],
            joining_date=date(2021, 6, 1),
            status=TeacherStatus.ACTIVE,
        )
        await t.insert()
        teachers.append(t)

    # ---- more students (section A and B), roll numbers, guardians
    students_a = [demo_student]
    students_b: list[Student] = []
    for idx, (first, last, gender) in enumerate(STUDENT_NAMES, start=2):
        in_a = idx <= 6
        st = Student(
            school_id=school_id,
            admission_no=f"DEMO-STU-{idx:03d}",
            first_name=first,
            last_name=last,
            dob=date(2010, (idx % 12) + 1, 10),
            gender=gender,
            academic_year_id=year_id,
            class_id=str(class10.id),
            section_id=str((section_a if in_a else section_b).id),
            roll_number=str(idx),
            admission_date=date(2024, 4, 1),
            status=StudentStatus.ACTIVE,
            phone=f"98765{40000 + idx}",
            address="Demo City",
        )
        await st.insert()
        (students_a if in_a else students_b).append(st)
    all_students = students_a + students_b

    # ---- timetable for sections A and B (Mon-Fri, 5 periods)
    slots_plan = [("MATH", 0), ("ENG", 1), ("PHY", 2), ("CHEM", 0), ("HIN", 1)]
    starts = ["08:30:00", "09:20:00", "10:30:00", "11:20:00", "12:10:00"]
    ends = ["09:15:00", "10:05:00", "11:15:00", "12:05:00", "12:55:00"]
    for section in (section_a, section_b):
        for day in range(5):
            for period in range(5):
                code, teacher_idx = slots_plan[(period + day) % len(slots_plan)]
                await TimetableSlot(
                    school_id=school_id,
                    section_id=str(section.id),
                    day_of_week=day,
                    period_number=period + 1,
                    start_time=starts[period],
                    end_time=ends[period],
                    subject_id=str(subjects[code].id),
                    teacher_id=str(teachers[teacher_idx].id),
                ).insert()

    # ---- attendance for the last 14 days (skip Sundays)
    for back in range(0, 14):
        day = today - timedelta(days=back)
        if day.weekday() == 6:
            continue
        for n, st in enumerate(all_students):
            status = AttendanceStatus.PRESENT
            if (n + back) % 11 == 0:
                status = AttendanceStatus.ABSENT
            elif (n * 3 + back) % 13 == 0:
                status = AttendanceStatus.LATE
            await StudentAttendance(
                school_id=school_id,
                section_id=st.section_id,
                student_id=str(st.id),
                date=day,
                status=status,
                marked_by=str(teachers[0].id),
            ).insert()
        for t in teachers:
            await StaffAttendance(
                school_id=school_id, teacher_id=str(t.id), date=day, status=AttendanceStatus.PRESENT, marked_by=admin_id
            ).insert()

    # ---- homework
    hw_plan = [
        ("Algebra practice set 4", "MATH", 2, "Exercises 4.1 to 4.3 from the textbook"),
        ("Essay: My favourite season", "ENG", 3, "Write 300 words with a clear introduction and conclusion"),
        ("Pendulum lab report", "PHY", 4, "Record observations and plot the graph"),
        ("Periodic table revision", "CHEM", 6, "Memorise the first 30 elements"),
    ]
    for title, code, due_in, desc in hw_plan:
        hw = Homework(
            school_id=school_id,
            section_id=str(section_a.id),
            subject_id=str(subjects[code].id),
            teacher_id=str(teachers[0].id),
            title=title,
            description=desc,
            assigned_date=today - timedelta(days=1),
            due_date=today + timedelta(days=due_in),
        )
        await hw.insert()
        for st in students_a:
            done = st.admission_no != "DEMO-STU-001" and int(st.roll_number or 0) % 2 == 0
            await HomeworkSubmission(
                school_id=school_id,
                homework_id=str(hw.id),
                student_id=str(st.id),
                status=HomeworkSubmissionStatus.SUBMITTED if done else HomeworkSubmissionStatus.PENDING,
                submitted_at=datetime.now(timezone.utc) if done else None,
            ).insert()

    # ---- exams with marks
    exam_past = Exam(school_id=school_id, academic_year_id=year_id, name="Unit Test 1", term="Term 1",
                     start_date=today - timedelta(days=40), end_date=today - timedelta(days=36), class_ids=[str(class10.id)])
    exam_next = Exam(school_id=school_id, academic_year_id=year_id, name="Mid-Term Examination", term="Term 1",
                     start_date=today + timedelta(days=15), end_date=today + timedelta(days=24), class_ids=[str(class10.id)])
    await exam_past.insert()
    await exam_next.insert()
    for exam in (exam_past, exam_next):
        for code in ("MATH", "ENG", "PHY", "CHEM"):
            es = ExamSubject(school_id=school_id, exam_id=str(exam.id), class_id=str(class10.id), subject_id=str(subjects[code].id),
                             max_marks=100, pass_marks=35, exam_date=exam.start_date)
            await es.insert()
            if exam is exam_past:
                for n, st in enumerate(all_students):
                    await Mark(school_id=school_id, exam_id=str(exam.id), exam_subject_id=str(es.id), student_id=str(st.id),
                               marks_obtained=float(55 + (n * 7 + len(code) * 5) % 43), entered_by=str(teachers[0].id)).insert()

    # ---- fees: categories, structures, assignments, invoices and payments
    tuition = FeeCategory(school_id=school_id, name="Tuition Fee", description="Quarterly tuition")
    lab = FeeCategory(school_id=school_id, name="Lab Fee", description="Science lab charges")
    await tuition.insert()
    await lab.insert()
    fs_t = FeeStructure(school_id=school_id, academic_year_id=year_id, class_id=str(class10.id), category_id=str(tuition.id), amount=25000, frequency=FeeFrequency.QUARTERLY)
    fs_l = FeeStructure(school_id=school_id, academic_year_id=year_id, class_id=str(class10.id), category_id=str(lab.id), amount=5000, frequency=FeeFrequency.QUARTERLY)
    await fs_t.insert()
    await fs_l.insert()
    for n, st in enumerate(all_students):
        assignments = []
        for fs in (fs_t, fs_l):
            fa = FeeAssignment(school_id=school_id, student_id=str(st.id), fee_structure_id=str(fs.id), final_amount=fs.amount)
            await fa.insert()
            assignments.append(str(fa.id))
        plan = [(-60, 30000, 30000), (-5, 30000, 30000 if n % 3 == 0 else (15000 if n % 3 == 1 else 0)), (35, 30000, 0)]
        for due_offset, total, paid in plan:
            status = InvoiceStatus.PAID if paid == total else (InvoiceStatus.PARTIALLY_PAID if paid else (InvoiceStatus.OVERDUE if due_offset < 0 else InvoiceStatus.PENDING))
            inv = Invoice(school_id=school_id, student_id=str(st.id), academic_year_id=year_id, fee_assignment_ids=assignments,
                          total_amount=total, amount_paid=paid, due_date=today + timedelta(days=due_offset), status=status)
            await inv.insert()
            if paid:
                await Payment(school_id=school_id, invoice_id=str(inv.id), student_id=str(st.id), amount=paid,
                              method=PaymentMethod.CASH if n % 2 else PaymentMethod.BANK_TRANSFER, status=PaymentStatus.SUCCESS,
                              paid_at=datetime.now(timezone.utc) - timedelta(days=max(abs(due_offset) - 3, 1)),
                              recorded_by=admin_id).insert()

    # ---- announcements and calendar
    for title, body, ntype, prio in [
        ("Mid-Term schedule released", "The mid-term timetable for Class 10 is now on the Exams page.", NotificationType.ANNOUNCEMENT, NotificationPriority.HIGH),
        ("Parent-Teacher meeting", "PTM is on Saturday from 10 AM to 1 PM. Please attend with your ward.", NotificationType.EVENT, NotificationPriority.NORMAL),
        ("Fee reminder", "The second instalment is due soon. Please clear dues to avoid late fees.", NotificationType.REMINDER, NotificationPriority.HIGH),
        ("Library week", "Visit the library this week for the book fair and reading challenge.", NotificationType.NOTICE, NotificationPriority.LOW),
    ]:
        await Notification(school_id=school_id, title=title, content=body, notification_type=ntype, priority=prio,
                           created_by=admin_id, created_by_name=admin_name).insert()
    for offset, title, etype, desc in [
        (3, "Parent-Teacher Meeting", CalendarEventType.EVENT, "Term review with parents"),
        (15, "Mid-Term Examination begins", CalendarEventType.EXAM, "Classes 6 to 10"),
        (21, "Diwali Break", CalendarEventType.HOLIDAY, None),
        (40, "Annual Sports Day", CalendarEventType.EVENT, "Inter-house meet"),
    ]:
        await CalendarEvent(school_id=school_id, academic_year_id=year_id, title=title, description=desc,
                            event_date=today + timedelta(days=offset), event_type=etype).insert()

    # ---- syllabus
    for code, title, chapters in [
        ("MATH", "Mathematics - Class 10", ["Real Numbers", "Polynomials", "Linear Equations", "Quadratic Equations", "Trigonometry"]),
        ("PHY", "Physics - Class 10", ["Light", "Electricity", "Magnetic Effects", "Sources of Energy"]),
    ]:
        await Syllabus(
            school_id=school_id, academic_year_id=year_id, class_id=str(class10.id), subject_id=str(subjects[code].id),
            title=title, description=f"Full-year plan for {title}", status=SyllabusStatus.PUBLISHED,
            chapters=[Chapter(name=c, order=i + 1) for i, c in enumerate(chapters)], created_by=admin_id,
        ).insert()

    # ---- library and transport
    for title, author, category, copies in [
        ("NCERT Mathematics 10", "NCERT", "Textbook", 12), ("Wings of Fire", "A. P. J. Abdul Kalam", "Biography", 4),
        ("Concepts of Physics", "H. C. Verma", "Reference", 6), ("The Jungle Book", "Rudyard Kipling", "Fiction", 5),
        ("Oxford English Dictionary", "Oxford", "Reference", 3),
    ]:
        await Book(school_id=school_id, title=title, author=author, category=category, total_copies=copies,
                   available_copies=copies, rack_number="R1").insert()
    vehicle = Vehicle(school_id=school_id, vehicle_no="KA-01-AB-1234", vehicle_type="BUS", capacity=40, driver_name="Ramesh Kumar",
                      driver_phone="9876500011", insurance_expiry=today + timedelta(days=200), fitness_expiry=today + timedelta(days=120))
    await vehicle.insert()
    route = Route(school_id=school_id, route_name="North Loop", route_code="R-01", vehicle_id=str(vehicle.id), vehicle_no=vehicle.vehicle_no,
                  stops=[{"name": "Lake View", "pickup_time": "07:00", "drop_time": "15:30", "fare": 900},
                         {"name": "Market Road", "pickup_time": "07:15", "drop_time": "15:15", "fare": 800}])
    await route.insert()
    for st in all_students[:4]:
        await StudentTransport(school_id=school_id, student_id=str(st.id), student_name=st.full_name, student_class="Class 10",
                               route_id=str(route.id), route_name=route.route_name, stop_name="Lake View", monthly_fee=900,
                               academic_year_id=year_id).insert()

    # ---- one pending leave request from a teacher
    await LeaveRequest(school_id=school_id, requester_type="teacher", requester_id=str(teachers[1].id), requester_name=teachers[1].full_name,
                       leave_type=LeaveType.CASUAL, start_date=today + timedelta(days=5), end_date=today + timedelta(days=6),
                       reason="Family function", status=LeaveStatus.PENDING).insert()

    print(f"Seeded demo content: {len(all_students)} students, {len(teachers)} teachers, timetable, attendance, homework, exams, fees, notices")
