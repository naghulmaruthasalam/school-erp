import { useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "../auth/store";
import { Button, Input } from "../components/ui";
import { sendAiMessage } from "./api";

interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

/** Floating role-aware AI assistant chat, mounted once per dashboard layout.
 * Calls the role-appropriate /ai/{role} endpoint — the backend decides what
 * data/tools that role is allowed to use; this widget has no authorization
 * logic of its own. */
export default function AiChatWidget() {
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [eyePos, setEyePos] = useState({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const x = Math.max(-2, Math.min(2, (e.clientX - centerX) / 100));
      const y = Math.max(-2, Math.min(2, (e.clientY - centerY) / 100));
      setEyePos({ x, y });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const mutation = useMutation({
    mutationFn: async (message: string) => {
      if (!user) throw new Error("Not signed in");
      return sendAiMessage(user.role, message, conversationId);
    },
    onSuccess: (data) => {
      setConversationId(data.conversation_id);
      setTurns((t) => [...t, { role: "assistant", text: data.response }]);
    },
    onError: () => {
      setTurns((t) => [...t, { role: "assistant", text: "Sorry, something went wrong. Please try again." }]);
    },
  });

  if (!user) return null;

  const placeholderByRole: Record<string, string> = {
    super_admin: "Ask about schools, users, analytics, or platform settings.",
    school_admin: "Ask about staff, students, fees, reports, or school settings.",
    teacher: "Ask about your classes, attendance, grades, or timetable.",
    student: "Ask about your homework, attendance, timetable, exams, or fees.",
    parent: "Ask about your child's attendance, grades, fees, or homework.",
  };
  const placeholder = placeholderByRole[user.role] || "How can I help you today?";

  function handleSend() {
    const message = input.trim();
    if (!message || mutation.isPending) return;
    setTurns((t) => [...t, { role: "user", text: message }]);
    setInput("");
    mutation.mutate(message);
  }

  return (
    <div className="fixed bottom-24 end-4 z-50 lg:bottom-6 lg:end-6">
      {open ? (
        <div className="glass-strong flex h-[min(30rem,72vh)] w-[min(21rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-[28px] animate-pop-in origin-bottom-right">
          <div className="flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60 animate-ping" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
              </span>
              <span className="text-sm font-semibold tracking-tight text-ink">AI Assistant</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-3 text-xs text-ink-3 transition-all hover:scale-105 hover:text-ink"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 space-y-2.5 overflow-y-auto px-3.5 pb-3">
            {turns.length === 0 && (
              <p className="rounded-2xl bg-surface-3 px-3.5 py-3 text-[13px] leading-relaxed text-ink-2 animate-fade-in-up">
                {placeholder}
              </p>
            )}
            {turns.map((turn, i) => (
              <div
                key={i}
                className={`max-w-[85%] px-3.5 py-2 text-sm leading-snug animate-pop-in ${
                  turn.role === "user"
                    ? "ms-auto rounded-[20px] rounded-ee-md bg-gradient-to-br from-accent to-accent-2 text-white shadow-md shadow-accent/25"
                    : "rounded-[20px] rounded-es-md bg-surface-3 text-ink"
                }`}
                style={{ animationDelay: `${i * 30}ms` }}
              >
                {turn.text}
              </div>
            ))}
            {mutation.isPending && (
              <div className="flex w-fit gap-1 rounded-full bg-surface-3 px-3 py-2.5">
                <div className="h-1.5 w-1.5 rounded-full bg-ink-3 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-ink-3 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-1.5 w-1.5 rounded-full bg-ink-3 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
          </div>
          <div className="flex gap-2 border-t border-line p-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type a question..."
            />
            <Button onClick={handleSend} disabled={mutation.isPending} className="!px-4">
              Send
            </Button>
          </div>
        </div>
      ) : (
        <button
          ref={buttonRef}
          onClick={() => setOpen(true)}
          className="animate-float relative group"
          aria-label="Open AI Assistant"
        >
          {/* Modern AI Assistant Icon */}
          <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 shadow-lg shadow-violet-500/40 transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-violet-500/50 flex items-center justify-center overflow-hidden">
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/20 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity" />
            {/* Inner glow */}
            <div className="absolute inset-1 rounded-xl bg-gradient-to-br from-white/20 to-transparent" />
            {/* AI Icon - Sparkle/Brain hybrid */}
            <svg className="relative w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.3" />
            </svg>
            {/* Pulse ring */}
            <div className="absolute inset-0 rounded-2xl border-2 border-white/30 animate-ping opacity-30" style={{ animationDuration: '2s' }} />
          </div>
          {/* Status dot */}
          <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-400 rounded-full border-2 border-white shadow-sm">
            <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-50" />
          </div>
        </button>
      )}
    </div>
  );
}
