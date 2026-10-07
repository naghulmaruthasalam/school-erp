from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.enums import Role
from app.core.security import hash_password
from app.models.tenant import Tenant
from app.models.user import User
from tests.conftest import make_current_user, override_current_user


def _fake_chat_session(final_text: str = "You have no pending homework."):
    """Builds a fake Vertex AI chat session whose first send_message_async
    call returns immediately with a final text answer (no function calls) —
    exercises the assistant loop without needing real Gemini credentials."""
    candidate = MagicMock()
    candidate.content.parts = []  # no function_call parts -> loop exits immediately

    response = MagicMock()
    response.candidates = [candidate]
    response.text = final_text

    session = MagicMock()
    session.send_message_async = AsyncMock(return_value=response)
    return session


@pytest.mark.asyncio
async def test_student_assistant_returns_model_text(client, monkeypatch):
    tenant = Tenant(name="Test School", code="AI001")
    await tenant.insert()
    user = User(
        school_id=str(tenant.id),
        email="student1@example.com",
        hashed_password=hash_password("secret123"),
        role=Role.STUDENT,
        full_name="Stu Dent",
        student_id="000000000000000000000099",
    )
    await user.insert()

    current = make_current_user(Role.STUDENT, school_id=str(tenant.id), student_id="000000000000000000000099", user_id=str(user.id))
    override_current_user(current)

    fake_model = MagicMock()
    fake_model.start_chat = MagicMock(return_value=_fake_chat_session("You have no pending homework."))
    monkeypatch.setattr("app.ai.assistant.get_model", lambda **kwargs: fake_model)

    r = await client.post("/api/v1/ai/student", json={"message": "What homework do I have?"})
    assert r.status_code == 200
    body = r.json()
    assert body["response"] == "You have no pending homework."
    assert body["conversation_id"]


@pytest.mark.asyncio
async def test_ai_endpoint_rejects_wrong_role(client):
    current = make_current_user(Role.TEACHER, school_id="school-1", teacher_id="teacher-1")
    override_current_user(current)

    r = await client.post("/api/v1/ai/student", json={"message": "hi"})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_assistant_executes_tool_call_and_persists_conversation(client, monkeypatch):
    tenant = Tenant(name="Test School", code="AI002")
    await tenant.insert()
    user = User(
        school_id=str(tenant.id),
        email="student2@example.com",
        hashed_password=hash_password("secret123"),
        role=Role.STUDENT,
        full_name="Stu Dent Two",
        student_id="000000000000000000000098",
    )
    await user.insert()
    current = make_current_user(Role.STUDENT, school_id=str(tenant.id), student_id="000000000000000000000098", user_id=str(user.id))
    override_current_user(current)

    # First response: model requests a tool call. Second response: final text.
    tool_call = MagicMock()
    tool_call.name = "get_my_pending_homework"
    tool_call.args = {}

    part_with_call = MagicMock()
    part_with_call.function_call = tool_call
    candidate_1 = MagicMock()
    candidate_1.content.parts = [part_with_call]
    response_1 = MagicMock()
    response_1.candidates = [candidate_1]

    candidate_2 = MagicMock()
    candidate_2.content.parts = []
    response_2 = MagicMock()
    response_2.candidates = [candidate_2]
    response_2.text = "You have 2 pending homework items."

    session = MagicMock()
    session.send_message_async = AsyncMock(side_effect=[response_1, response_2])

    fake_model = MagicMock()
    fake_model.start_chat = MagicMock(return_value=session)
    monkeypatch.setattr("app.ai.assistant.get_model", lambda **kwargs: fake_model)

    r = await client.post("/api/v1/ai/student", json={"message": "What homework do I have pending?"})
    assert r.status_code == 200
    assert r.json()["response"] == "You have 2 pending homework items."
    assert session.send_message_async.call_count == 2

    from app.models.ai_conversation import AIConversation

    conv = await AIConversation.get(r.json()["conversation_id"])
    roles = [m.role for m in conv.messages]
    assert roles == ["user", "tool", "model"]
