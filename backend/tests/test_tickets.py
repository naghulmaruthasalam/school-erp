"""Tickets: raised by a student or parent, visible to that school's principal and admins and to every super admin,
with replies and statuses, and notifications along the way."""
import pytest
from beanie import PydanticObjectId

from app.core.enums import Role
from app.models.student import Student
from app.models.user import User
from tests.conftest import make_current_user, override_current_user
from tests.test_copilot import CHILD_ID, GUARDIAN_ID, OTHER_SCHOOL, SCHOOL, STUDENT_ID, TEACHER_ID, school  # noqa: F401

PRINCIPAL, ADMIN, SUPER, OTHER_PRINCIPAL = ("000000000000000000000a%02d" % n for n in (21, 22, 23, 24))
STUDENT_USER, PARENT_USER, OTHER_STUDENT_USER, OTHER_STUDENT = ("000000000000000000000a%02d" % n for n in (31, 32, 33, 34))


async def add(uid, role, school_id, **kw):
    await User(id=PydanticObjectId(uid), school_id=school_id, username=uid, hashed_password="x", role=role, full_name=f"{role.value} {uid[-2:]}", **kw).insert()


@pytest.fixture
async def people(school):  # noqa: F811
    await add(PRINCIPAL, Role.PRINCIPAL, SCHOOL)
    await add(ADMIN, Role.SCHOOL_ADMIN, SCHOOL)
    await add(SUPER, Role.SUPER_ADMIN, None)
    await add(OTHER_PRINCIPAL, Role.PRINCIPAL, OTHER_SCHOOL)
    await add(STUDENT_USER, Role.STUDENT, SCHOOL, student_id=STUDENT_ID)
    await add(PARENT_USER, Role.PARENT, SCHOOL, guardian_id=GUARDIAN_ID)
    await Student(id=PydanticObjectId(OTHER_STUDENT), school_id=OTHER_SCHOOL, admission_no="X1", first_name="Omar", last_name="Z",
                  academic_year_id="ay1", class_id="c", section_id="s").insert()
    await add(OTHER_STUDENT_USER, Role.STUDENT, OTHER_SCHOOL, student_id=OTHER_STUDENT)


def as_(role, uid, school_id=SCHOOL, **kw):
    override_current_user(make_current_user(role, school_id, user_id=uid, **kw))


async def inbox(client, role, uid, school_id=SCHOOL, **kw):
    as_(role, uid, school_id, **kw)
    return (await client.get("/api/v1/notifications")).json()["items"]


BODY = {"category": "TEACHING", "subject": "Lessons are too fast", "description": "The maths teacher moves on before we understand.", "rating": 2}


@pytest.mark.asyncio
async def test_a_ticket_reaches_principal_admin_and_super_admin_but_not_another_school(client, people):
    as_(Role.STUDENT, STUDENT_USER, student_id=STUDENT_ID)
    r = await client.post("/api/v1/tickets", json=BODY)
    assert r.status_code == 201, r.text
    t = r.json()
    assert t["status"] == "OPEN" and t["priority"] == "HIGH" and t["ticket_no"].startswith("TCK-") and t["student_name"] == "Asha K"

    for role, uid, school_id, link in ((Role.PRINCIPAL, PRINCIPAL, SCHOOL, "/principal/tickets"), (Role.SCHOOL_ADMIN, ADMIN, SCHOOL, "/admin/tickets"),
                                       (Role.SUPER_ADMIN, SUPER, None, "/super-admin/tickets")):
        items = await inbox(client, role, uid, school_id)
        assert [n["title"] for n in items] == ["New ticket: Lessons are too fast"], role
        assert items[0]["link"] == link and items[0]["category"] == "ticket"
        as_(role, uid, school_id)
        assert (await client.get("/api/v1/notifications/unread-count")).json()["unread"] == 1
    assert await inbox(client, Role.PRINCIPAL, OTHER_PRINCIPAL, OTHER_SCHOOL) == []  # another school's principal is not told
    assert await inbox(client, Role.STUDENT, STUDENT_USER, SCHOOL, student_id=STUDENT_ID) == []  # and the notice is not a broadcast


@pytest.mark.asyncio
async def test_who_can_see_which_tickets(client, people):
    as_(Role.STUDENT, STUDENT_USER, student_id=STUDENT_ID)
    mine = (await client.post("/api/v1/tickets", json=BODY)).json()
    as_(Role.STUDENT, OTHER_STUDENT_USER, OTHER_SCHOOL, student_id=OTHER_STUDENT)
    theirs = (await client.post("/api/v1/tickets", json={**BODY, "category": "FACILITIES", "subject": "Broken fans", "rating": 4})).json()
    assert theirs["priority"] == "NORMAL" and theirs["school_name"] == "Fixture School 2"

    assert (await client.get(f"/api/v1/tickets/{mine['id']}")).status_code == 404  # another school's student cannot open it
    assert [t["id"] for t in (await client.get("/api/v1/tickets")).json()["items"]] == [theirs["id"]]
    as_(Role.PRINCIPAL, PRINCIPAL)
    assert [t["id"] for t in (await client.get("/api/v1/tickets")).json()["items"]] == [mine["id"]]
    assert (await client.get(f"/api/v1/tickets/{theirs['id']}")).status_code == 404
    as_(Role.SCHOOL_ADMIN, ADMIN)
    assert (await client.get("/api/v1/tickets")).json()["total"] == 1
    as_(Role.SUPER_ADMIN, SUPER, None)  # the platform sees every school's
    everything = (await client.get("/api/v1/tickets")).json()
    assert everything["total"] == 2 and {t["school_name"] for t in everything["items"]} == {"Fixture School 1", "Fixture School 2"}
    assert (await client.get("/api/v1/tickets", params={"school_id": OTHER_SCHOOL})).json()["total"] == 1
    summary = (await client.get("/api/v1/tickets/summary")).json()
    assert summary["total"] == 2 and summary["by_status"]["OPEN"] == 2 and summary["open_high_priority"] == 1
    as_(Role.TEACHER, "000000000000000000000a41", teacher_id=TEACHER_ID)
    assert (await client.get("/api/v1/tickets")).status_code == 403  # teachers are not part of the ticket flow
    assert (await client.post("/api/v1/tickets", json=BODY)).status_code == 403


@pytest.mark.asyncio
async def test_replies_and_statuses_notify_the_other_side(client, people):
    as_(Role.STUDENT, STUDENT_USER, student_id=STUDENT_ID)
    t = (await client.post("/api/v1/tickets", json=BODY)).json()
    url = f"/api/v1/tickets/{t['id']}"
    assert (await client.patch(f"{url}/status", json={"status": "RESOLVED"})).status_code == 403  # a student cannot resolve their own ticket

    as_(Role.PRINCIPAL, PRINCIPAL)
    assert (await client.post(f"{url}/replies", json={"message": "We will speak to the teacher."})).status_code == 201
    assert (await client.get(url)).json()["status"] == "IN_PROGRESS"  # the first staff reply starts work on it
    items = await inbox(client, Role.STUDENT, STUDENT_USER, SCHOOL, student_id=STUDENT_ID)
    assert items[0]["title"].startswith("Reply on your ticket") and items[0]["link"] == "/student/support"

    as_(Role.STUDENT, STUDENT_USER, student_id=STUDENT_ID)
    await client.post(f"{url}/replies", json={"message": "Thank you."})
    assert (await inbox(client, Role.SCHOOL_ADMIN, ADMIN))[0]["title"].startswith("Reply on TCK-")

    as_(Role.SUPER_ADMIN, SUPER, None)
    assert (await client.patch(f"{url}/status", json={"status": "RESOLVED"})).json()["resolved_at"]
    assert "is now Resolved" in (await inbox(client, Role.STUDENT, STUDENT_USER, SCHOOL, student_id=STUDENT_ID))[0]["title"]
    as_(Role.SUPER_ADMIN, SUPER, None)
    closed = await client.patch(f"{url}/status", json={"status": "CLOSED"})
    assert closed.status_code == 200 and closed.json()["status"] == "CLOSED", closed.text
    as_(Role.STUDENT, STUDENT_USER, student_id=STUDENT_ID)
    assert (await client.post(f"{url}/replies", json={"message": "one more"})).status_code == 422  # closed
    detail = (await client.get(url)).json()
    assert [r["message"] for r in detail["replies"]] == ["We will speak to the teacher.", "Thank you."]
    assert (await client.patch(f"{url}/status", json={"status": "NOPE"})).status_code in (403, 422)


@pytest.mark.asyncio
async def test_a_parent_raises_a_ticket_about_their_own_child_only(client, people):
    as_(Role.PARENT, PARENT_USER, guardian_id=GUARDIAN_ID)
    ok = await client.post("/api/v1/tickets", json={**BODY, "student_id": CHILD_ID, "category": "SAFETY", "rating": None})
    assert ok.status_code == 201 and ok.json()["student_name"] == "Ravi M" and ok.json()["priority"] == "HIGH"  # safety is always high
    assert (await client.post("/api/v1/tickets", json={**BODY, "student_id": STUDENT_ID})).status_code == 403  # not their child
    assert (await client.post("/api/v1/tickets", json={**BODY, "category": "NOPE"})).status_code == 422
    assert (await client.post("/api/v1/tickets", json={**BODY, "subject": "  "})).status_code == 422
    assert (await client.post("/api/v1/tickets", json={**BODY, "rating": 9})).status_code == 422


@pytest.mark.asyncio
async def test_the_raiser_can_pick_one_of_their_teachers(client, people):
    as_(Role.STUDENT, STUDENT_USER, student_id=STUDENT_ID)
    teachers = (await client.get("/api/v1/tickets/teachers")).json()
    assert [t["name"] for t in teachers] == ["Meera S"]  # the teacher assigned to the student's class
    t = (await client.post("/api/v1/tickets", json={**BODY, "teacher_id": teachers[0]["id"]})).json()
    assert t["teacher_id"] == teachers[0]["id"]
    assert (await client.post("/api/v1/tickets", json={**BODY, "teacher_id": "ffffffffffffffffffffffff"})).status_code == 422
    as_(Role.PRINCIPAL, PRINCIPAL)
    assert (await client.get("/api/v1/tickets/teachers")).status_code == 403
