import { api, apiBaseUrl } from "../api/client";
import { authStore } from "../auth/store";

export type Mode = "study" | "school";

export interface ToolField {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "date" | "child";
  required?: boolean;
  default?: string | number;
  options?: string[];
  min?: number;
  max?: number;
  help?: string;
}

export interface ToolSpec {
  key: string;
  title: string;
  description: string;
  icon: string;
  needs_context: boolean;
  require_subject: boolean;
  require_chapter: boolean;
  dedicated?: boolean;
  fields: ToolField[];
}

export interface CopilotProfile {
  /** The super admin's chat: platform data only, no saved sessions, tools or files. */
  platform?: boolean;
  enabled: boolean;
  role: string;
  title: string;
  tagline: string;
  modes: Mode[];
  default_mode: Mode;
  quick_actions: Partial<Record<Mode, string[]>>;
  tools: ToolSpec[];
  languages: string[];
  ai_configured: boolean;
}

export interface CopilotContextOptions {
  classes: { id: string; name: string; subjects: { id: string; name: string; chapters: string[] }[] }[];
  children: { id: string; name: string; class_id: string }[];
}

export interface StudyContextSel {
  classId?: string;
  subjectId?: string;
  chapter?: string;
  studentId?: string;
}

export interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
  at?: string;
}

export interface CopilotSession {
  id: string;
  mode: Mode;
  title: string | null;
  language: string;
  label: string | null;
  context: Record<string, string | null>;
  messages: CopilotMessage[];
}

export interface SessionSummary {
  id: string;
  mode: Mode;
  title: string | null;
  label: string | null;
  message_count: number;
  updated_at: string;
}

const real_fetchProfile = async () => (await api.get<CopilotProfile>("/copilot/profile")).data;
const real_fetchContext = async () => (await api.get<CopilotContextOptions>("/copilot/context")).data;
const real_listSessions = async () => (await api.get<SessionSummary[]>("/copilot/sessions")).data;
const real_getSession = async (id: string) => (await api.get<CopilotSession>(`/copilot/sessions/${id}`)).data;
const real_deleteSession = async (id: string) => {
  await api.delete(`/copilot/sessions/${id}`);
};

async function real_startSession(mode: Mode, language: string, ctx: StudyContextSel): Promise<CopilotSession> {
  const { data } = await api.post<CopilotSession>("/copilot/sessions", {
    mode,
    language,
    class_id: ctx.classId || null,
    subject_id: ctx.subjectId || null,
    chapter: ctx.chapter || null,
    student_id: ctx.studentId || null,
  });
  return data;
}

async function real_sendMessage(sessionId: string, message: string): Promise<{ reply: string; title: string | null }> {
  const { data } = await api.post(`/copilot/sessions/${sessionId}/messages`, { message });
  return data;
}

/** Streams the reply (Server-Sent Events). Calls onChunk for each piece; resolves with the final title.
 * Throws an Error whose message is the server's explanation if the request itself is rejected (e.g. 429). */
async function real_streamMessage(
  sessionId: string,
  message: string,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string | null> {
  const token = authStore.getState().accessToken;
  const res = await fetch(`${apiBaseUrl}/copilot/sessions/${sessionId}/messages/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ message }),
    signal,
  });
  if (!res.ok || !res.body) {
    let detail = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      /* keep the generic message */
    }
    throw new Error(detail);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let title: string | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const raw of events) {
      if (!raw.startsWith("data: ")) continue;
      const evt = JSON.parse(raw.slice(6));
      if (evt.type === "chunk") onChunk(evt.text);
      else if (evt.type === "done") title = evt.title ?? null;
      else if (evt.type === "error") throw new Error(evt.detail);
    }
  }
  return title;
}

async function real_runTool<T = Record<string, unknown>>(
  key: string,
  ctx: StudyContextSel,
  params: Record<string, unknown>,
  language: string,
): Promise<T> {
  const { data } = await api.post<T>(`/copilot/tools/${key}`, {
    context: {
      class_id: ctx.classId || null,
      subject_id: ctx.subjectId || null,
      chapter: ctx.chapter || null,
      student_id: ctx.studentId || null,
    },
    params,
    language,
  });
  return data;
}

// ---------------------------------------------------------------------------------------------- routing
// One Copilot for every login. Demo mode answers from sample data in the browser, the super admin (no school) chats with
// the platform assistant without saved sessions, everyone else talks to the Copilot API.
const demo = () => import("./demo/mock");
const isDemo = () => authStore.getState().isDemo;
const isPlatform = () => !isDemo() && authStore.getState().user?.role === "SUPER_ADMIN";
const PLATFORM_ID = "platform";
let platformConversation: string | null = null;

async function platformReply(message: string): Promise<string> {
  const { sendAiMessage } = await import("../ai/api");
  const res = await sendAiMessage("SUPER_ADMIN", message, platformConversation);
  platformConversation = res.conversation_id;
  return res.response;
}

export const fetchProfile = async () => (isDemo() ? (await demo()).fetchProfile() : real_fetchProfile());
export const fetchContext = async () => (isDemo() ? (await demo()).fetchContext() : real_fetchContext());
export const listSessions = async () => (isDemo() ? (await demo()).listSessions() : isPlatform() ? [] : real_listSessions());
export const getSession = async (id: string) => (isDemo() ? (await demo()).getSession(id) : real_getSession(id));
export const deleteSession = async (id: string) => (isDemo() ? (await demo()).deleteSession(id) : real_deleteSession(id));

export async function startSession(mode: Mode, language: string, ctx: StudyContextSel): Promise<CopilotSession> {
  if (isDemo()) return (await demo()).startSession(mode, language, ctx);
  if (isPlatform()) {
    platformConversation = null;
    return { id: PLATFORM_ID, mode: "school", title: null, language, label: null, context: { class_id: null, subject_id: null, chapter: null, student_id: null }, messages: [] };
  }
  return real_startSession(mode, language, ctx);
}

export async function sendMessage(sessionId: string, message: string): Promise<{ reply: string; title: string | null }> {
  if (isDemo()) return (await demo()).sendMessage(sessionId, message);
  if (sessionId === PLATFORM_ID) return { reply: await platformReply(message), title: message.slice(0, 60) };
  return real_sendMessage(sessionId, message);
}

export async function streamMessage(sessionId: string, message: string, onChunk: (text: string) => void, signal?: AbortSignal): Promise<string | null> {
  if (isDemo()) return (await demo()).streamMessage(sessionId, message, onChunk);
  if (sessionId === PLATFORM_ID) {
    onChunk(await platformReply(message));
    return message.slice(0, 60);
  }
  return real_streamMessage(sessionId, message, onChunk, signal);
}

export async function runTool<T = Record<string, unknown>>(key: string, ctx: StudyContextSel, params: Record<string, unknown>, language: string): Promise<T> {
  if (isDemo()) return (await demo()).runTool<T>(key, ctx, params, language);
  return real_runTool<T>(key, ctx, params, language);
}

export function errorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
  const e = err as { response?: { data?: { detail?: unknown } }; message?: string };
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  return e?.message && !e.message.startsWith("Request failed with status code") ? e.message : fallback;
}
