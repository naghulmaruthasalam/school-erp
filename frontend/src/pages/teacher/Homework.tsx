import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button, Card, ErrorText, PageHeader, Spinner, Badge } from "../../components/ui";
import { createHomework, listHomework } from "./api";
import { sectionLabel, useClasses, useMySectionIds, useOwnTeacherId, useSections, useSubjects } from "./hooks";
import type { HomeworkCreateRequest } from "./types";
import { Send, FileUp, X, Wand2, BookOpen, Calendar, Clock, GraduationCap } from "lucide-react";
import { api } from "../../api/client";
import { fetchSyllabusTree } from "../admin/syllabusApi";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const emptyForm: HomeworkCreateRequest = {
  section_id: "", subject_id: "", title: "", description: "", chapter: "",
  assigned_date: todayIso(), due_date: todayIso(),
};

export default function TeacherHomework() {
  const teacherId = useOwnTeacherId();
  const sectionIds = useMySectionIds();
  const { data: sections } = useSections();
  const { data: classes } = useClasses();
  const { data: subjects } = useSubjects();
  const queryClient = useQueryClient();

  const location = useLocation();
  const prefill = (location.state as { prefill?: { class_id?: string; subject_id?: string; chapter?: string; title?: string; description?: string } } | null)?.prefill;
  const [form, setForm] = useState<HomeworkCreateRequest>(() => ({
    ...emptyForm,
    subject_id: prefill?.subject_id ?? "",
    chapter: prefill?.chapter ?? "",
    title: prefill?.title ?? "",
    description: prefill?.description ?? "",
  }));
  const treeQuery = useQuery({ queryKey: ["syllabus", "tree"], queryFn: fetchSyllabusTree, staleTime: 60_000 });
  const [formError, setFormError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const homeworkQuery = useQuery({
    queryKey: ["teacher", "homework"],
    queryFn: () => listHomework({ page_size: 100 }),
  });

  // Coming from a chapter: pre-select the section of that class when there is exactly one to choose from.
  const prefilledSection = useRef(false);
  useEffect(() => {
    if (!prefill?.class_id || prefilledSection.current || !sections || sectionIds.length === 0) return;
    prefilledSection.current = true;
    const match = sectionIds.filter((id) => sections.find((s) => s.id === id)?.class_id === prefill.class_id);
    if (match.length === 1) setForm((f) => ({ ...f, section_id: match[0] }));
  }, [prefill?.class_id, sections, sectionIds]);

  const formClassId = sections?.find((s) => s.id === form.section_id)?.class_id ?? prefill?.class_id;
  const chapterOptions =
    treeQuery.data
      ?.filter((c) => !formClassId || c.id === formClassId)
      .flatMap((c) => c.subjects.filter((sub) => sub.id === form.subject_id).flatMap((sub) => sub.chapters.map((ch) => ch.name))) ?? [];

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
      setFormError(null); setForm(emptyForm); setAttachments([]); 
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
    createMutation.mutate({ ...form, description: form.description || null, chapter: form.chapter?.trim() || null });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files) setAttachments((prev) => [...prev, ...Array.from(files)]);
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }





  const stats = [
    { icon: BookOpen, label: "Total Assigned", value: myHomework.length, color: "from-violet-500 to-purple-500" },
    { icon: Clock, label: "Due Today", value: myHomework.filter(h => h.due_date === todayIso()).length, color: "from-amber-500 to-orange-500" },
    { icon: GraduationCap, label: "Sections", value: sectionIds.length, color: "from-blue-500 to-cyan-500" },
  ];

  return (
    <div className="animate-page-enter">
      <PageHeader title="Homework" subtitle="Assign homework and review submissions" />

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

      <div className="grid grid-cols-1 gap-6">
        <div>
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
                <label className="block text-sm font-medium text-ink dark:text-white mb-2">Chapter <span className="font-normal text-ink-3">(optional)</span></label>
                <input type="text" list="hw-chapters" value={form.chapter ?? ""} onChange={(e) => setForm((f) => ({ ...f, chapter: e.target.value }))}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm" placeholder="Pick from the syllabus or type one" />
                <datalist id="hw-chapters">{chapterOptions.map((c) => <option key={c} value={c} />)}</datalist>
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
                  placeholder="Enter the homework instructions…" />
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
                          {hw.chapter ? ` • ${hw.chapter}` : ""}
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

      </div>
    </div>
  );
}
