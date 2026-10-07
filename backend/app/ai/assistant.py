"""Generic role-agnostic function-calling orchestration loop using free Gemini API."""

import logging
from collections.abc import Awaitable, Callable
from typing import Any

import google.generativeai as genai
from google.generativeai.types import FunctionDeclaration, Tool

from app.ai.context_builder import build_system_prompt
from app.ai.gemini_client import get_model
from app.core.deps import CurrentUser
from app.models.ai_conversation import AIConversation, ConversationMessage

logger = logging.getLogger("ai.assistant")

ToolFn = Callable[[CurrentUser, dict[str, Any]], Awaitable[Any]]

MAX_TOOL_ITERATIONS = 5
MAX_HISTORY_MESSAGES = 20


async def _load_or_create_conversation(current: CurrentUser, conversation_id: str | None) -> AIConversation:
    if conversation_id:
        existing = await AIConversation.get(conversation_id)
        tenant_key = current.school_id or "platform"
        if existing is not None and existing.school_id == tenant_key and existing.user_id == current.id:
            return existing

    conversation = AIConversation(
        school_id=current.school_id or "platform",
        user_id=current.id,
        role=current.role.value,
    )
    await conversation.insert()
    return conversation


def _history_to_content(conversation: AIConversation) -> list[dict]:
    content: list[dict] = []
    for msg in conversation.messages[-MAX_HISTORY_MESSAGES:]:
        if msg.role == "tool":
            continue
        role = "user" if msg.role == "user" else "model"
        content.append({"role": role, "parts": [msg.content]})
    return content


async def run_assistant(
    current: CurrentUser,
    message: str,
    tool_declarations: list[FunctionDeclaration],
    tool_dispatch: dict[str, ToolFn],
    conversation_id: str | None = None,
) -> tuple[str, str]:
    """Runs one user turn through Gemini with function calling enabled.
    Returns (response_text, conversation_id)."""
    system_prompt = await build_system_prompt(current)
    tools = [Tool(function_declarations=tool_declarations)] if tool_declarations else None
    model = get_model(system_instruction=system_prompt)

    conversation = await _load_or_create_conversation(current, conversation_id)
    history = _history_to_content(conversation)

    chat = model.start_chat(history=history)
    conversation.messages.append(ConversationMessage(role="user", content=message))

    response = chat.send_message(message, tools=tools)

    for _ in range(MAX_TOOL_ITERATIONS):
        candidate = response.candidates[0]
        function_calls = []
        for part in candidate.content.parts:
            if hasattr(part, 'function_call') and part.function_call:
                function_calls.append(part.function_call)

        if not function_calls:
            break

        response_parts = []
        for call in function_calls:
            args = dict(call.args) if call.args else {}
            fn = tool_dispatch.get(call.name)
            if fn is None:
                result: Any = {"error": f"Unknown tool '{call.name}'"}
            else:
                try:
                    result = await fn(current, args)
                except Exception as exc:
                    logger.exception("AI tool %s failed", call.name)
                    result = {"error": str(exc)}

            conversation.messages.append(
                ConversationMessage(
                    role="tool",
                    content=str(result),
                    tool_calls=[{"name": call.name, "args": args}],
                )
            )
            response_parts.append(
                genai.protos.Part(
                    function_response=genai.protos.FunctionResponse(
                        name=call.name,
                        response={"result": result}
                    )
                )
            )

        response = chat.send_message(response_parts)
    else:
        logger.warning("AI assistant hit max tool iterations for user %s", current.id)

    final_text = response.text
    conversation.messages.append(ConversationMessage(role="model", content=final_text))
    await conversation.save()
    return final_text, str(conversation.id)


async def generate_homework(
    current: CurrentUser,
    subject: str,
    grade: str,
    topic: str,
    difficulty: str = "medium",
    chapter_content: str | None = None,
    language: str = "english",
) -> str:
    """Generate homework content using Gemini AI, optionally based on chapter content."""
    from app.ai.gemini_client import get_model

    content_context = ""
    if chapter_content:
        content_context = f"""
Use the following chapter content as the source material for generating questions:

--- CHAPTER CONTENT ---
{chapter_content[:8000]}
--- END CHAPTER CONTENT ---

Generate homework questions STRICTLY based on the above chapter content. Ensure all questions are directly related to the topics, concepts, and examples covered in this chapter.
"""

    lang_instruction = ""
    if language == "arabic":
        lang_instruction = "Generate the entire homework in Arabic (العربية). All text, instructions, and questions should be in Arabic."
    else:
        lang_instruction = "Generate the homework in English."

    prompt = f"""Generate a homework assignment for:
- Subject: {subject}
- Grade/Class: {grade}
- Chapter/Topic: {topic}
- Difficulty: {difficulty}

{lang_instruction}

{content_context}

Please provide a well-structured homework with:
1. **Subject:** {subject}
2. **Grade/Class:** {grade}
3. **Chapter:** {topic}
4. **Difficulty:** {difficulty}
5. **Estimated Time to Complete:** (provide estimate)
6. **Resources Needed:** (list any resources)

### Student Instructions:
(Write clear instructions for students)

### Homework Questions:
(Provide 5-10 questions organized by section/type. Use proper formatting with numbered lists.)

Format the response in a clean, professional way suitable for printing."""

    model = get_model(system_instruction="You are an expert teacher assistant that creates engaging, age-appropriate homework assignments. Format your output with proper markdown headers and lists for professional presentation.")
    response = model.generate_content(prompt)
    return response.text
