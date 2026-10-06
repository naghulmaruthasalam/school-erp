import { api } from "../api/client";
import type { Role } from "../types/auth";

export interface AiChatResponse {
  response: string;
  conversation_id: string;
}

const ROLE_AI_PATH: Record<Role, string> = {
  SUPER_ADMIN: "admin",
  SCHOOL_ADMIN: "admin",
  PRINCIPAL: "principal",
  TEACHER: "teacher",
  PARENT: "parent",
  STUDENT: "student",
};

export async function sendAiMessage(
  role: Role,
  message: string,
  conversationId?: string | null,
): Promise<AiChatResponse> {
  const path = ROLE_AI_PATH[role];
  const { data } = await api.post<AiChatResponse>(`/ai/${path}`, {
    message,
    conversation_id: conversationId ?? null,
  });
  return data;
}
