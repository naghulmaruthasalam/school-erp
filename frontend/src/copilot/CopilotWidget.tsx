import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen, CalendarCheck, CalendarRange, ClipboardCheck, FileQuestion, FileText, HeartHandshake, History, Lightbulb, ListChecks, Megaphone,
  NotebookPen, Download, MessageSquareText, Mic, Send, Sparkles, Square, Trash2, Volume2, VolumeX, Wrench, X, type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useAuthStore } from "../auth/store";
import { Button, ErrorText, Select } from "../components/ui";
import {
  deleteSession, fetchContext, fetchProfile, getSession, listSessions, sendMessage, startSession,
  streamMessage, streamVoice, type CopilotMessage, type CopilotProfile, type CopilotSession, type Mode, type StudyContextSel, type ToolSpec,
} from "./api";
import ContextPicker from "./ContextPicker";
import { useCopilotText } from "./i18n";
import Markdown from "./Markdown";
import { downloadCopilotFile, type CopilotFileInfo } from "./download";
import ToolRunner from "./ToolRunner";
import { OPEN_COPILOT_EVENT, type OpenCopilotDetail } from "./events";
import { guessLanguage, speak, startRecording, stopSpeaking, voiceSupported, type Recorder } from "./voice";

/** A chat message plus what Riyah knows about it: the language it was spoken/written in, and whether it came by voice. */
type Msg = CopilotMessage & { lang?: string; voice?: boolean };
const SPEAK_KEY = "riyah.speak";
const readSpeakPref = () => {
  try { return localStorage.getItem(SPEAK_KEY) !== "off"; } catch { return true; }
};

type Tab = "chat" | "tools" | "history";

const TOOL_ICONS: Record<string, LucideIcon> = {
  ListChecks, CalendarCheck, CalendarRange, ClipboardCheck, FileQuestion, FileText, HeartHandshake, Lightbulb, Megaphone,
  MessageSquareText, NotebookPen,
};

/** The one Copilot button for every login (student, parent, teacher, principal, school admin, super admin). What it
 * offers (modes, quick actions, tools) comes from the server's profile for the signed-in role; in demo mode the same
 * panel runs on sample data. Shows nothing only if an operator switched the Copilot off for the role. */
export default function CopilotWidget() {
  const { t, err } = useCopilotText();
  const user = useAuthStore((s) => s.user);
  const isDemo = useAuthStore((s) => s.isDemo);
  const profileQuery = useQuery({
    queryKey: ["copilot", "profile", user?.id, isDemo],
    queryFn: fetchProfile,
    enabled: !!user,
    retry: false,
    staleTime: 10 * 60 * 1000,
  });
  if (!user) return null;
  if (profileQuery.isError) return <CopilotUnavailable reason={err(profileQuery.error, t("copilot.unavailable.unreachable"))} onRetry={() => void profileQuery.refetch()} />;
  if (!profileQuery.data || profileQuery.data.enabled === false) return null;
  return <CopilotPanel profile={profileQuery.data} />;
}

/** Same round button, so the Copilot is always in the same place; explains why it isn't ready and lets the user retry. */
function CopilotUnavailable({ reason, onRetry }: { reason: string; onRetry: () => void }) {
  const { t } = useCopilotText();
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-24 end-4 z-50 lg:bottom-6 lg:end-6">
      {open && (
        <div role="dialog" aria-label="Copilot" className="glass-strong mb-3 w-[min(22rem,calc(100vw-2rem))] space-y-2 rounded-[24px] p-4 animate-pop-in">
          <p className="text-sm font-semibold text-ink">{t("copilot.unavailable.title")}</p>
          <p className="text-[13px] text-ink-3">{reason}</p>
          <Button size="sm" onClick={onRetry}>{t("copilot.unavailable.retry")}</Button>
        </div>
      )}
      <button onClick={() => setOpen(!open)} className="group relative ms-auto block" aria-label={t("copilot.open")}>
        <div className="glass relative grid h-14 w-14 place-items-center !rounded-full transition-transform duration-300 group-hover:scale-110">
          <div className="absolute inset-1.5 rounded-full bg-gradient-to-br from-accent to-accent-2 opacity-70" />
          <Sparkles className="relative text-white" size={24} />
        </div>
      </button>
    </div>
  );
}

function CopilotPanel({ profile }: { profile: CopilotProfile }) {
  const qc = useQueryClient();
  const { t, tr, fmtDate, language: uiLanguage, err, toolTitle, toolDescription, profileTitle, profileTagline, quick: quickLabel, languageName } = useCopilotText();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const [mode, setMode] = useState<Mode>(profile.default_mode);
  // "auto" = Riyah answers in the language of each message (spoken or typed); a named language pins the reply language.
  const [langChoice, setLangChoice] = useState("auto");
  const uiLanguageName = uiLanguage === "ar" ? "Arabic" : "English";
  const language = langChoice === "auto" ? uiLanguageName : langChoice;
  const pinned = langChoice === "auto" ? undefined : langChoice;
  const [ctx, setCtx] = useState<StudyContextSel>({});
  const [session, setSession] = useState<CopilotSession | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolSpec | null>(null);
  const [historyView, setHistoryView] = useState<"chats" | "files">("chats");
  const bottomRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const finishRef = useRef<() => Promise<void>>(async () => {});
  const [recording, setRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [speakOn, setSpeakOn] = useState(readSpeakPref);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const voiceReady = !!profile.voice?.stt && !profile.platform && voiceSupported();

  const contextQuery = useQuery({ queryKey: ["copilot", "context"], queryFn: fetchContext, enabled: open && !profile.platform, staleTime: 5 * 60 * 1000 });
  const historyQuery = useQuery({ queryKey: ["copilot", "sessions"], queryFn: listSessions, enabled: open && tab === "history" });
  const filesQuery = useQuery({
    queryKey: ["copilot", "files"],
    queryFn: async () => (await api.get<CopilotFileInfo[]>("/copilot/files")).data,
    enabled: open && tab === "history" && historyView === "files",
  });
  const removeFile = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/copilot/files/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["copilot", "files"] }),
  });

  // Other pages (the syllabus browser, homework) can open the Copilot on a chapter with a tool or a first message.
  useEffect(() => {
    function onOpen(e: Event) {
      const d = (e as CustomEvent<OpenCopilotDetail>).detail ?? {};
      setOpen(true);
      setSession(null);
      setMessages([]);
      setError(null);
      setMode("study");
      setCtx({ classId: d.classId, subjectId: d.subjectId, chapter: d.chapter });
      const wanted = d.tool ? profile.tools.find((x) => x.key === d.tool) : undefined;
      if (wanted) {
        setTool(wanted);
        setTab("tools");
      } else {
        setTool(null);
        setTab("chat");
        setInput(d.message ?? "");
      }
    }
    window.addEventListener(OPEN_COPILOT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_COPILOT_EVENT, onOpen);
  }, [profile.tools]);

  useEffect(() => {
    if (open) return;
    recorderRef.current?.cancel();
    recorderRef.current = null;
    setRecording(false);
    stopSpeaking();
    setSpeakingIdx(null);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, open, tab]);

  const title = profileTitle(profile);
  const tagline = profileTagline(profile);
  const modeLabel = (m: Mode) => t(`copilot.modes.${m}`);
  const welcome = t("copilot.riyah.hello") + " " + (mode === "school" ? t("copilot.welcome.school", { title }) : t("copilot.welcome.study", { title, tagline }));

  function reset(next?: Partial<{ mode: Mode; ctx: StudyContextSel; language: string }>) {
    setSession(null);
    setMessages([]);
    setError(null);
    if (next?.mode) setMode(next.mode);
    if (next?.ctx) setCtx(next.ctx);
    if (next?.language) setLangChoice(next.language);
    stopSpeaking();
    setSpeakingIdx(null);
    setVoiceNote(null);
  }

  const canChat = mode === "school" || !!ctx.classId;

  async function ensureSession(): Promise<CopilotSession | null> {
    if (session) return session;
    try {
      const started = await startSession(mode, language, ctx);
      setSession(started);
      qc.invalidateQueries({ queryKey: ["copilot", "sessions"] });
      return started;
    } catch (e) {
      setError(err(e));
      return null;
    }
  }

  const setLast = (patch: (m: Msg) => Msg, fromEnd = 1) =>
    setMessages((m) => m.map((x, i) => (i === m.length - fromEnd ? patch(x) : x)));

  /** Reads a reply aloud (the server voice when available, else the device's), in the language it was written in. */
  async function say(index: number, text: string, lang: string) {
    setVoiceNote(null);
    setSpeakingIdx(index);
    const r = await speak(text, lang, { server: !!profile.voice?.tts, onEnd: () => setSpeakingIdx((cur) => (cur === index ? null : cur)) });
    if (r === "no-voice") setVoiceNote(t("copilot.riyah.noVoice", { language: languageName(lang) }));
    if (r === "no-voice" || r === "unsupported") setSpeakingIdx(null);
  }

  async function send(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    setError(null);
    setInput("");
    setBusy(true);
    const active = await ensureSession();
    if (!active) {
      setBusy(false);
      setInput(text);
      return;
    }
    setMessages((m) => [...m, { role: "user", content: text }, { role: "assistant", content: "" }]);
    let received = false;
    const append = (chunk: string) => {
      received = true;
      setLast((x) => ({ ...x, content: x.content + chunk }));
    };
    try {
      await streamMessage(active.id, text, append, undefined, pinned);
      setLast((x) => ({ ...x, lang: pinned ?? guessLanguage(text, uiLanguageName) }));
    } catch (e) {
      if (received) {
        setError(err(e));
      } else {
        try {
          // The stream couldn't start (e.g. an expired token being refreshed): use the plain endpoint.
          const res = await sendMessage(active.id, text, pinned);
          append(res.reply);
        } catch (e2) {
          setMessages((m) => m.slice(0, -2));
          setInput(text);
          setError(err(e2));
        }
      }
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["copilot", "sessions"] });
    }
  }

  async function toggleMic() {
    if (recording) return void finishRecording();
    if (busy || !canChat) return;
    setError(null);
    setVoiceNote(null);
    stopSpeaking();
    setSpeakingIdx(null);
    try {
      recorderRef.current = await startRecording(setLevel, 60, () => void finishRef.current());
      setRecording(true);
    } catch {
      setError(t("copilot.riyah.micDenied"));
    }
  }

  async function finishRecording() {
    const rec = recorderRef.current;
    recorderRef.current = null;
    setRecording(false);
    setLevel(0);
    if (!rec) return;
    const wav = await rec.stop();
    if (wav.size < 6000) { // under ~0.2 s of audio: nothing was said
      setError(t("copilot.riyah.tooShort"));
      return;
    }
    setBusy(true);
    const active = await ensureSession();
    if (!active) return void setBusy(false);
    const replyIndex = messages.length + 1;
    setMessages((m) => [...m, { role: "user", content: "", voice: true }, { role: "assistant", content: "" }]);
    let reply = "";
    let replyLang = pinned ?? uiLanguageName;
    try {
      await streamVoice(active.id, wav, pinned, {
        onTranscript: (tr) => {
          replyLang = tr.reply_language || tr.language || replyLang;
          setLast((x) => ({ ...x, content: tr.text, lang: tr.language }), 2);
        },
        onChunk: (c) => {
          reply += c;
          setLast((x) => ({ ...x, content: x.content + c, lang: replyLang }));
        },
      });
      if (speakOn && reply) void say(replyIndex, reply, replyLang);
    } catch (e) {
      if (!reply) setMessages((m) => m.slice(0, -2));
      setError(err(e));
    } finally {
      setBusy(false);
      qc.invalidateQueries({ queryKey: ["copilot", "sessions"] });
    }
  }

  finishRef.current = finishRecording;

  function toggleSpeak() {
    const next = !speakOn;
    setSpeakOn(next);
    try { localStorage.setItem(SPEAK_KEY, next ? "on" : "off"); } catch { /* preference only */ }
    if (!next) { stopSpeaking(); setSpeakingIdx(null); }
  }

  const loadSession = useMutation({
    mutationFn: getSession,
    onSuccess: (s) => {
      setSession(s);
      setMessages(s.messages);
      setMode(s.mode);
      setLangChoice("auto");
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
        <button onClick={() => setOpen(true)} className="animate-float group relative" aria-label={t("copilot.open")}>
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
      <div role="dialog" aria-label={title} className="glass-strong flex h-[min(42rem,84vh)] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[28px] animate-pop-in origin-bottom-right rtl:origin-bottom-left">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 px-4 pb-2 pt-3.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-accent" />
              <span className="truncate text-sm font-semibold tracking-tight text-ink">{title}</span>
            </div>
            <p className="truncate text-xs text-ink-3">{tagline}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Select
              aria-label={t("copilot.replyLanguage")}
              className="!min-h-8 !w-auto !px-2 !py-0 !text-xs"
              value={langChoice}
              onChange={(e) => reset({ language: e.target.value })}
            >
              <option value="auto">{t("copilot.riyah.auto")}</option>
              {profile.languages.map((l) => (
                <option key={l} value={l}>{languageName(l)}</option>
              ))}
            </Select>
            <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-3 text-ink-3 hover:text-ink" aria-label={t("copilot.close")}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 pb-2">
          <div className="lg-seg w-full [&>button]:flex-1">
            <button aria-pressed={tab === "chat"} onClick={() => setTab("chat")}><Mic size={14} className="me-1 inline" />{t("copilot.tabs.chat")}</button>
            {profile.tools.length > 0 && (
              <button aria-pressed={tab === "tools"} onClick={() => { setTab("tools"); setTool(null); }}><Wrench size={14} className="me-1 inline" />{t("copilot.tabs.tools")}</button>
            )}
            {!profile.platform && <button aria-pressed={tab === "history"} onClick={() => setTab("history")}><History size={14} className="me-1 inline" />{t("copilot.tabs.history")}</button>}
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
                      {m === "study" ? <BookOpen size={13} className="me-1 inline" /> : null}{modeLabel(m)}
                    </button>
                  ))}
                </div>
              )}
              {mode === "study" && contextQuery.data && (
                <ContextPicker options={contextQuery.data} value={ctx} onChange={(c) => reset({ ctx: c })} />
              )}
              {mode === "study" && !profile.ai_configured && (
                <p className="rounded-xl bg-amber-500/15 px-3 py-2 text-xs text-ink-2">
                  {t("copilot.aiKeyMissing")}
                </p>
              )}
            </div>
            <div className="flex-1 space-y-2.5 overflow-y-auto px-4 pb-3">
              {messages.length === 0 && (
                <p className="rounded-2xl bg-surface-3 px-3.5 py-3 text-[13px] leading-relaxed text-ink-2 animate-fade-in-up">{welcome}</p>
              )}
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="ms-auto max-w-[85%] rounded-[20px] rounded-ee-md rtl:ms-0 rtl:me-auto rtl:rounded-ee-[20px] rtl:rounded-es-md bg-gradient-to-br from-accent to-accent-2 px-3.5 py-2 text-sm leading-snug text-white shadow-md shadow-accent/25">
                    {m.voice && <Mic size={12} className="me-1 inline opacity-80" />}
                    {m.content || (m.voice ? <span className="opacity-80">{t("copilot.riyah.listening")}</span> : null)}
                    {m.voice && m.lang && <span className="mt-0.5 block text-[10px] uppercase tracking-wide opacity-80">{t("copilot.riyah.heard", { language: languageName(m.lang) })}</span>}
                  </div>
                ) : (
                  <div key={i} className="max-w-[92%] rtl:ms-auto rounded-[20px] rounded-es-md rtl:rounded-es-[20px] rtl:rounded-ee-md bg-surface-3 px-3.5 py-2.5 text-ink">
                    {m.content ? (
                      <>
                        <Markdown>{m.content}</Markdown>
                        {!busy && (
                          <button
                            type="button"
                            className="mt-1 inline-flex items-center gap-1 text-[11px] text-ink-3 hover:text-accent"
                            aria-label={speakingIdx === i ? t("copilot.riyah.stopSpeaking") : t("copilot.riyah.listen")}
                            onClick={() => (speakingIdx === i ? (stopSpeaking(), setSpeakingIdx(null)) : void say(i, m.content, m.lang ?? guessLanguage(m.content, language)))}
                          >
                            {speakingIdx === i ? <Square size={11} /> : <Volume2 size={12} />}
                            {speakingIdx === i ? t("copilot.riyah.stopSpeaking") : t("copilot.riyah.listen")}
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="flex w-fit gap-1 py-1" aria-label={t("copilot.thinking")}>
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
                    <button key={q} onClick={() => send(q)} className="lg-chip !text-xs">{quickLabel(q)}</button>
                  ))}
                </div>
              )}
              {error && <ErrorText>{error}</ErrorText>}
              <div ref={bottomRef} />
            </div>
            {voiceNote && <p className="px-4 pb-1 text-[11px] text-amber-600 dark:text-amber-400">{voiceNote}</p>}
            {recording && (
              <div className="flex items-center gap-2 px-4 pb-1 text-xs text-ink-2" role="status">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                {t("copilot.riyah.recording")}
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3"><span className="block h-full rounded-full bg-accent transition-[width] duration-100" style={{ width: `${Math.round(level * 100)}%` }} /></span>
              </div>
            )}
            <div className="flex gap-2 border-t border-line p-3">
              {voiceReady && (
                <button
                  type="button"
                  onClick={toggleMic}
                  disabled={busy || !canChat}
                  aria-pressed={recording}
                  aria-label={recording ? t("copilot.riyah.stopRecording") : t("copilot.riyah.speak")}
                  title={recording ? t("copilot.riyah.stopRecording") : t("copilot.riyah.speak")}
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-full transition disabled:opacity-40 ${recording ? "bg-red-500 text-white animate-pulse" : "bg-surface-3 text-ink-2 hover:text-accent"}`}
                >
                  {recording ? <Square size={16} /> : <Mic size={18} />}
                </button>
              )}
              <input
                className="lg-field"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
                placeholder={canChat ? t("copilot.input.placeholder") : t("copilot.input.chooseClass")}
                maxLength={2000}
                disabled={!canChat || recording}
              />
              {voiceReady && (
                <button type="button" onClick={toggleSpeak} aria-pressed={speakOn} aria-label={t("copilot.riyah.autoSpeak")} title={t("copilot.riyah.autoSpeak")} className="grid h-11 w-9 shrink-0 place-items-center text-ink-3 hover:text-accent">
                  {speakOn ? <Volume2 size={17} /> : <VolumeX size={17} />}
                </button>
              )}
              <Button onClick={() => send(input)} disabled={busy || !canChat || !input.trim()} className="!px-3.5" aria-label={t("copilot.send")}>
                <Send size={16} className="rtl:-scale-x-100" />
              </Button>
            </div>
          </>
        )}

        {tab === "tools" && (
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {contextQuery.isLoading && <p className="text-[13px] text-ink-3">{t("copilot.loading")}</p>}
            {contextQuery.data && !tool && (
              <div className="grid gap-2">
                {profile.tools.map((tl) => {
                  const Icon = TOOL_ICONS[tl.icon] ?? Wrench;
                  return (
                    <button key={tl.key} onClick={() => setTool(tl)} className="glass-row !items-start text-start">
                      <span className="lg-icon !h-9 !w-9 shrink-0 !rounded-[12px]"><Icon size={18} /></span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink">{toolTitle(tl)}</span>
                        <span className="block text-xs text-ink-3">{toolDescription(tl)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {contextQuery.data && tool && (
              <ToolRunner key={`${tool.key}|${ctx.classId}|${ctx.subjectId}|${ctx.chapter}`} tool={tool} options={contextQuery.data} language={language} initialContext={ctx} onBack={() => setTool(null)} />
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
            <div className="lg-seg w-full [&>button]:flex-1">
              <button aria-pressed={historyView === "chats"} onClick={() => setHistoryView("chats")}>{t("copilot.history.chats")}</button>
              <button aria-pressed={historyView === "files"} onClick={() => setHistoryView("files")}>{t("copilot.history.files")}</button>
            </div>
            {historyView === "chats" && (
              <>
                {historyQuery.isLoading && <p className="text-[13px] text-ink-3">{t("copilot.loading")}</p>}
                {historyQuery.data?.length === 0 && <p className="text-[13px] text-ink-3">{t("copilot.history.noChats")}</p>}
                {historyQuery.data?.map((s) => (
                  <div key={s.id} className="glass-row !py-2">
                    <button className="min-w-0 flex-1 text-start" onClick={() => loadSession.mutate(s.id)}>
                      <span className="block truncate text-sm font-medium text-ink">{s.title ?? t("copilot.history.newChatTitle")}</span>
                      <span className="block truncate text-xs text-ink-3">{modeLabel(s.mode)}{s.label ? ` · ${s.label}` : ""} · {fmtDate(s.updated_at)}</span>
                    </button>
                    <button aria-label={t("copilot.history.deleteChat")} className="text-ink-3 hover:text-red-500" onClick={() => removeSession.mutate(s.id)}><Trash2 size={15} /></button>
                  </div>
                ))}
                <Button variant="secondary" size="sm" className="w-full" onClick={() => { reset(); setTab("chat"); }}>{t("copilot.history.newChat")}</Button>
              </>
            )}
            {historyView === "files" && (
              <>
                {filesQuery.isLoading && <p className="text-[13px] text-ink-3">{t("copilot.loading")}</p>}
                {filesQuery.data?.length === 0 && <p className="text-[13px] text-ink-3">{t("copilot.history.noFiles")}</p>}
                {filesQuery.data?.map((f) => (
                  <div key={f.id} className="glass-row !py-2">
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{f.title}</span>
                      <span className="block truncate text-xs text-ink-3">{tr(`copilot.kinds.${f.kind}`, f.kind)} · {fmtDate(f.created_at)} · {t("copilot.history.sizeKb", { n: Math.max(1, Math.round(f.size_bytes / 1024)) })}</span>
                    </div>
                    <button aria-label={t("copilot.history.download")} className="text-ink-3 hover:text-accent" onClick={() => downloadCopilotFile(f.id, f.filename)}><Download size={16} /></button>
                    <button aria-label={t("copilot.history.deleteFile")} className="text-ink-3 hover:text-red-500" onClick={() => removeFile.mutate(f.id)}><Trash2 size={15} /></button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
