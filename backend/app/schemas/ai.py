from pydantic import BaseModel


class AiChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None


class AiChatResponse(BaseModel):
    response: str
    conversation_id: str
