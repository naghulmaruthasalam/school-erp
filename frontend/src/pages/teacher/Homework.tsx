import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, useRef } from "react";
import { Link } from "react-router-dom";
import { Button, Card, ErrorText, PageHeader, Spinner, Badge } from "../../components/ui";
import { createHomework, listHomework } from "./api";
import { sectionLabel, useClasses, useMySectionIds, useOwnTeacherId, useSections, useSubjects } from "./hooks";
import type { HomeworkCreateRequest } from "./types";
import {
  Sparkles, Send, FileUp, X, Bot, Wand2, Copy, Check, Loader2,
  MessageCircle, BookOpen, Calendar, Clock, GraduationCap
} from "lucide-react";
import { api } from "../../api/client";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const emptyForm: HomeworkCreateRequest = {
  section_id: "", subject_id: "", title: "", description: "",
  assigned_date: todayIso(), due_date: todayIso(),
};

interface ChatMessage { role: "user" | "assistant"; content: string; }

export default function TeacherHomework() {
  const teacherId = useOwnTeacherId();
  const sectionIds = useMySectionIds();
  const { data: sections } = useSections();
  const { data: classes } = useClasses();
  const { data: subjects } = useSubjects();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<HomeworkCreateRequest>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCopilot, setShowCopilot] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiDifficulty, setAiDifficulty] = useState("medium");
  const [generatedContent, setGeneratedContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);

  const homeworkQuery = useQuery({
    queryKey: ["teacher", "homework"],
    queryFn: () => listHomework({ page_size: 100 }),
  });

  const myHomework = (homeworkQuery.data?.items ?? []).filter((h) => h.teacher_id === teacherId);

  const createMutation = useMutation({
    mutationFn: async (payload: HomeworkCreateRequest) => {
      const attachment_document_ids: string[] = [];
      for (const file of attachments) {
        const body = new FormData();
        body.append("file", file);
        body.append("module", "HOMEWORK_ATTACHMENT");
        const { data } = await api.post<{ id: string }>("/uploads", body);
        attachment_document_ids.push(data.id);
      }
      return createHomework({ ...payload, attachment_document_ids });
    },
    onSuccess: () => {
      setFormError(null); setForm(emptyForm); setAttachments([]); setGeneratedContent("");
      void queryClient.invalidateQueries({ queryKey: ["teacher", "homework"] });
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setFormError(message ?? "Failed to create homework.");
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.section_id || !form.subject_id || !form.title || !form.assigned_date || !form.due_date) {
      setFormError("Section, subject, title, assigned date and due date are required.");
      return;
    }
    createMutation.mutate({ ...form, description: form.description || null });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files) setAttachments((prev) => [...prev, ...Array.from(files)]);
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function generateHomework() {
    if (!form.subject_id || !aiTopic) return;
    setIsGenerating(true);
    try {
      const subjectName = subjects?.find((s) => s.id === form.subject_id)?.name || "General";
      const section = sections?.find((s) => s.id === form.section_id);
      const cls = section ? classes?.find((c) => c.id === section.class_id) : null;
      const gradeName = cls?.name || "Class";
      const response = await api.post("/ai/generate-homework", {
        subject: subjectName, grade: gradeName, topic: aiTopic, difficulty: aiDifficulty,
      });
      setGeneratedContent(response.data.content);
    } catch (error) {
      console.error("Failed to generate homework:", error);
      setFormError("Failed to generate homework. Please try again.");
    } finally { setIsGenerating(false); }
  }

  function useGeneratedContent() {
    if (generatedContent) {
      setForm((f) => ({ ...f, description: generatedContent, title: f.title || `${aiTopic} Assignment` }));
      setShowCopilot(false);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function sendChatMessage() {
    if (!chatInput.trim()) return;
    const userMessage = chatInput;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsChatting(true);
    try {
      const response = await api.post("/ai/teacher", { message: userMessage });
      setChatMessages((prev) => [...prev, { role: "assistant", content: response.data.response }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    } finally { setIsChatting(false); }
  }

  const stats = [
    { icon: BookOpen, label: "Total Assigned", value: myHomework.length, color: "from-violet-500 to-purple-500" },
    { icon: Clock, label: "Due Today", value: myHomework.filter(h => h.due_date === todayIso()).length, color: "from-amber-500 to-orange-500" },
    { icon: GraduationCap, label: "Sections", value: sectionIds.length, color: "from-blue-500 to-cyan-500" },
  ];

  return (
    <div className="animate-page-enter">
      <PageHeader title="Homework" subtitle="Assign homework and review submissions">
        <Button onClick={() => setShowCopilot(!showCopilot)} glow className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> AI Copilot
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {stats.map((s, i) => (
          <div key={i} className={`p-4 rounded-2xl bg-gradient-to-br ${s.color} text-white`}>
            <s.icon className="w-6 h-6 mb-2 opacity-80" />
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-sm text-white/80">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="mb-6" gradient>
            <h2 className="mb-4 font-bold text-ink dark:text-white flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                <Wand2 className="w-4 h-4 text-white" />
              </div>
              Assign New Homework
            </h2>
            <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-ink dark:text-white mb-2">Section</label>
                <select value={form.section_id} onChange={(e) => setForm((f) => ({ ...f, section_id: e.target.value }))}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm focus:border-accent focus:ring-2 focus:ring-accent/30">
                  <option value="">Select a section</option>
                  {sectionIds.map((id) => <option key={id} value={id}>{sectionLabel(id, sections, classes)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink dark:text-white mb-2">Subject</label>
                <select value={form.subject_id} onChange={(e) => setForm((f) => ({ ...f, subject_id: e.target.value }))}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm focus:border-accent focus:ring-2 focus:ring-accent/30">
                  <option value="">Select a subject</option>
                  {subjects?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-ink dark:text-white mb-2">Title</label>
                <input type="text" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm" placeholder="e.g. Algebra worksheet" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-ink dark:text-white mb-2">Description / Instructions</label>
                <textarea rows={5} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm min-h-[120px]"
                  placeholder="Enter homework instructions or use AI Copilot to generate..." />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-ink dark:text-white mb-2">Attachments</label>
                <div className="flex items-center gap-3">
                  <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png" />
                  <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                    <FileUp className="w-4 h-4" /> Upload Files
                  </Button>
                  <span className="text-xs text-ink-3">PDF, DOC, PPT, Excel, Images</span>
                </div>
                {attachments.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {attachments.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between px-4 py-2 bg-surface-3 rounded-xl">
                        <span className="text-sm text-ink dark:text-white truncate">{file.name}</span>
                        <button type="button" onClick={() => removeAttachment(idx)} className="text-ink-3 hover:text-red-500">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-ink dark:text-white mb-2">Assigned Date</label>
                <input type="date" value={form.assigned_date} onChange={(e) => setForm((f) => ({ ...f, assigned_date: e.target.value }))}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink dark:text-white mb-2">Due Date</label>
                <input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm" />
              </div>
              <div className="sm:col-span-2 flex items-center gap-3">
                <Button type="submit" disabled={createMutation.isPending} glow>
                  {createMutation.isPending ? <Spinner size="sm" /> : <Send className="w-4 h-4" />}
                  {createMutation.isPending ? "Assigning..." : "Assign to Students"}
                </Button>
                <ErrorText>{formError}</ErrorText>
              </div>
            </form>
          </Card>

          {/* Homework List */}
          <h2 className="mb-4 font-bold text-ink dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-accent-fg" /> Assigned Homework
          </h2>
          {homeworkQuery.isLoading ? (
            <Card className="py-12 flex justify-center"><Spinner size="lg" /></Card>
          ) : myHomework.length === 0 ? (
            <Card className="text-center py-12">
              <BookOpen className="w-12 h-12 mx-auto text-ink-3 mb-4" />
              <p className="text-ink-3">No homework assigned yet.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {myHomework.map((hw) => (
                <Card key={hw.id} className="hover:shadow-lg transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <Link to={`/teacher/homework/${hw.id}`} className="font-bold text-ink dark:text-white hover:text-accent-fg">
                          {hw.title}
                        </Link>
                        <p className="text-sm text-ink-3">
                          {sectionLabel(hw.section_id, sections, classes)} • {subjects?.find((s) => s.id === hw.subject_id)?.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone={hw.due_date === todayIso() ? "amber" : "gray"}>Due: {hw.due_date}</Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* AI Copilot Sidebar */}
        <div className="lg:col-span-1">
          {showCopilot ? (
            <Card className="sticky top-4" gradient>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-ink dark:text-white flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  AI Homework Generator
                </h3>
                <button onClick={() => setShowCopilot(false)} className="text-ink-3 hover:text-accent-fg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink dark:text-white mb-2">Topic / Chapter</label>
                  <input type="text" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm" placeholder="e.g. Quadratic Equations" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink dark:text-white mb-2">Difficulty Level</label>
                  <select value={aiDifficulty} onChange={(e) => setAiDifficulty(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm">
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                <Button onClick={generateHomework} disabled={isGenerating || !form.subject_id || !aiTopic} className="w-full" glow>
                  {isGenerating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate Homework</>}
                </Button>

                {generatedContent && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-ink dark:text-white">Generated Content</label>
                      <button onClick={copyToClipboard} className="text-xs text-accent-fg hover:text-accent-fg flex items-center gap-1">
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto p-4 bg-surface-3 rounded-xl text-sm text-ink dark:text-white whitespace-pre-wrap">
                      {generatedContent}
                    </div>
                    <Button onClick={useGeneratedContent} variant="secondary" className="w-full mt-3">Use This Content</Button>
                  </div>
                )}
              </div>

              {/* Mini Chat */}
              <div className="mt-6 pt-4 border-t border-line">
                <h4 className="text-sm font-bold text-ink dark:text-white flex items-center gap-2 mb-3">
                  <MessageCircle className="w-4 h-4 text-accent-fg" /> Ask AI Assistant
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-2 mb-3">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`text-xs p-3 rounded-xl ${msg.role === "user" ? "bg-gradient-to-r from-accent to-accent-2 text-white ml-4" : "bg-surface-3 text-ink dark:text-white mr-4"}`}>
                      {msg.content}
                    </div>
                  ))}
                  {isChatting && (
                    <div className="text-xs p-3 rounded-xl bg-surface-3 text-ink-3 mr-4 flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" /> Thinking...
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask anything..."
                    className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-xs"
                    onKeyDown={(e) => e.key === "Enter" && sendChatMessage()} />
                  <Button onClick={sendChatMessage} disabled={isChatting} className="px-3"><Send className="w-3 h-3" /></Button>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="text-center py-8" gradient>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center mx-auto mb-4">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <p className="text-ink dark:text-white font-bold mb-2">AI Homework Generator</p>
              <p className="text-sm text-ink-3 mb-4">Need help creating homework? Use AI to generate questions and instructions.</p>
              <Button onClick={() => setShowCopilot(true)} glow>
                <Sparkles className="w-4 h-4" /> Open AI Copilot
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
