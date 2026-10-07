"""Built-in assistant.

Answers from live school data without any external AI service. It is the fallback used when
GEMINI_API_KEY isn't configured (or Gemini is unavailable), so the chat widget always works.

Each answer is produced by the same permission-checked tools the Gemini assistant uses
(app/ai/tools.py) or by the same services behind the REST API, so a user can only ever hear
about data they are allowed to see.
"""

import logging
import re
from datetime import date, datetime
from typing import Any, Awaitable, Callable

from app.ai.tools import get_tools_for_role
from app.core.deps import CurrentUser
from app.core.enums import Role
from app.core.exceptions import NotFoundError, PermissionDeniedError
from app.models.academic import Class, Section, Subject
from app.models.notification import Notification
from app.schemas.common import PageParams
from app.services import attendance_service, fee_service

logger = logging.getLogger(__name__)

SUPPORT_PHONE = "+91 98765 43210"
SUPPORT_EMAIL = "support@cogniitec.com"
SUPPORT_MESSAGE = (
    "\n\nFor technical issues or further clarification, please contact:"
    f"\n📞 Phone: {SUPPORT_PHONE}\n📧 Email: {SUPPORT_EMAIL}"
)

DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


# ---------------------------------------------------------------------------
# Intent matching
# ---------------------------------------------------------------------------

# Order matters: the first matching intent wins, so specific nouns come before generic ones.
_INTENTS: list[tuple[str, str]] = [
    ("greeting", r"\b(hi|hello|hey|namaste|good (morning|afternoon|evening))\b"),
    ("thanks", r"\b(thanks?|thank you)\b"),
    ("help", r"\b(help|support|what can you do|contact)\b"),
    ("homework", r"\b(homework|assignments?|pending work)\b"),
    ("attendance", r"\b(attendance|present|absent|absentees?)\b"),
    ("fees", r"\b(fees?|payments?|invoices?|dues?|outstanding|collected|collection)\b"),
    ("exams", r"\b(exams?|tests?|results?|marks|grades?)\b"),
    ("timetable", r"\b(timetable|schedule|periods?|classes|class today|my class)\b"),
    ("events", r"\b(events?|holidays?|calendar)\b"),
    ("notifications", r"\b(notifications?|announcements?|notices?|circulars?)\b"),
    ("leave", r"\b(leave|day off)\b"),
    ("admissions", r"\b(admissions?|applications?)\b"),
    ("platform", r"\b(schools|platform|all users|audit)\b"),
    ("school_info", r"\b(school|students?|teachers?|staff|summary|overview|statistics|stats|how many)\b"),
]


def match_intent(message: str) -> str:
    msg = message.lower()
    for intent, pattern in _INTENTS:
        if re.search(pattern, msg):
            return intent
    return "unknown"


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------


async def _subject_names(school_id: str) -> dict[str, str]:
    return {str(s.id): s.name for s in await Subject.find(Subject.school_id == school_id).to_list()}


async def _section_labels(school_id: str) -> dict[str, str]:
    classes = {str(c.id): c.name for c in await Class.find(Class.school_id == school_id).to_list()}
    return {
        str(s.id): f"{classes.get(s.class_id, '')} {s.name}".strip()
        for s in await Section.find(Section.school_id == school_id).to_list()
    }


async def _tool(current: CurrentUser, name: str, **args: Any) -> Any:
    _, dispatch = get_tools_for_role(current.role)
    fn = dispatch.get(name)
    if fn is None:
        raise PermissionDeniedError(f"This assistant can't run '{name}' for your role.")
    return await fn(current, args)


def _wants_week(message: str) -> bool:
    return bool(re.search(r"\b(week|weekly|timetable|schedule|all days)\b", message.lower())) and "today" not in message.lower()


def _money(value: float) -> str:
    """Rupees with Indian digit grouping (12,34,567)."""
    n = int(round(value))
    sign = "-" if n < 0 else ""
    digits = str(abs(n))
    head, tail = digits[:-3], digits[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    return f"{sign}₹" + ",".join([*groups, tail] if groups else [tail])


def _fmt_date(value: str | date | None) -> str:
    if not value:
        return "-"
    if isinstance(value, str):
        value = date.fromisoformat(value[:10])
    return value.strftime("%d %b %Y")


def _hhmm(value: str) -> str:
    return value[:5]


# ---------------------------------------------------------------------------
# Answer builders (return text)
# ---------------------------------------------------------------------------


def _attendance_text(summary: list[dict], who: str = "Your") -> str:
    if not summary:
        return f"📊 No attendance has been marked yet for {who.lower() if who != 'Your' else 'you'} in the last 30 days."
    item = summary[0]
    counts = item.get("counts", {})
    return (
        f"📊 **{who} attendance (last 30 days)**\n\n"
        f"• Days recorded: {item['total_days']}\n"
        f"• Present: {counts.get('PRESENT', 0)}  • Late: {counts.get('LATE', 0)}  • Absent: {counts.get('ABSENT', 0)}\n"
        f"• Attendance: **{item['percentage_present']}%**"
    )


def _homework_text(items: list[dict], subjects: dict[str, str], who: str = "You have") -> str:
    if not items:
        return "📚 **Homework**\n\n✅ Nothing pending. You're all caught up!"
    items = sorted(items, key=lambda h: h.get("due_date", ""))
    lines = [f"• {h['title']} ({subjects.get(h.get('subject_id'), 'General')}) - due {_fmt_date(h['due_date'])}" for h in items[:8]]
    return f"📚 **Pending homework ({len(items)})**\n\n" + "\n".join(lines)


async def _fees_text_for_invoices(items: list[Any], who: str = "Your") -> str:
    if not items:
        return "💰 **Fees**\n\nNo invoices have been raised yet."
    total = sum(i.total_amount for i in items)
    paid = sum(i.amount_paid for i in items)
    pending = total - paid
    open_ones = sorted((i for i in items if i.total_amount > i.amount_paid), key=lambda i: i.due_date)
    text = f"💰 **{who} fees**\n\n• Total billed: {_money(total)}\n• Paid: {_money(paid)}\n• Outstanding: **{_money(pending)}**"
    if open_ones:
        nxt = open_ones[0]
        text += f"\n\nNext due: {_money(nxt.total_amount - nxt.amount_paid)} on {_fmt_date(nxt.due_date)}. You can pay from the Fees page."
    else:
        text += "\n\n✅ All fees are cleared."
    return text


def _timetable_text(slots: list[dict], subjects: dict[str, str], sections: dict[str, str], today_only: bool, with_section: bool) -> str:
    dow = date.today().weekday()
    chosen = [s for s in slots if (s["day_of_week"] == dow) or not today_only]
    if not chosen:
        return "📅 No classes are scheduled today." if today_only else "📅 No timetable has been set up yet."
    chosen.sort(key=lambda s: (s["day_of_week"], s["period_number"]))
    lines = []
    for s in chosen:
        label = f"{DAY_NAMES[s['day_of_week']][:3]} " if not today_only else ""
        where = f" - {sections.get(s['section_id'], '')}" if with_section else ""
        lines.append(f"• {label}P{s['period_number']} {_hhmm(s['start_time'])}-{_hhmm(s['end_time'])}  {subjects.get(s['subject_id'], 'Class')}{where}")
    title = "Today's classes" if today_only else "Weekly timetable"
    return f"📅 **{title}**\n\n" + "\n".join(lines[:20])


def _exams_text(exams: list[dict]) -> str:
    if not exams:
        return "📝 No exams have been scheduled yet."
    today = date.today().isoformat()
    upcoming = sorted((e for e in exams if e["end_date"] >= today), key=lambda e: e["start_date"])
    past = sorted((e for e in exams if e["end_date"] < today), key=lambda e: e["start_date"], reverse=True)
    lines = []
    if upcoming:
        lines.append("**Upcoming**")
        lines += [f"• {e['name']}: {_fmt_date(e['start_date'])} - {_fmt_date(e['end_date'])}" for e in upcoming[:5]]
    if past:
        lines.append("\n**Recent**" if upcoming else "**Recent**")
        lines += [f"• {e['name']} ({_fmt_date(e['end_date'])})" for e in past[:3]]
    return "📝 **Exams**\n\n" + "\n".join(lines)


def _events_text(events: list[dict]) -> str:
    if not events:
        return "🗓️ No events or holidays in the next 30 days."
    events = sorted(events, key=lambda e: e["event_date"])
    return "🗓️ **Coming up (next 30 days)**\n\n" + "\n".join(
        f"• {_fmt_date(e['event_date'])} - {e['title']} ({e['event_type'].title()})" for e in events[:8]
    )


async def _notifications_text(current: CurrentUser) -> str:
    rows = (
        await Notification.find(Notification.school_id == current.school_id, Notification.is_published == True)  # noqa: E712
        .sort(-Notification.created_at)
        .limit(8)
        .to_list()
    )
    rows = [n for n in rows if not n.target_roles or current.role.value in n.target_roles][:4]
    if not rows:
        return "📢 No announcements right now."
    return "📢 **Latest announcements**\n\n" + "\n".join(f"• [{n.notification_type.value.title()}] {n.title}" for n in rows)


# ---------------------------------------------------------------------------
# Role handlers
# ---------------------------------------------------------------------------

Handler = Callable[[CurrentUser, str], Awaitable[str | None]]


async def _student_attendance(c: CurrentUser, m: str = "") -> str:
    return _attendance_text(await _tool(c, "get_my_attendance"))


async def _student_homework(c: CurrentUser, m: str = "") -> str:
    return _homework_text(await _tool(c, "get_my_pending_homework"), await _subject_names(c.school_id))


async def _student_fees(c: CurrentUser, m: str = "") -> str:
    page = await fee_service.list_invoices(c, None, None, None, PageParams(page=1, page_size=100))
    return await _fees_text_for_invoices(page.items)


async def _student_timetable(c: CurrentUser, m: str = "") -> str:
    return _timetable_text(await _tool(c, "get_my_timetable"), await _subject_names(c.school_id), {}, today_only=not _wants_week(m), with_section=False)


async def _exams(c: CurrentUser, m: str = "") -> str:
    from app.services import exam_service

    page = await exam_service.list_exams(c.school_id, None, PageParams(page=1, page_size=20))
    return _exams_text([e.model_dump(mode="json") for e in page.items])


async def _events(c: CurrentUser, m: str = "") -> str:
    from datetime import timedelta

    from app.services import academic_service

    today = date.today()
    events = await academic_service.list_calendar_events(c.school_id, None, start_date=today, end_date=today + timedelta(days=30))
    return _events_text([academic_service.to_calendar_event_out(e).model_dump(mode="json") for e in events])


async def _parent_children(c: CurrentUser) -> list[dict]:
    return await _tool(c, "list_my_children")


async def _parent_attendance(c: CurrentUser, m: str = "") -> str:
    out = []
    for child in (await _parent_children(c))[:4]:
        summary = await _tool(c, "get_child_attendance", student_id=child["id"])
        out.append(_attendance_text(summary, who=child["full_name"] + "'s"))
    return "\n\n".join(out) or "I couldn't find any children linked to your account."


async def _parent_homework(c: CurrentUser, m: str = "") -> str:
    subjects = await _subject_names(c.school_id)
    out = []
    for child in (await _parent_children(c))[:4]:
        items = await _tool(c, "get_child_pending_homework", student_id=child["id"])
        out.append(f"**{child['full_name']}**\n" + _homework_text(items, subjects))
    return "\n\n".join(out) or "I couldn't find any children linked to your account."


async def _parent_fees(c: CurrentUser, m: str = "") -> str:
    out = []
    for child in (await _parent_children(c))[:4]:
        page = await _tool(c, "get_child_fees", student_id=child["id"])
        items = page.get("items", page) if isinstance(page, dict) else page
        # tool output is JSON; rebuild light objects for the shared formatter
        objs = [type("Inv", (), {"total_amount": i["total_amount"], "amount_paid": i["amount_paid"], "due_date": i["due_date"]}) for i in items]
        out.append(await _fees_text_for_invoices(objs, who=child["full_name"] + "'s"))
    return "\n\n".join(out) or "I couldn't find any children linked to your account."


async def _teacher_classes(c: CurrentUser, m: str = "") -> str:
    today_only = not _wants_week(m)
    slots = await _tool(c, "get_today_classes" if today_only else "get_my_classes")
    return _timetable_text(slots, await _subject_names(c.school_id), await _section_labels(c.school_id), today_only, with_section=True)


async def _teacher_attendance(c: CurrentUser, m: str = "") -> str:
    slots = await _tool(c, "get_today_classes")
    sections = await _section_labels(c.school_id)
    lines = []
    for section_id in sorted({s["section_id"] for s in slots}):
        absent = await _tool(c, "get_absent_students", section_id=section_id)
        lines.append(f"• {sections.get(section_id, 'Section')}: {len(absent)} absent today")
    if not lines:
        return "📊 You have no classes today. Mark attendance from the Attendance page."
    return "📊 **Absentees in your classes today**\n\n" + "\n".join(lines) + "\n\nMark attendance from the Attendance page."


async def _staff_summary(c: CurrentUser, m: str = "") -> str:
    stats = await attendance_service.attendance_stats(c)
    fees = await fee_service.fee_stats(c)
    daily = await _tool(c, "get_school_daily_summary") if c.role == Role.PRINCIPAL else None
    lines = [
        f"• Students enrolled: {stats['total_students']}",
        f"• Present today: {stats['present_today']} · Absent: {stats['absent_today']} ({stats['attendance_rate']}% rate, {stats['marked']} marked)",
        f"• Fees collected: {_money(fees['total_collected'])} of {_money(fees['total_expected'])} ({fees['collection_rate']}%)",
        f"• Fees outstanding: {_money(fees['total_pending'])}",
    ]
    if daily:
        lines.insert(1, f"• Active teachers: {daily['active_teachers']} · Pending admissions: {daily['pending_admission_approvals']}")
    return "🏫 **School today**\n\n" + "\n".join(lines)


async def _staff_attendance(c: CurrentUser, m: str = "") -> str:
    s = await attendance_service.attendance_stats(c)
    return (
        f"📊 **Attendance today ({_fmt_date(s['date'])})**\n\n"
        f"• Enrolled: {s['total_students']}\n• Present: {s['present_today']} · Late: {s['late_today']} · Absent: {s['absent_today']}\n"
        f"• Rate: **{s['attendance_rate']}%** ({s['marked']} marked)"
    )


async def _staff_fees(c: CurrentUser, m: str = "") -> str:
    f = await fee_service.fee_stats(c)
    return (
        "💰 **Fee collection**\n\n"
        f"• Billed: {_money(f['total_expected'])}\n• Collected: {_money(f['total_collected'])} ({f['collection_rate']}%)\n"
        f"• Outstanding: **{_money(f['total_pending'])}**\n• Overdue invoices: {f['overdue_invoices']}"
    )


async def _staff_admissions(c: CurrentUser, m: str = "") -> str:
    if c.role == Role.TEACHER:
        return "Admissions are handled by the school office."
    page = await _tool(c, "get_pending_admission_approvals" if c.role == Role.PRINCIPAL else "admission_search", **({} if c.role == Role.PRINCIPAL else {"status": "SUBMITTED"}))
    total = page.get("total", 0) if isinstance(page, dict) else len(page)
    return f"🧾 **Admissions**\n\n{total} application(s) are waiting for review. Open the Admissions page to approve or reject them."


async def _leave(c: CurrentUser, m: str = "") -> str:
    from app.services import analytics_service

    if c.role in (Role.SCHOOL_ADMIN, Role.PRINCIPAL):
        s = await analytics_service.leave_stats(c)
        return f"📅 **Leave requests**\n\n• Pending approval: **{s['pending']}**\n• Approved: {s['approved']} · Rejected: {s['rejected']}\n\nReview them on the Leave Requests page."
    from app.models.leave import LeaveRequest

    requester_id = c.user.teacher_id if c.role == Role.TEACHER else c.user.student_id
    mine = (
        await LeaveRequest.find(LeaveRequest.school_id == c.school_id, LeaveRequest.requester_id == requester_id).to_list()
        if requester_id
        else []
    )
    pending = sum(1 for m in mine if m.status.value == "PENDING")
    approved = sum(1 for m in mine if m.status.value == "APPROVED")
    return (
        f"📅 **Your leave requests**\n\n• Total: {len(mine)}\n• Pending: {pending} · Approved: {approved}\n\n"
        "Submit or track them on the Leave page."
    )


async def _platform(c: CurrentUser, m: str = "") -> str:
    from app.services import school_service

    s = await school_service.get_platform_stats()
    return (
        "🌐 **Platform overview**\n\n"
        f"• Schools: {s['total_schools']} ({s['active_schools']} active, {s['inactive_schools']} inactive)\n"
        f"• Users: {s['total_users']} ({s['active_users']} active)"
    )


async def _school_info(c: CurrentUser, m: str = "") -> str:
    if c.role == Role.SUPER_ADMIN:
        return await _platform(c)
    if c.role in (Role.SCHOOL_ADMIN, Role.PRINCIPAL):
        return await _staff_summary(c)
    return "School-wide statistics are available to the administration. Your dashboard shows what's relevant to you."


_HANDLERS: dict[tuple[str, str], Handler] = {}


def _register(intent: str, roles: tuple[Role, ...], fn: Handler) -> None:
    for r in roles:
        _HANDLERS[(intent, r.value)] = fn


ADMINS = (Role.SCHOOL_ADMIN, Role.PRINCIPAL)
_register("attendance", (Role.STUDENT,), _student_attendance)
_register("attendance", (Role.PARENT,), _parent_attendance)
_register("attendance", (Role.TEACHER,), _teacher_attendance)
_register("attendance", ADMINS, _staff_attendance)
_register("homework", (Role.STUDENT,), _student_homework)
_register("homework", (Role.PARENT,), _parent_homework)
_register("fees", (Role.STUDENT,), _student_fees)
_register("fees", (Role.PARENT,), _parent_fees)
_register("fees", ADMINS, _staff_fees)
_register("timetable", (Role.STUDENT,), _student_timetable)
_register("timetable", (Role.TEACHER,), _teacher_classes)
_register("exams", (Role.STUDENT, Role.PARENT, Role.TEACHER, *ADMINS), _exams)
_register("events", (Role.STUDENT, Role.PARENT, Role.TEACHER, *ADMINS), _events)
_register("admissions", ADMINS, _staff_admissions)
_register("leave", (Role.TEACHER, Role.STUDENT, *ADMINS), _leave)
_register("platform", (Role.SUPER_ADMIN,), _platform)
_register("school_info", (Role.SCHOOL_ADMIN, Role.PRINCIPAL, Role.SUPER_ADMIN), _school_info)


# ---------------------------------------------------------------------------
# Static texts
# ---------------------------------------------------------------------------

_CAPABILITIES: dict[Role, list[str]] = {
    Role.SUPER_ADMIN: ["Platform overview (schools and users)", "Where to find Schools, Users, Audit logs and Analytics"],
    Role.SCHOOL_ADMIN: ["School summary and today's attendance", "Fee collection and outstanding dues", "Pending admissions and leave requests", "Exams and announcements"],
    Role.PRINCIPAL: ["School summary and today's attendance", "Fee collection and outstanding dues", "Pending admissions and leave requests", "Exams and announcements"],
    Role.TEACHER: ["Today's classes and your weekly timetable", "Absentees in your classes today", "Exams and announcements"],
    Role.STUDENT: ["Your attendance", "Pending homework", "Fees and dues", "Today's timetable, exams and events"],
    Role.PARENT: ["Your children's attendance", "Their pending homework", "Fee status", "Exams, events and announcements"],
}


def get_greeting_for_role(name: str, role: Role) -> str:
    items = "\n".join(f"• {c}" for c in _CAPABILITIES.get(role, []))
    return f"Hello {name}! 👋 I'm the Cogniitec assistant.\n\nYou can ask me about:\n{items}\n\nWhat would you like to know?"


def _unknown(role: Role) -> str:
    items = "\n".join(f"• {c}" for c in _CAPABILITIES.get(role, []))
    return f"I'm not sure I understand that. 🤔\n\nTry asking about:\n{items}{SUPPORT_MESSAGE}"


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


async def process_chat(current: CurrentUser, message: str) -> str:
    """Return the assistant's reply to `message` for the signed-in user."""
    intent = match_intent(message)
    role = current.role

    if intent == "greeting":
        return get_greeting_for_role(current.user.full_name, role)
    if intent == "thanks":
        return "You're welcome! 😊 Ask me anything else about your school."
    if intent == "help":
        return get_greeting_for_role(current.user.full_name, role) + SUPPORT_MESSAGE

    try:
        if intent == "notifications" and current.school_id:
            return await _notifications_text(current)
        handler = _HANDLERS.get((intent, role.value))
        if handler is None:
            if intent in ("unknown",):
                return _unknown(role)
            items = "\n".join(f"• {c}" for c in _CAPABILITIES.get(role, []))
            return f"That information isn't available to a {role.value.replace('_', ' ').title()} account.\n\nI can help with:\n{items}"
        return await handler(current, message)
    except (PermissionDeniedError, NotFoundError) as exc:
        return f"I couldn't find that information: {exc}{SUPPORT_MESSAGE}"
    except Exception:
        logger.exception("Built-in assistant failed for role %s (intent=%s)", role, intent)
        return f"Sorry, I encountered an issue while processing your request. Please try again later.{SUPPORT_MESSAGE}"
