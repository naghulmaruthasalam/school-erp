import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, PageHeader, Spinner, Badge } from "../../components/ui";
import { api } from "../../api/client";
import { fetchClasses, fetchSections, fetchSubjects, listTeachers } from "./api";
import type { PageResponse } from "../../types/common";

interface Homework {
  id: string;
  title: string;
  description: string;
  section_id: string;
  subject_id: string;
  teacher_id: string;
  due_date: string;
  status: string;
  created_at: string;
}

export default function HomeworkList() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedSection, setSelectedSection] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    section_id: "",
    subject_id: "",
    teacher_id: "",
    due_date: "",
  });

  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: () => fetchClasses() });
  const sectionsQuery = useQuery({ queryKey: ["sections"], queryFn: () => fetchSections() });
  const subjectsQuery = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });
  const teachersQuery = useQuery({ queryKey: ["teachers", "all"], queryFn: () => listTeachers({ page_size: 100 }) });

  const homeworkQuery = useQuery({
    queryKey: ["homework", selectedSection],
    queryFn: async () => {
      const { data } = await api.get<PageResponse<Homework>>("/homework", {
        params: selectedSection ? { section_id: selectedSection } : undefined,
      });
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const { data } = await api.post("/homework", {
        ...payload,
        teacher_id: payload.teacher_id || undefined,
        assigned_date: new Date().toISOString().slice(0, 10),
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["homework"] });
      setShowForm(false);
      setForm({ title: "", description: "", section_id: "", subject_id: "", teacher_id: "", due_date: "" });
    },
  });

  const getSectionName = (id: string) => {
    const section = sectionsQuery.data?.find((s) => s.id === id);
    if (!section) return id;
    const cls = classesQuery.data?.find((c) => c.id === section.class_id);
    return `${cls?.name || ""} - ${section.name}`;
  };

  const getSubjectName = (id: string) => subjectsQuery.data?.find((s) => s.id === id)?.name || id;

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Homework Management" subtitle="Assign and track homework">
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "Assign Homework"}</Button>
      </PageHeader>

      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-ink-2">Filter by Section:</label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="rounded-lg border border-line px-3 py-2 focus:border-violet-500"
          >
            <option value="">All Sections</option>
            {sectionsQuery.data?.map((s) => (
              <option key={s.id} value={s.id}>{getSectionName(s.id)}</option>
            ))}
          </select>
        </div>
      </Card>

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-ink-2 mb-1">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border border-line px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">Due Date</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full rounded-lg border border-line px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">Section</label>
                <select
                  value={form.section_id}
                  onChange={(e) => setForm({ ...form, section_id: e.target.value })}
                  className="w-full rounded-lg border border-line px-3 py-2"
                  required
                >
                  <option value="">-- Select --</option>
                  {sectionsQuery.data?.map((s) => (
                    <option key={s.id} value={s.id}>{getSectionName(s.id)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">Subject</label>
                <select
                  value={form.subject_id}
                  onChange={(e) => setForm({ ...form, subject_id: e.target.value })}
                  className="w-full rounded-lg border border-line px-3 py-2"
                  required
                >
                  <option value="">-- Select --</option>
                  {subjectsQuery.data?.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">Teacher (optional)</label>
                <select
                  value={form.teacher_id}
                  onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}
                  className="w-full rounded-lg border border-line px-3 py-2"
                >
                  <option value="">Auto (subject teacher)</option>
                  {teachersQuery.data?.items.map((t) => (
                    <option key={t.id} value={t.id}>{t.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className="block text-sm font-medium text-ink-2 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border border-line px-3 py-2"
                  rows={3}
                  required
                />
              </div>
            </div>
            {createMutation.isError && (
              <p className="text-sm text-red-600">
                {(createMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to assign homework."}
              </p>
            )}
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Assigning..." : "Assign Homework"}
            </Button>
          </form>
        </Card>
      )}

      {homeworkQuery.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="space-y-3">
          {homeworkQuery.data?.items.map((hw) => (
            <Card key={hw.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-ink">{hw.title}</h3>
                    <Badge tone={hw.status === "ACTIVE" ? "green" : hw.status === "COMPLETED" ? "violet" : "gray"}>{hw.status}</Badge>
                  </div>
                  <p className="text-sm text-ink-2 mb-2">{hw.description}</p>
                  <div className="flex items-center gap-4 text-xs text-accent-fg">
                    <span>{getSectionName(hw.section_id)}</span>
                    <span>{getSubjectName(hw.subject_id)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-ink">Due: {new Date(hw.due_date).toLocaleDateString()}</p>
                  <p className="text-xs text-accent-fg">Created: {new Date(hw.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </Card>
          ))}
          {homeworkQuery.data?.items.length === 0 && (
            <Card><p className="text-center text-accent-fg py-8">No homework assigned.</p></Card>
          )}
        </div>
      )}
    </div>
  );
}
