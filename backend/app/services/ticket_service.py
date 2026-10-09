"""Tickets: raised by students and parents, visible to the school's principal and admins and to the platform's super admins."""
from datetime import datetime
from typing import Any

from app.core.deps import CurrentUser
from app.core.enums import ADMIN_ROLES, Role
from app.core.exceptions import NotFoundError, PermissionDeniedError, ValidationAppError
from app.models.base import utcnow
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.tenant import Tenant
from app.models.ticket import Ticket, TicketCategory, TicketReply, TicketStatus
from app.schemas.common import PageParams, PageResponse
from app.services import recipients
from app.services.notify import notify_users

RAISERS = (Role.STUDENT, Role.PARENT)
HANDLERS = (Role.PRINCIPAL, Role.SCHOOL_ADMIN, Role.SUPER_ADMIN)
_PORTAL = {Role.PRINCIPAL: "/principal/tickets", Role.SCHOOL_ADMIN: "/admin/tickets", Role.SUPER_ADMIN: "/super-admin/tickets",
           Role.STUDENT: "/student/support", Role.PARENT: "/parent/support"}


def _out(t: Ticket) -> dict[str, Any]:
    return {
        "id": str(t.id), "ticket_no": t.ticket_no, "school_id": t.school_id, "school_name": t.school_name,
        "raised_by_name": t.raised_by_name, "raised_by_role": t.raised_by_role, "student_id": t.student_id,
        "student_name": t.student_name, "teacher_id": t.teacher_id, "category": t.category, "subject": t.subject,
        "description": t.description, "rating": t.rating, "priority": t.priority, "status": t.status,
        "created_at": t.created_at.isoformat(), "last_activity_at": t.last_activity_at.isoformat(),
        "resolved_at": t.resolved_at.isoformat() if t.resolved_at else None,
    }


def _reply_out(r: TicketReply) -> dict[str, Any]:
    return {"id": str(r.id), "author_name": r.author_name, "author_role": r.author_role, "message": r.message,
            "created_at": r.created_at.isoformat()}


async def _staff_to_tell(school_id: str) -> list[tuple[str, list[str]]]:
    """(portal link, user ids) for the school's principal and admins and for every super admin."""
    return [
        (_PORTAL[Role.PRINCIPAL], await recipients.principal_ids(school_id)),
        (_PORTAL[Role.SCHOOL_ADMIN], await recipients.school_admin_ids(school_id)),
        (_PORTAL[Role.SUPER_ADMIN], await recipients.super_admin_ids()),
    ]


async def create_ticket(current: CurrentUser, *, category: str, subject: str, description: str, rating: int | None = None,
                        student_id: str | None = None, teacher_id: str | None = None) -> dict[str, Any]:
    if current.role not in RAISERS:
        raise PermissionDeniedError("Only students and parents can raise a ticket")
    try:
        cat = TicketCategory(category)
    except ValueError as exc:
        raise ValidationAppError("Unknown category") from exc
    subject, description = subject.strip(), description.strip()
    if not subject or not description:
        raise ValidationAppError("Please give the ticket a subject and describe the problem")
    if rating is not None and not 1 <= rating <= 5:
        raise ValidationAppError("The rating is from 1 to 5")
    school_id = current.school_id
    student = None
    if current.role == Role.STUDENT:
        student = await Student.get(current.user.student_id) if current.user.student_id else None
    elif student_id:
        from app.services.homework_service import _guardian_student_ids  # noqa: PLC0415

        if student_id not in await _guardian_student_ids(current):
            raise PermissionDeniedError("That is not your child")
        student = await Student.get(student_id)
    if teacher_id:
        teacher = await Teacher.get(teacher_id) if len(teacher_id) == 24 else None
        if teacher is None or teacher.school_id != school_id:
            raise ValidationAppError("Unknown teacher")
    tenant = await Tenant.get(school_id)
    n = await Ticket.find({"school_id": school_id}).count() + 1
    ticket = Ticket(
        school_id=school_id, ticket_no=f"TCK-{(tenant.code if tenant else 'SCH')}-{n:04d}", school_name=tenant.name if tenant else None,
        raised_by_user_id=str(current.user.id), raised_by_name=current.user.full_name, raised_by_role=current.role.value,
        student_id=str(student.id) if student else None, student_name=student.full_name if student else None,
        teacher_id=teacher_id or None, category=cat, subject=subject, description=description, rating=rating,
        priority="HIGH" if (rating is not None and rating <= 2) or cat == TicketCategory.SAFETY else "NORMAL",
    )
    await ticket.insert()
    who = f"{ticket.raised_by_name} ({'parent' if current.role == Role.PARENT else 'student'})"
    for link, ids in await _staff_to_tell(school_id):
        await notify_users(
            school_id, ids, f"New ticket: {subject}",
            f"{who} raised a ticket in {cat.value.title()}" + (f", rating {rating}/5" if rating else "") + f" at {ticket.school_name or 'the school'}. {description[:160]}",
            category="ticket", priority="HIGH" if ticket.priority == "HIGH" else "NORMAL", link=link, dedupe_key=f"ticket-new:{ticket.id}:{link}",
        )
    return _out(ticket)


def _scope(current: CurrentUser, status: str | None, category: str | None, school_id: str | None) -> dict[str, Any]:
    q: dict[str, Any] = {}
    if current.role in RAISERS:
        q["raised_by_user_id"] = str(current.user.id)
    elif current.role in (Role.PRINCIPAL, Role.SCHOOL_ADMIN):
        q["school_id"] = current.school_id
    elif current.role == Role.SUPER_ADMIN:
        if school_id:
            q["school_id"] = school_id
    else:
        raise PermissionDeniedError("Tickets are for students, parents and school leaders")
    if status:
        q["status"] = status
    if category:
        q["category"] = category
    return q


async def list_tickets(current: CurrentUser, status: str | None = None, category: str | None = None, school_id: str | None = None,
                       params: PageParams | None = None) -> PageResponse[dict[str, Any]]:
    params = params or PageParams()
    query = Ticket.find(_scope(current, status, category, school_id))
    total = await query.count()
    items = await query.sort(-Ticket.last_activity_at).skip(params.skip).limit(params.page_size).to_list()
    return PageResponse(items=[_out(t) for t in items], total=total, page=params.page, page_size=params.page_size)


async def _load(current: CurrentUser, ticket_id: str) -> Ticket:
    ticket = await Ticket.get(ticket_id) if len(ticket_id) == 24 else None
    if ticket is None:
        raise NotFoundError("Ticket not found")
    if current.role in RAISERS:
        ok = ticket.raised_by_user_id == str(current.user.id)
    elif current.role in (Role.PRINCIPAL, Role.SCHOOL_ADMIN):
        ok = ticket.school_id == current.school_id
    else:
        ok = current.role == Role.SUPER_ADMIN
    if not ok:
        raise NotFoundError("Ticket not found")  # not 403: do not reveal that it exists
    return ticket


async def get_ticket(current: CurrentUser, ticket_id: str) -> dict[str, Any]:
    ticket = await _load(current, ticket_id)
    replies = await TicketReply.find({"ticket_id": ticket_id}).sort(+TicketReply.created_at).to_list()
    return {**_out(ticket), "replies": [_reply_out(r) for r in replies]}


async def add_reply(current: CurrentUser, ticket_id: str, message: str) -> dict[str, Any]:
    ticket = await _load(current, ticket_id)
    message = message.strip()
    if not message:
        raise ValidationAppError("Write a message")
    if ticket.status == TicketStatus.CLOSED:
        raise ValidationAppError("This ticket is closed")
    reply = TicketReply(school_id=ticket.school_id, ticket_id=ticket_id, author_user_id=str(current.user.id),
                        author_name=current.user.full_name, author_role=current.role.value, message=message)
    await reply.insert()
    ticket.last_activity_at = utcnow()
    if current.role in HANDLERS and ticket.status == TicketStatus.OPEN:
        ticket.status = TicketStatus.IN_PROGRESS
    await ticket.save()
    if current.role in RAISERS:  # the raiser wrote: tell the staff
        for link, ids in await _staff_to_tell(ticket.school_id):
            await notify_users(ticket.school_id, ids, f"Reply on {ticket.ticket_no}", f"{ticket.raised_by_name}: {message[:200]}",
                               category="ticket", link=link, dedupe_key=f"ticket-reply:{reply.id}:{link}")
    else:  # staff wrote: tell the raiser
        await notify_users(ticket.school_id, [ticket.raised_by_user_id], f"Reply on your ticket {ticket.ticket_no}",
                           f"{current.user.full_name}: {message[:200]}", category="ticket", link=_PORTAL[Role(ticket.raised_by_role)],
                           dedupe_key=f"ticket-reply:{reply.id}")
    return _reply_out(reply)


async def set_status(current: CurrentUser, ticket_id: str, status: str) -> dict[str, Any]:
    if current.role not in HANDLERS:
        raise PermissionDeniedError("Only the principal, admins and super admins can change a ticket's status")
    ticket = await _load(current, ticket_id)
    try:
        new = TicketStatus(status)
    except ValueError as exc:
        raise ValidationAppError("Unknown status") from exc
    if new == ticket.status:
        return _out(ticket)
    ticket.status = new
    ticket.last_activity_at = utcnow()
    ticket.resolved_at = utcnow() if new in (TicketStatus.RESOLVED, TicketStatus.CLOSED) else None
    await ticket.save()
    await notify_users(ticket.school_id, [ticket.raised_by_user_id], f"Your ticket {ticket.ticket_no} is now {new.value.replace('_', ' ').title()}",
                       f"Status changed by {current.user.full_name}: {ticket.subject}", category="ticket",
                       link=_PORTAL[Role(ticket.raised_by_role)], dedupe_key=f"ticket-status:{ticket.id}:{new.value}:{ticket.last_activity_at.timestamp()}")
    return _out(ticket)


async def summary(current: CurrentUser, school_id: str | None = None) -> dict[str, Any]:
    if current.role not in HANDLERS:
        raise PermissionDeniedError()
    q = _scope(current, None, None, school_id)
    tickets = await Ticket.find(q).to_list()
    by_status = {s.value: 0 for s in TicketStatus}
    by_category: dict[str, int] = {}
    for t in tickets:
        by_status[t.status] += 1
        by_category[t.category] = by_category.get(t.category, 0) + 1
    return {"total": len(tickets), "by_status": by_status, "by_category": by_category,
            "open_high_priority": sum(1 for t in tickets if t.priority in ("HIGH", "URGENT") and t.status in (TicketStatus.OPEN, TicketStatus.IN_PROGRESS))}


async def my_teachers(current: CurrentUser) -> list[dict[str, str]]:
    """The teachers a student (or a parent's children) can raise a ticket about."""
    if current.role not in RAISERS:
        raise PermissionDeniedError()
    if current.role == Role.STUDENT:
        ids = [current.user.student_id] if current.user.student_id else []
    else:
        from app.services.homework_service import _guardian_student_ids  # noqa: PLC0415

        ids = await _guardian_student_ids(current)
    teacher_ids: set[str] = set()
    for sid in ids:
        student = await Student.get(sid)
        if student is not None:
            teacher_ids.update(await recipients.teachers_of(student))
    teachers = [t for t in [await Teacher.get(tid) for tid in sorted(teacher_ids)] if t is not None]
    return sorted(({"id": str(t.id), "name": t.full_name} for t in teachers), key=lambda r: r["name"])
