"""Progress alerts.

Students: low or sharply falling marks, low attendance, homework not handed in or marked low by the AI -> the student's parents,
teachers and the principal; good progress is noted too. Teachers: low class results, homework not set or left without feedback,
attendance not marked, tickets raised about them -> the principal. A weekly summary goes to every parent, teacher and the principal.

Everything is in-app, sent once per event (dedupe keys), and all thresholds are settings (PROGRESS_*)."""
import logging
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from statistics import mean

from app.core.config import get_settings
from app.core.enums import AttendanceStatus, HomeworkSubmissionStatus, StudentStatus
from app.models.academic import Class, ClassSubjectTeacher, Section, Subject, TimetableSlot
from app.models.attendance import StudentAttendance
from app.models.exam import Exam, ExamSubject, Mark
from app.models.guardian import Guardian
from app.models.homework import Homework, HomeworkSubmission
from app.models.homework_validation import HomeworkValidation
from app.models.notification import Notification
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.tenant import Tenant
from app.models.ticket import Ticket, TicketStatus
from app.models.user import User
from app.services import recipients
from app.services.academic_keys import equivalent_class_ids
from app.services.notify import notify_users

logger = logging.getLogger("progress")
_ATTENDED = {AttendanceStatus.PRESENT, AttendanceStatus.LATE, AttendanceStatus.EXCUSED}


def _pct(x: float, total: float) -> float:
    return round(100 * x / total, 1) if total else 0.0


async def _where(student: Student) -> str:
    cls = await Class.get(student.class_id) if len(student.class_id) == 24 else None
    sec = await Section.get(student.section_id) if len(student.section_id) == 24 else None
    return f"{student.full_name} ({cls.name if cls else 'class'}{' - ' + sec.name if sec else ''})"


async def _tell(student: Student, *, parent: tuple[str, str], teacher: tuple[str, str], principal: tuple[str, str] | None, category: str,
                key: str, priority: str, subject_id: str | None = None, teacher_ids: list[str] | None = None) -> int:
    """Send one event to the student's parents, teachers (and optionally the principal), each once."""
    sid = student.school_id
    sent = 0
    t_ids = await recipients.teacher_user_ids(sid, teacher_ids if teacher_ids is not None else await recipients.teachers_of(student, subject_id))
    sent += await notify_users(sid, await recipients.parent_ids(sid, str(student.id)), parent[0], parent[1], category=category, priority=priority,
                               link="/parent", dedupe_key=f"{key}:parent")
    sent += await notify_users(sid, t_ids, teacher[0], teacher[1], category=category, priority=priority, link="/teacher", dedupe_key=f"{key}:teacher")
    if principal:
        sent += await notify_users(sid, await recipients.principal_ids(sid), principal[0], principal[1], category=category, priority=priority,
                                   link="/principal/students", dedupe_key=f"{key}:principal")
    return sent


# ------------------------------------------------------------------ instant: marks and homework scores

async def on_marks_entered(exam_subject: ExamSubject, marks: list[Mark]) -> int:
    """After marks are saved: tell parents, the subject's teachers and (for concerns) the principal."""
    s = get_settings()
    subject = await Subject.get(exam_subject.subject_id) if len(exam_subject.subject_id) == 24 else None
    exam = await Exam.get(exam_subject.exam_id) if len(exam_subject.exam_id) == 24 else None
    what = f"{subject.name if subject else 'a subject'}{' - ' + exam.name if exam else ''}"
    sent = 0
    for m in marks:
        student = await Student.get(m.student_id)
        if student is None or exam_subject.max_marks <= 0:
            continue
        pct = _pct(m.marks_obtained, exam_subject.max_marks)
        scored = f"{m.marks_obtained:g}/{exam_subject.max_marks:g} ({pct:g}%)"
        earlier = [x for x in await Mark.find({"school_id": m.school_id, "student_id": m.student_id}).to_list() if x.exam_subject_id != str(exam_subject.id)]
        earlier_pcts = []
        for x in earlier:
            es = await ExamSubject.get(x.exam_subject_id)
            if es and es.max_marks > 0:
                earlier_pcts.append(_pct(x.marks_obtained, es.max_marks))
        who = await _where(student)
        key = f"marks:{exam_subject.id}:{m.student_id}:{m.marks_obtained:g}"
        if pct < s.progress_pass_percent:
            sent += await _tell(student, parent=(f"Low marks: {student.first_name} in {what}", f"{student.first_name} scored {scored}. Extra support may help."),
                                teacher=(f"Low marks: {student.full_name}", f"{who} scored {scored} in {what}."),
                                principal=(f"Low marks: {student.full_name}", f"{who} scored {scored} in {what}."),
                                category="progress", key=f"{key}:low", priority="HIGH", subject_id=exam_subject.subject_id)
        elif earlier_pcts and mean(earlier_pcts) - pct >= s.progress_drop_points:
            avg = mean(earlier_pcts)
            sent += await _tell(student, parent=(f"Marks have dropped: {student.first_name}", f"{student.first_name} scored {scored} in {what}, down from an average of {avg:.0f}%."),
                                teacher=(f"Marks have dropped: {student.full_name}", f"{who} scored {scored} in {what}, down from an average of {avg:.0f}%."),
                                principal=(f"Marks have dropped: {student.full_name}", f"{who} scored {scored} in {what}, down from an average of {avg:.0f}%."),
                                category="progress", key=f"{key}:drop", priority="HIGH", subject_id=exam_subject.subject_id)
        elif pct >= s.progress_good_percent:
            sent += await _tell(student, parent=(f"Well done, {student.first_name}!", f"{student.first_name} scored {scored} in {what}."),
                                teacher=(f"Good result: {student.full_name}", f"{who} scored {scored} in {what}."), principal=None,
                                category="progress", key=f"{key}:good", priority="LOW", subject_id=exam_subject.subject_id)
    return sent


async def on_homework_scored(submission: HomeworkSubmission, validation: HomeworkValidation) -> int:
    """After the AI marks a homework: a low score goes to parents, the homework's teacher and the principal; a high one is a good note."""
    s = get_settings()
    student = await Student.get(submission.student_id)
    homework = await Homework.get(submission.homework_id)
    if student is None or homework is None:
        return 0
    pct = validation.percentage
    who = await _where(student)
    key = f"hw-score:{submission.id}"
    t_ids = [homework.teacher_id]
    if pct < s.progress_homework_score_percent:
        msg = f"scored {pct:g}% on \"{homework.title}\" (AI marking)."
        return await _tell(student, parent=(f"Homework needs attention: {student.first_name}", f"{student.first_name} {msg} Please look at the feedback together."),
                           teacher=(f"Low homework score: {student.full_name}", f"{who} {msg}"),
                           principal=(f"Low homework score: {student.full_name}", f"{who} {msg}"),
                           category="progress", key=f"{key}:low", priority="HIGH", teacher_ids=t_ids)
    if pct >= s.progress_good_percent:
        msg = f"scored {pct:g}% on \"{homework.title}\" (AI marking)."
        return await _tell(student, parent=(f"Great homework, {student.first_name}!", f"{student.first_name} {msg}"),
                           teacher=(f"Great homework: {student.full_name}", f"{who} {msg}"), principal=None,
                           category="progress", key=f"{key}:good", priority="LOW", teacher_ids=t_ids)
    return 0


# ------------------------------------------------------------------ scan: attendance, overdue homework

async def _active_students(school_id: str) -> dict[str, Student]:
    return {str(s.id): s for s in await Student.find({"school_id": school_id, "status": StudentStatus.ACTIVE.value}).to_list()}


async def scan_students(school_id: str, today: date | None = None) -> dict[str, int]:
    s = get_settings()
    today = today or date.today()
    students = await _active_students(school_id)
    counts = {"low_attendance": 0, "good_attendance": 0, "overdue_homework": 0}
    digest: list[str] = []

    # attendance: month to date, and the last full Mon-Sun week
    month_start = today.replace(day=1)
    records = await StudentAttendance.find({"school_id": school_id, "date": {"$gte": datetime.combine(month_start - timedelta(days=14), datetime.min.time())}}).to_list()
    by_student: dict[str, list[StudentAttendance]] = defaultdict(list)
    for r in records:
        by_student[r.student_id].append(r)
    last_week_end = today - timedelta(days=today.weekday() + 1)  # last Sunday
    last_week_start = last_week_end - timedelta(days=6)
    for sid, student in students.items():
        recs = by_student.get(sid, [])
        month = [r for r in recs if _d(r.date) >= month_start]
        if len(month) >= 5:
            attended = sum(1 if r.status in _ATTENDED else 0.5 if r.status == AttendanceStatus.HALF_DAY else 0 for r in month)
            pct = _pct(attended, len(month))
            if pct < s.progress_attendance_percent:
                who = await _where(student)
                if await _tell(student, parent=(f"Low attendance: {student.first_name}", f"{student.first_name}'s attendance this month is {pct:g}% ({len(month)} days recorded)."),
                               teacher=(f"Low attendance: {student.full_name}", f"{who}: attendance this month is {pct:g}%."), principal=None,
                               category="progress", key=f"att-low:{sid}:{month_start:%Y-%m}", priority="HIGH"):
                    counts["low_attendance"] += 1
                    digest.append(f"{student.full_name}: attendance {pct:g}%")
        week = [r for r in recs if last_week_start <= _d(r.date) <= last_week_end]
        if len(week) >= 4 and all(r.status in _ATTENDED for r in week):
            if await _tell(student, parent=(f"Full attendance: {student.first_name}", f"{student.first_name} attended every day last week."),
                           teacher=(f"Full attendance: {student.full_name}", f"{student.full_name} attended every day last week."), principal=None,
                           category="progress", key=f"att-good:{sid}:{last_week_start}", priority="LOW"):
                counts["good_attendance"] += 1

    # homework due in the last 14 days and still not handed in
    homeworks = await Homework.find({"school_id": school_id, "due_date": {"$lt": datetime.combine(today, datetime.min.time()), "$gte": datetime.combine(today - timedelta(days=14), datetime.min.time())}}).to_list()
    for hw in homeworks:
        pend = await HomeworkSubmission.find({"school_id": school_id, "homework_id": str(hw.id), "status": HomeworkSubmissionStatus.PENDING.value}).to_list()
        for sub in pend:
            student = students.get(sub.student_id)
            if student is None:
                continue
            who = await _where(student)
            if await _tell(student, parent=(f"Homework not handed in: {student.first_name}", f"\"{hw.title}\" was due on {_d(hw.due_date):%d %b} and has not been submitted."),
                           teacher=(f"Homework not handed in: {student.full_name}", f"{who} has not submitted \"{hw.title}\" (due {_d(hw.due_date):%d %b})."), principal=None,
                           category="progress", key=f"hw-overdue:{sub.id}", priority="NORMAL", teacher_ids=[hw.teacher_id]):
                counts["overdue_homework"] += 1
                digest.append(f"{student.full_name}: \"{hw.title}\" overdue")
    if digest:  # the principal gets one digest per day for these, not a message per student
        await notify_users(school_id, await recipients.principal_ids(school_id), f"Student progress digest ({len(digest)})",
                           "\n".join(digest[:25]) + (f"\n...and {len(digest) - 25} more" if len(digest) > 25 else ""), category="progress",
                           link="/principal/students", dedupe_key=f"digest:{today}:{len(digest)}")
    return counts


def _d(v) -> date:
    return v.date() if isinstance(v, datetime) else v


# ------------------------------------------------------------------ scan: teacher performance -> principal

async def _teachers_for_class_subject(school_id: str, class_id: str, subject_id: str) -> list[Teacher]:
    sections = [str(x.id) for x in await Section.find({"school_id": school_id, "class_id": {"$in": await equivalent_class_ids(school_id, class_id)}}).to_list()]
    ids = {c.teacher_id for c in await ClassSubjectTeacher.find({"school_id": school_id, "section_id": {"$in": sections}, "subject_id": subject_id}).to_list()}
    if not ids:
        assigned = await Teacher.find({"school_id": school_id, "assigned_class_ids": {"$in": await equivalent_class_ids(school_id, class_id)}}).to_list()
        return [t for t in assigned if subject_id in t.subject_ids] or assigned
    return [t for t in [await Teacher.get(i) for i in sorted(ids)] if t is not None]


async def scan_teachers(school_id: str, today: date | None = None) -> dict[str, int]:
    s = get_settings()
    today = today or date.today()
    principals = await recipients.principal_ids(school_id)
    counts = {"low_class_results": 0, "homework_not_set": 0, "feedback_pending": 0, "attendance_not_marked": 0, "tickets_about_teacher": 0}

    async def alert(title: str, text: str, key: str, priority: str = "HIGH") -> bool:
        return await notify_users(school_id, principals, title, text, category="teacher_performance", priority=priority, link="/principal/staff", dedupe_key=key)

    # class results: low average, or well below the rest of the school for the same exam
    subjects_by_exam: dict[str, list[tuple[ExamSubject, float]]] = defaultdict(list)
    for es in await ExamSubject.find({"school_id": school_id}).to_list():
        marks = await Mark.find({"school_id": school_id, "exam_subject_id": str(es.id)}).to_list()
        if len(marks) >= 3 and es.max_marks > 0:
            subjects_by_exam[es.exam_id].append((es, mean(_pct(m.marks_obtained, es.max_marks) for m in marks)))
    for exam_id, rows in subjects_by_exam.items():
        school_avg = mean(a for _, a in rows)
        exam = await Exam.get(exam_id) if len(exam_id) == 24 else None
        for es, avg in rows:
            low, gap = avg < s.progress_class_avg_percent, len(rows) > 1 and school_avg - avg >= s.progress_class_gap_points
            if not (low or gap):
                continue
            teachers = await _teachers_for_class_subject(school_id, es.class_id, es.subject_id)
            subj = await Subject.get(es.subject_id) if len(es.subject_id) == 24 else None
            cls = await Class.get(es.class_id) if len(es.class_id) == 24 else None
            names = ", ".join(t.full_name for t in teachers) or "no teacher recorded"
            why = f"class average {avg:.0f}%" + (f" (school average {school_avg:.0f}%)" if gap else "")
            if await alert(f"Low class result: {subj.name if subj else 'subject'}, {cls.name if cls else 'class'}",
                           f"{exam.name if exam else 'Exam'}: {why}. Teacher: {names}.", f"tp-class:{es.id}:{round(avg)}"):
                counts["low_class_results"] += 1

    # homework follow-through
    week_ago = today - timedelta(days=7)
    teachers = await Teacher.find({"school_id": school_id}).to_list()
    iso = today.isocalendar()
    for t in teachers:
        if not t.assigned_class_ids and not await ClassSubjectTeacher.find({"school_id": school_id, "teacher_id": str(t.id)}).count():
            continue
        made = await Homework.find({"school_id": school_id, "teacher_id": str(t.id), "assigned_date": {"$gte": datetime.combine(week_ago, datetime.min.time())}}).count()
        if made == 0 and today.weekday() < 5:
            if await alert(f"No homework assigned: {t.full_name}", f"{t.full_name} has not assigned any homework in the last 7 days.", f"tp-hw-none:{t.id}:{iso.year}-{iso.week}", "NORMAL"):
                counts["homework_not_set"] += 1
    cutoff = datetime.now(timezone.utc) - timedelta(days=s.progress_feedback_days)
    waiting: dict[str, list[HomeworkSubmission]] = defaultdict(list)
    for sub in await HomeworkSubmission.find({"school_id": school_id, "status": HomeworkSubmissionStatus.SUBMITTED.value}).to_list():
        at = sub.submitted_at
        if sub.teacher_feedback or at is None:
            continue
        if (at if at.tzinfo else at.replace(tzinfo=timezone.utc)) < cutoff:
            waiting[sub.homework_id].append(sub)
    for hw_id, subs in waiting.items():
        hw = await Homework.get(hw_id)
        if hw is None:
            continue
        t = await Teacher.get(hw.teacher_id) if len(hw.teacher_id) == 24 else None
        if await alert(f"Homework waiting for feedback: {t.full_name if t else 'teacher'}",
                       f"\"{hw.title}\": {len(subs)} submission(s) have waited more than {s.progress_feedback_days} days for the teacher's feedback.",
                       f"tp-hw-nofeedback:{hw_id}:{iso.year}-{iso.week}", "NORMAL"):
            counts["feedback_pending"] += 1

    # attendance not marked on a school day, for sections that have a timetable
    slots = await TimetableSlot.find({"school_id": school_id}).to_list()
    by_section_day: dict[tuple[str, int], set[str]] = defaultdict(set)
    for sl in slots:
        by_section_day[(sl.section_id, sl.day_of_week)].add(sl.teacher_id)
    for d in (today - timedelta(days=i) for i in range(1, 8)):
        if d.weekday() >= 5:
            continue
        for (section_id, dow), tids in by_section_day.items():
            if dow != d.weekday():
                continue
            if await StudentAttendance.find({"school_id": school_id, "section_id": section_id, "date": datetime.combine(d, datetime.min.time())}).count():
                continue
            if not await Student.find({"school_id": school_id, "section_id": section_id, "status": StudentStatus.ACTIVE.value}).count():
                continue
            names = ", ".join(t.full_name for t in [await Teacher.get(i) for i in sorted(tids) if len(i) == 24] if t)
            sec = await Section.get(section_id) if len(section_id) == 24 else None
            if await alert(f"Attendance not marked: {d:%a %d %b}", f"No attendance was marked for section {sec.name if sec else section_id} on {d:%A %d %b}. Teachers: {names or 'not recorded'}.",
                           f"tp-att:{section_id}:{d}", "NORMAL"):
                counts["attendance_not_marked"] += 1

    # tickets raised about a teacher (last 30 days, not closed)
    since = datetime.now(timezone.utc) - timedelta(days=30)
    per_teacher: dict[str, int] = defaultdict(int)
    for tk in await Ticket.find({"school_id": school_id, "teacher_id": {"$ne": None}, "status": {"$ne": TicketStatus.CLOSED.value}}).to_list():
        ts = tk.created_at if tk.created_at.tzinfo else tk.created_at.replace(tzinfo=timezone.utc)
        if ts >= since and tk.teacher_id:
            per_teacher[tk.teacher_id] += 1
    for tid, n in per_teacher.items():
        t = await Teacher.get(tid)
        if await alert(f"Tickets about a teacher: {t.full_name if t else tid}", f"{n} ticket(s) raised about {t.full_name if t else 'this teacher'} in the last 30 days.",
                       f"tp-tickets:{tid}:{n}", "HIGH" if n >= 2 else "NORMAL"):
            counts["tickets_about_teacher"] += 1
    return counts


# ------------------------------------------------------------------ weekly summary

async def weekly_summary(school_id: str, today: date | None = None) -> dict[str, int]:
    today = today or date.today()
    iso = today.isocalendar()
    wk = f"{iso.year}-{iso.week}"
    since = datetime.combine(today - timedelta(days=7), datetime.min.time())
    sent = {"parents": 0, "teachers": 0, "principal": 0}
    students = await _active_students(school_id)

    async def student_line(st: Student) -> str:
        recs = await StudentAttendance.find({"school_id": school_id, "student_id": str(st.id), "date": {"$gte": since}}).to_list()
        att = _pct(sum(1 if r.status in _ATTENDED else 0.5 if r.status == AttendanceStatus.HALF_DAY else 0 for r in recs), len(recs)) if recs else None
        mks = [m for m in await Mark.find({"school_id": school_id, "student_id": str(st.id)}).to_list() if m.updated_at.replace(tzinfo=timezone.utc) >= since.replace(tzinfo=timezone.utc)]
        pcts = []
        for m in mks:
            es = await ExamSubject.get(m.exam_subject_id)
            if es and es.max_marks > 0:
                pcts.append(_pct(m.marks_obtained, es.max_marks))
        subs = await HomeworkSubmission.find({"school_id": school_id, "student_id": str(st.id)}).to_list()
        done = sum(1 for x in subs if x.status != HomeworkSubmissionStatus.PENDING)
        val = await HomeworkValidation.find({"school_id": school_id, "student_id": str(st.id)}).to_list()
        parts = [f"attendance {att:g}%" if att is not None else "no attendance recorded", f"homework {done}/{len(subs)} handed in"]
        if pcts:
            parts.append(f"marks average {mean(pcts):.0f}%")
        if val:
            parts.append(f"AI homework average {mean(v.percentage for v in val):.0f}%")
        return f"{st.full_name}: " + ", ".join(parts)

    # parents: one summary per parent account, covering each of their children
    for g in await Guardian.find({"school_id": school_id}).to_list():
        kids = [students[i] for i in g.student_ids if i in students]
        if not kids:
            continue
        for uid in await _users_of_guardian(school_id, str(g.id)):
            lines = [await student_line(k) for k in kids]
            if await notify_users(school_id, [uid], "Weekly progress summary", "\n".join(lines), category="weekly_summary", priority="LOW", link="/parent", dedupe_key=f"weekly:{wk}:{uid}"):
                sent["parents"] += 1

    # teachers: their homework and feedback load
    for t in await Teacher.find({"school_id": school_id}).to_list():
        uids = await recipients.teacher_user_ids(school_id, [str(t.id)])
        if not uids:
            continue
        hws = await Homework.find({"school_id": school_id, "teacher_id": str(t.id)}).to_list()
        recent = [h for h in hws if _d(h.assigned_date) >= today - timedelta(days=7)]
        waiting = 0
        for h in hws:
            waiting += await HomeworkSubmission.find({"school_id": school_id, "homework_id": str(h.id), "status": HomeworkSubmissionStatus.SUBMITTED.value, "teacher_feedback": None}).count()
        text = f"Homework assigned this week: {len(recent)}. Submissions waiting for your feedback: {waiting}."
        if await notify_users(school_id, uids, "Weekly teaching summary", text, category="weekly_summary", priority="LOW", link="/teacher/homework", dedupe_key=f"weekly:{wk}:{uids[0]}"):
            sent["teachers"] += 1

    # principal: the school at a glance
    alerts = await Notification.find({"school_id": school_id, "category": {"$in": ["progress", "teacher_performance"]}}).to_list()
    alerts = [a for a in alerts if a.created_at.replace(tzinfo=timezone.utc) >= since.replace(tzinfo=timezone.utc)]
    open_t = await Ticket.find({"school_id": school_id, "status": {"$in": [TicketStatus.OPEN.value, TicketStatus.IN_PROGRESS.value]}}).count()
    recs = await StudentAttendance.find({"school_id": school_id, "date": {"$gte": since}}).to_list()
    att = _pct(sum(1 if r.status in _ATTENDED else 0.5 if r.status == AttendanceStatus.HALF_DAY else 0 for r in recs), len(recs)) if recs else None
    text = (f"Students: {len(students)}. School attendance this week: {f'{att:g}%' if att is not None else 'not recorded'}. "
            f"Student alerts: {sum(1 for a in alerts if a.category == 'progress' and a.priority in ('HIGH', 'URGENT'))}. "
            f"Teacher alerts: {sum(1 for a in alerts if a.category == 'teacher_performance')}. Open tickets: {open_t}.")
    for uid in await recipients.principal_ids(school_id):
        if await notify_users(school_id, [uid], "Weekly school summary", text, category="weekly_summary", priority="LOW", link="/principal", dedupe_key=f"weekly:{wk}:{uid}"):
            sent["principal"] += 1
    return sent


async def _users_of_guardian(school_id: str, guardian_id: str) -> list[str]:
    return [str(u.id) for u in await User.find({"school_id": school_id, "guardian_id": guardian_id, "is_active": True}).to_list()]


# ------------------------------------------------------------------ entry points

async def run_scan(school_id: str, *, summary: bool = False, today: date | None = None) -> dict:
    result = {"students": await scan_students(school_id, today), "teachers": await scan_teachers(school_id, today)}
    if summary:
        result["weekly_summary"] = await weekly_summary(school_id, today)
    return result


async def run_all_schools(*, summary: bool = True) -> dict[str, dict]:
    out = {}
    for tenant in await Tenant.find({"is_active": True}).to_list():
        try:
            out[str(tenant.id)] = await run_scan(str(tenant.id), summary=summary)
        except Exception:  # noqa: BLE001
            logger.exception("Progress scan failed for school %s", tenant.id)
    return out


async def progress_loop() -> None:
    """Background job: scan every school every PROGRESS_SCAN_INTERVAL_MINUTES; the weekly summary goes out on the first scan from
    Friday on (each summary is sent once per week). PROGRESS_SCAN_INTERVAL_MINUTES=0 switches it off."""
    import asyncio

    minutes = get_settings().progress_scan_interval_minutes
    if minutes <= 0:
        return
    await asyncio.sleep(120)  # let the app finish starting
    while True:
        try:
            await run_all_schools(summary=date.today().weekday() >= 4)
        except Exception:  # noqa: BLE001
            logger.exception("Progress scan loop failed")
        await asyncio.sleep(minutes * 60)
