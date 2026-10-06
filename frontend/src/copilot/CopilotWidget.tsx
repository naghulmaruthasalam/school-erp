import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen, CalendarCheck, CalendarRange, FileText, HeartHandshake, History, ListChecks, Megaphone,
  MessageSquareText, Send, Sparkles, Trash2, Wrench, X, type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import AiChatWidget from "../ai/AiChatWidget";
import { useAuthStore } from "../auth/store";
import { Button, ErrorText, Select } from "../components/ui";
import { useLanguage } from "../i18n/LanguageContext";
import {
  deleteSession, errorMessage, fetchContext, fetchProfile, getSession, listSessions, sendMessage, startSession,
  streamMessage, type CopilotMessage, type CopilotProfile, type CopilotSession, type Mode, type StudyContextSel, type ToolSpec,
} from "./api";
import ContextPicker from "./ContextPicker";
import Markdown from "./Markdown";
import ToolRunner from "./ToolRunner";

type Tab = "chat" | "tools" | "history";

const TOOL_ICONS: Record<string, LucideIcon> = {
  ListChecks, CalendarCheck, CalendarRange, FileText, HeartHandshake, Megaphone, MessageSquareText,
};

const MODE_LABEL: Record<Mode, string> = { school: "My school", study: "Study help" };

/** Role-aware Copilot (student, parent, teacher, and any role enabled on the server). Falls back to the
 * original AI assistant for roles without a Copilot profile, in demo mode, or if the profile can't load. */
export default function CopilotWidget() {
  const user = useAuthStore((s) => s.user);
  const isDemo = useAuthStore((s) => s.isDemo);
  const profileQuery = useQuery({
    queryKey: ["copilot", "profile", user?.id],
    queryFn: fetchProfile,
    enabled: !!user && !isDemo,
    retry: false,
    staleTime: 10 * 60 * 1000,
  });
  if (!user) return null;
  if (isDemo || profileQuery.isError || profileQuery.data?.enabled === false) return <AiChatWidget />;
  if (!profileQuery.data) return null;
  return <CopilotPanel profile={profileQuery.data} />;
}

function CopilotPanel({ profile }: { profile: CopilotProfile }) {
  const qc = useQueryClient();
  const { language: uiLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const [mode, setMode] = useState<Mode>(profile.default_mode);
  const [language, setLanguage] = useState(uiLanguage === "ar" ? "Arabic" : "English");
  const [ctx, setCtx] = useState<StudyContextSel>({});
  const [session, setSession] = useState<CopilotSession | null>(null);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolSpec | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const contextQuery = useQuery({ queryKey: ["copilot", "context"], queryFn: fetchContext, enabled: open, staleTime: 5 * 60 * 1000 });
  const historyQuery = useQuery({ queryKey: ["copilot", "sessions"], queryFn: listSessions, enabled: open && tab === "history" });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open, tab]);

  const welcome =
    mode === "school"
      ? `Hi! I'm your ${profile.title}. Ask me about your own school information, for example attendance, homework, timetable or results.`
      : `Hi! I'm your ${profile.title}. ${profile.tagline}. Pick a subject and chapter below, then ask away.`;

  function reset(next?: Partial<{ mode: Mode; ctx: StudyContextSel; language: string }>) {
    setSession(null);
    setMessages([]);
    setError(null);
    if (next?.mode) setMode(next.mode);
    if (next?.ctx) setCtx(next.ctx);
    if (next?.language) setLanguage(next.language);
  }

  const canChat = mode === "school" || !!ctx.classId;

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setError(null);
    setInput("");
    setBusy(true);
    let active = session;
    try {
      if (!active) {
        active = await startSession(mode, language, ctx);
        setSession(active);
        qc.invalidateQueries({ queryKey: ["copilot", "sessions"] });
      }
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
      setInput(text);
      return;
    }
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    let received = false;
    const append = (chunk: string) => {
      received = true;
      setMessages((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, content: x.content + chunk } : x)));
    };
    try {
      await streamMessage(active.id, text, append);
    } catch (e) {
      if (received) {
        setError(errorMessage(e));
      } else {
        try {
          // The stream couldn't start (e.g. an expired token being refreshed): use the plain endpoint.
          const res = await sendMessage(active.id, text);
          append(res.reply);
        } catch (e2) {
          setMessages((m) => m.slice(0, -2));
          setInput(text);
          setError(errorMessage(e2));
        }
      }
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["copilot", "sessions"] });
    }
  }

  const loadSession = useMutation({
    mutationFn: getSession,
    onSuccess: (s) => {
      setSession(s);
      setMessages(s.messages);
      setMode(s.mode);
      setLanguage(s.language);
      setCtx({ classId: s.context.class_id ?? undefined, subjectId: s.context.subject_id ?? undefined, chapter: s.context.chapter ?? undefined, studentId: s.context.student_id ?? undefined });
      setTab("chat");
    },
  });
  const removeSession = useMutation({
    mutationFn: deleteSession,
    onSuccess: (_d, id) => {
      if (session?.id === id) reset();
      qc.invalidateQueries({ queryKey: ["copilot", "sessions"] });
    },
  });

  if (!open) {
    return (
      <div className="fixed bottom-24 end-4 z-50 lg:bottom-6 lg:end-6">
        <button onClick={() => setOpen(true)} className="animate-float group relative" aria-label="Open AI Copilot">
          <div className="glass relative grid h-14 w-14 place-items-center !rounded-full transition-transform duration-300 group-hover:scale-110">
            <div className="absolute inset-1.5 rounded-full bg-gradient-to-br from-accent to-accent-2 shadow-[0_8px_20px_-6px_var(--accent-glow)]" />
            <div className="absolute inset-1.5 rounded-full bg-gradient-to-b from-white/35 to-transparent" />
            <Sparkles className="relative text-white" size={24} />
          </div>
        </button>
      </div>
    );
  }

  const quick = profile.quick_actions[mode] ?? [];
  const hasUserMessage = messages.some((m) => m.role === "user");

  return (
    <div className="fixed bottom-24 end-4 z-50 lg:bottom-6 lg:end-6">
      <div role="dialog" aria-label={profile.title} className="glass-strong flex h-[min(42rem,84vh)] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[28px] animate-pop-in origin-bottom-right">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 px-4 pb-2 pt-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-accent" />
              <span className="truncate text-sm font-semibold tracking-tight text-ink">{profile.title}</span>
            </div>
            <p className="truncate text-xs text-ink-3">{profile.tagline}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Select
              aria-label="Reply language"
              className="!min-h-8 !w-auto !px-2 !py-0 !text-xs"
              value={language}
              onChange={(e) => reset({ language: e.target.value })}
            >
              {profile.languages.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </Select>
            <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-3 text-ink-3 hover:text-ink" aria-label="Close">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 pb-2">
          <div className="lg-seg w-full [&>button]:flex-1">
            <button aria-pressed={tab === "chat"} onClick={() => setTab("chat")}><MessageSquareText size={14} className="me-1 inline" />Chat</button>
            {profile.tools.length > 0 && (
              <button aria-pressed={tab === "tools"} onClick={() => { setTab("tools"); setTool(null); }}><Wrench size={14} className="me-1 inline" />Tools</button>
            )}
            <button aria-pressed={tab === "history"} onClick={() => setTab("history")}><History size={14} className="me-1 inline" />History</button>
          </div>
        </div>

        {/* Body */}
        {tab === "chat" && (
          <>
            <div className="space-y-2 px-4 pb-2">
              {profile.modes.length > 1 && (
                <div className="lg-seg w-full [&>button]:flex-1">
                  {profile.modes.map((m) => (
                    <button key={m} aria-pressed={mode === m} onClick={() => mode !== m && reset({ mode: m })}>
                      {m === "study" ? <BookOpen size={13} className="me-1 inline" /> : null}{MODE_LABEL[m]}
                    </button>
                  ))}
                </div>
              )}
              {mode === "study" && contextQuery.data && (
                <ContextPicker options={contextQuery.data} value={ctx} onChange={(c) => reset({ ctx: c })} />
              )}
              {mode === "study" && !profile.ai_configured && (
                <p className="rounded-xl bg-amber-500/15 px-3 py-2 text-xs text-ink-2">
                  Study help needs the AI key to be set on the server. “My school” works without it.
                </p>
              )}
            </div>
            <div className="flex-1 space-y-2.5 overflow-y-auto px-4 pb-3">
              {messages.length === 0 && (
                <p className="rounded-2xl bg-surface-3 px-3.5 py-3 text-[13px] leading-relaxed text-ink-2 animate-fade-in-up">{welcome}</p>
              )}
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="ms-auto max-w-[85%] rounded-[20px] rounded-ee-md bg-gradient-to-br from-accent to-accent-2 px-3.5 py-2 text-sm leading-snug text-white shadow-md shadow-accent/25">
                    {m.content}
                  </div>
                ) : (
                  <div key={i} className="max-w-[92%] rounded-[20px] rounded-es-md bg-surface-3 px-3.5 py-2.5 text-ink">
                    {m.content ? (
                      <Markdown>{m.content}</Markdown>
                    ) : (
                      <div className="flex w-fit gap-1 py-1" aria-label="Thinking">
                        {[0, 150, 300].map((d) => (
                          <div key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-3" style={{ animationDelay: `${d}ms` }} />
                        ))}
                      </div>
                    )}
                  </div>
                ),
              )}
              {!hasUserMessage && canChat && quick.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {quick.map((q) => (
                    <button key={q} onClick={() => send(q)} className="lg-chip !text-xs">{q}</button>
                  ))}
                </div>
              )}
              {error && <ErrorText>{error}</ErrorText>}
              <div ref={bottomRef} />
            </div>
            <div className="flex gap-2 border-t border-line p-3">
              <input
                className="lg-field"
                value={input}
                disabled={!canChat}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
                placeholder={canChat ? "Type a question…" : "Choose a class to start"}
                maxLength={2000}
              />
              <Button onClick={() => send(input)} disabled={busy || !canChat || !input.trim()} className="!px-3.5" aria-label="Send">
                <Send size={16} className="rtl:-scale-x-100" />
              </Button>
            </div>
          </>
        )}

        {tab === "tools" && (
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {contextQuery.isLoading && <p className="text-[13px] text-ink-3">Loading…</p>}
            {contextQuery.data && !tool && (
              <div className="grid gap-2">
                {profile.tools.map((t) => {
                  const Icon = TOOL_ICONS[t.icon] ?? Wrench;
                  return (
                    <button key={t.key} onClick={() => setTool(t)} className="glass-row !items-start text-start">
                      <span className="lg-icon !h-9 !w-9 shrink-0 !rounded-[12px]"><Icon size={18} /></span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink">{t.title}</span>
                        <span className="block text-xs text-ink-3">{t.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {contextQuery.data && tool && (
              <ToolRunner key={tool.key} tool={tool} options={contextQuery.data} language={language} initialContext={ctx} onBack={() => setTool(null)} />
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
            {historyQuery.isLoading && <p className="text-[13px] text-ink-3">Loading…</p>}
            {historyQuery.data?.length === 0 && <p className="text-[13px] text-ink-3">No chats yet. Your conversations will appear here.</p>}
            {historyQuery.data?.map((s) => (
              <div key={s.id} className="glass-row !py-2">
                <button className="min-w-0 flex-1 text-start" onClick={() => loadSession.mutate(s.id)}>
                  <span className="block truncate text-sm font-medium text-ink">{s.title ?? "New chat"}</span>
                  <span className="block truncate text-xs text-ink-3">{MODE_LABEL[s.mode]}{s.label ? ` · ${s.label}` : ""} · {new Date(s.updated_at).toLocaleDateString()}</span>
                </button>
                <button aria-label="Delete chat" className="text-ink-3 hover:text-red-500" onClick={() => removeSession.mutate(s.id)}><Trash2 size={15} /></button>
              </div>
            ))}
            <Button variant="secondary" size="sm" className="w-full" onClick={() => { reset(); setTab("chat"); }}>New chat</Button>
          </div>
        )}
      </div>
    </div>
  );
}
