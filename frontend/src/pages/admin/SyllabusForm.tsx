import { useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, PageHeader, Spinner, Input, Label } from "../../components/ui";
import { fetchAcademicYears, fetchClasses, fetchSubjects } from "./api";
import { getSyllabus, createSyllabus, updateSyllabus, uploadSyllabusDocument } from "./syllabusApi";
import type { SyllabusChapter } from "./syllabusApi";

interface ChapterForm {
  id?: string;
  name: string;
  description: string;
  order: number;
  topicsText?: string;
  content?: string;
}

export default function SyllabusForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    academic_year_id: "",
    class_id: "",
    subject_id: "",
    status: "DRAFT" as "DRAFT" | "PUBLISHED",
  });
  const [chapters, setChapters] = useState<ChapterForm[]>([]);
  const [documents, setDocuments] = useState<{ id: string; filename: string }[]>([]);

  const yearsQuery = useQuery({ queryKey: ["academicYears"], queryFn: fetchAcademicYears });
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: () => fetchClasses() });
  const subjectsQuery = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });

  const syllabusQuery = useQuery({
    queryKey: ["syllabus", id],
    queryFn: () => getSyllabus(id!),
    enabled: isEdit,
  });

  // Populate form when editing
  if (isEdit && syllabusQuery.data && form.title === "") {
    const syl = syllabusQuery.data;
    setForm({
      title: syl.title,
      description: syl.description,
      academic_year_id: syl.academic_year_id,
      class_id: syl.class_id,
      subject_id: syl.subject_id,
      status: syl.status,
    });
    setChapters(syl.chapters.map((c: SyllabusChapter) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      order: c.order,
      topicsText: (c.topics ?? []).join("; "),
      content: c.content ?? "",
    })));
    setDocuments(syl.documents || []);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        chapters: chapters.map(({ topicsText, ...c }) => ({
          ...c,
          topics: (topicsText ?? "").split(/[;\n]/).map((t) => t.trim()).filter(Boolean),
        })),
      };
      if (isEdit) {
        return updateSyllabus(id!, payload);
      }
      return createSyllabus(payload);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["syllabus"] });
      navigate(`/admin/syllabus/${data.id}`);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadSyllabusDocument(id!, file),
    onSuccess: (doc) => {
      setDocuments([...documents, doc]);
      queryClient.invalidateQueries({ queryKey: ["syllabus", id] });
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
  });

  const addChapter = () => {
    setChapters([...chapters, { name: "", description: "", order: chapters.length + 1 }]);
  };

  const updateChapter = (index: number, field: keyof ChapterForm, value: string | number) => {
    const updated = [...chapters];
    updated[index] = { ...updated[index], [field]: value };
    setChapters(updated);
  };

  const removeChapter = (index: number) => {
    setChapters(chapters.filter((_, i) => i !== index));
  };

  const moveChapter = (index: number, direction: -1 | 1) => {
    if ((direction === -1 && index === 0) || (direction === 1 && index === chapters.length - 1)) return;
    const updated = [...chapters];
    const temp = updated[index];
    updated[index] = updated[index + direction];
    updated[index + direction] = temp;
    updated.forEach((c, i) => (c.order = i + 1));
    setChapters(updated);
  };

  if (isEdit && syllabusQuery.isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={isEdit ? "Edit Syllabus" : "Create Syllabus"}
        subtitle={isEdit ? "Update syllabus details and chapters" : "Define curriculum for a class and subject"}
      />

      <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-6">
        <Card>
          <h2 className="text-lg font-semibold text-ink mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="md:col-span-2 lg:col-span-3">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g., Mathematics Grade 10 - 2024"
                required
              />
            </div>
            <div>
              <Label>Academic Year</Label>
              <select
                value={form.academic_year_id}
                onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500"
                required
              >
                <option value="">-- Select --</option>
                {yearsQuery.data?.map((y) => (
                  <option key={y.id} value={y.id}>{y.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Class</Label>
              <select
                value={form.class_id}
                onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500"
                required
              >
                <option value="">-- Select --</option>
                {classesQuery.data?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Subject</Label>
              <select
                value={form.subject_id}
                onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500"
                required
              >
                <option value="">-- Select --</option>
                {subjectsQuery.data?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <Label>Description</Label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500"
                rows={3}
                placeholder="Brief description of the syllabus..."
              />
            </div>
            <div>
              <Label>Status</Label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as "DRAFT" | "PUBLISHED" })}
                className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500"
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-ink">Chapters</h2>
            <Button type="button" variant="secondary" onClick={addChapter}>Add Chapter</Button>
          </div>

          {chapters.length === 0 ? (
            <p className="text-center text-accent-fg py-4">No chapters added. Click "Add Chapter" to begin.</p>
          ) : (
            <div className="space-y-4">
              {chapters.map((ch, idx) => (
                <div key={idx} className="border border-line rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-medium text-accent-fg">Chapter {idx + 1}</span>
                    <div className="flex-1" />
                    <button type="button" onClick={() => moveChapter(idx, -1)} className="text-accent-fg hover:text-ink-2 disabled:opacity-30" disabled={idx === 0}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <button type="button" onClick={() => moveChapter(idx, 1)} className="text-accent-fg hover:text-ink-2 disabled:opacity-30" disabled={idx === chapters.length - 1}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    <button type="button" onClick={() => removeChapter(idx)} className="text-red-500 hover:text-red-700">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Chapter Name</Label>
                      <Input
                        value={ch.name}
                        onChange={(e) => updateChapter(idx, "name", e.target.value)}
                        placeholder="e.g., Introduction to Algebra"
                        required
                      />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <Input
                        value={ch.description}
                        onChange={(e) => updateChapter(idx, "description", e.target.value)}
                        placeholder="Brief chapter description..."
                      />
                    </div>
                    <div>
                      <Label>Topics (separate with ;)</Label>
                      <Input
                        value={ch.topicsText ?? ""}
                        onChange={(e) => updateChapter(idx, "topicsText", e.target.value)}
                        placeholder="e.g., Push and pull; Types of force"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label>Study notes (used by the Copilot to explain this chapter)</Label>
                      <textarea
                        value={ch.content ?? ""}
                        onChange={(e) => updateChapter(idx, "content", e.target.value)}
                        rows={4}
                        className="lg-field w-full"
                        placeholder="Key points, definitions and examples from the textbook…"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {isEdit && (
          <Card>
            <h2 className="text-lg font-semibold text-ink mb-4">Documents</h2>
            <div className="flex flex-wrap items-center gap-4 mb-4">
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadMutation.mutate(file);
                }}
                className="hidden"
                accept=".pdf,.doc,.docx"
              />
              <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
                {uploadMutation.isPending ? "Uploading..." : "Upload Document"}
              </Button>
            </div>
            {documents.length > 0 ? (
              <ul className="space-y-2">
                {documents.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-2 text-sm text-ink-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    {doc.filename}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-accent-fg">No documents uploaded.</p>
            )}
          </Card>
        )}

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving..." : isEdit ? "Update Syllabus" : "Create Syllabus"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
