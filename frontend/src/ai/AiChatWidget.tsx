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
          {/* Glass orb with the mascot face */}
          <div className="glass relative grid h-14 w-14 place-items-center !rounded-full transition-transform duration-300 group-hover:scale-110">
            <div className="absolute inset-1.5 rounded-full bg-gradient-to-br from-accent to-accent-2 shadow-[0_8px_20px_-6px_var(--accent-glow)]" />
            <div className="absolute inset-1.5 rounded-full bg-gradient-to-b from-white/35 to-transparent" />
            <div className="relative h-8 w-8">
              {/* Ears */}
              <div className="absolute -top-1 left-0.5 h-0 w-0 border-b-[9px] border-l-[5px] border-r-[5px] border-b-white/80 border-l-transparent border-r-transparent" />
              <div className="absolute -top-1 right-0.5 h-0 w-0 border-b-[9px] border-l-[5px] border-r-[5px] border-b-white/80 border-l-transparent border-r-transparent" />
              {/* Eyes */}
              <div className="absolute left-1 top-2.5 flex h-2.5 w-2.5 items-center justify-center overflow-hidden rounded-full bg-surface">
                <div className="h-1.5 w-1.5 rounded-full bg-surface transition-transform duration-75" style={{ transform: `translate(${eyePos.x}px, ${eyePos.y}px)` }} />
              </div>
              <div className="absolute right-1 top-2.5 flex h-2.5 w-2.5 items-center justify-center overflow-hidden rounded-full bg-surface">
                <div className="h-1.5 w-1.5 rounded-full bg-surface transition-transform duration-75" style={{ transform: `translate(${eyePos.x}px, ${eyePos.y}px)` }} />
              </div>
              {/* Nose + mouth */}
              <div className="absolute left-1/2 top-5 h-1 w-1.5 -translate-x-1/2 rounded-full bg-pink-200" />
              <div className="absolute bottom-0.5 left-1/2 h-1.5 w-3 -translate-x-1/2 rounded-b-full border-b-2 border-pink-100" />
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
