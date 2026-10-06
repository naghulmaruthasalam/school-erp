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
    <div className="fixed bottom-5 right-5 z-50">
      {open ? (
        <div className="flex h-[28rem] w-80 flex-col overflow-hidden rounded-2xl border border-violet-200 bg-violet-50 shadow-2xl animate-scale-in">
          <div className="flex items-center justify-between border-b border-violet-200 bg-gradient-to-r from-violet-600 to-purple-700 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse-soft" />
              <span className="text-sm font-medium">AI Assistant</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {turns.length === 0 && (
              <p className="text-xs text-violet-400 animate-fade-in-up">
                {placeholder}
              </p>
            )}
            {turns.map((turn, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm animate-slide-in-right ${
                  turn.role === "user"
                    ? "ml-auto bg-violet-600 text-white rounded-br-md"
                    : "bg-violet-100 text-violet-800 rounded-bl-md"
                }`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {turn.text}
              </div>
            ))}
            {mutation.isPending && (
              <div className="flex gap-1 p-2">
                <div className="h-2 w-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="h-2 w-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="h-2 w-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            )}
          </div>
          <div className="flex gap-2 border-t border-violet-200 p-3 bg-violet-100/50">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type a question..."
              className="bg-white border-violet-200"
            />
            <Button onClick={handleSend} disabled={mutation.isPending}>
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
          {/* Cat face */}
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-400 to-purple-500 shadow-lg shadow-purple-400/40 transition-all duration-300 group-hover:scale-110 relative">
            {/* Cat ears */}
            <div className="absolute -top-1.5 left-1 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-violet-400" />
            <div className="absolute -top-1.5 right-1 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px] border-b-violet-400" />
            {/* Left eye */}
            <div className="absolute top-4 left-2 w-2.5 h-2.5 bg-white rounded-full flex items-center justify-center overflow-hidden">
              <div className="w-1.5 h-1.5 bg-slate-800 rounded-full transition-transform duration-75" style={{ transform: `translate(${eyePos.x}px, ${eyePos.y}px)` }} />
            </div>
            {/* Right eye */}
            <div className="absolute top-4 right-2 w-2.5 h-2.5 bg-white rounded-full flex items-center justify-center overflow-hidden">
              <div className="w-1.5 h-1.5 bg-slate-800 rounded-full transition-transform duration-75" style={{ transform: `translate(${eyePos.x}px, ${eyePos.y}px)` }} />
            </div>
            {/* Nose */}
            <div className="absolute top-7 left-1/2 -translate-x-1/2 w-1.5 h-1 bg-pink-300 rounded-full" />
            {/* Mouth */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-3 h-1.5 border-b-2 border-pink-200 rounded-b-full" />
          </div>
          {/* Chat badge */}
          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md border border-purple-200">
            <svg className="w-3 h-3 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
            </svg>
          </div>
        </button>
      )}
    </div>
  );
}
