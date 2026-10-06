import { useState } from "react";
import { EXAM_STATUS_TONE, examStatus } from "../../lib/exam";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, PageHeader, Spinner, Badge } from "../../components/ui";
import { ExamSubjectsPanel } from "../../components/ExamSubjectsPanel";
import { api } from "../../api/client";
import type { PageResponse } from "../../types/common";

interface Exam {
  id: string;
  name: string;
  term?: string | null;
  academic_year_id: string;
  class_ids: string[];
  start_date: string;
  end_date: string;
}

interface AcademicYear {
  id: string;
  name: string;
}

interface Class {
  id: string;
  name: string;
}

export default function ExamManagement() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [openExamId, setOpenExamId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    term: "Unit Test",
    academic_year_id: "",
    class_id: "",
    start_date: "",
    end_date: "",
  });

  const yearsQuery = useQuery({
    queryKey: ["academic-years"],
    queryFn: async () => {
      const { data } = await api.get<AcademicYear[]>("/academics/years");
      return data;
    },
  });

  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data } = await api.get<Class[]>("/academics/classes");
      return data;
    },
  });

  const examsQuery = useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const { data } = await api.get<PageResponse<Exam>>("/exams");
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const { class_id, ...rest } = payload;
      const { data } = await api.post("/exams", { ...rest, class_ids: [class_id] });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      setShowForm(false);
      setForm({ name: "", term: "Unit Test", academic_year_id: "", class_id: "", start_date: "", end_date: "" });
    },
  });

  const getClassName = (id: string) => classesQuery.data?.find((c) => c.id === id)?.name || id;
  const getYearName = (id: string) => yearsQuery.data?.find((y) => y.id === id)?.name || id;

  const examTypes = [
    { value: "UNIT_TEST", label: "Unit Test" },
    { value: "QUARTERLY", label: "Quarterly Exam" },
    { value: "HALF_YEARLY", label: "Half Yearly Exam" },
    { value: "ANNUAL", label: "Annual Exam" },
    { value: "PRELIMS", label: "Preliminary Exam" },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Examination Management" subtitle="Schedule and manage school examinations">
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "Schedule Exam"}</Button>
      </PageHeader>

      {showForm && (
        <Card className="mb-6">
          <h3 className="font-semibold text-ink dark:text-white mb-4">Schedule New Examination</h3>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">Exam Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink dark:text-white focus:border-accent focus:outline-none"
                  placeholder="e.g., First Unit Test"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">Exam Type</label>
                <select
                  value={form.term}
                  onChange={(e) => setForm({ ...form, term: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink dark:text-white focus:border-accent focus:outline-none"
                >
                  {examTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">Academic Year</label>
                <select
                  value={form.academic_year_id}
                  onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink dark:text-white focus:border-accent focus:outline-none"
                  required
                >
                  <option value="">Select Academic Year</option>
                  {yearsQuery.data?.map((y) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">Class</label>
                <select
                  value={form.class_id}
                  onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink dark:text-white focus:border-accent focus:outline-none"
                  required
                >
                  <option value="">Select Class</option>
                  {classesQuery.data?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">Start Date</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink dark:text-white focus:border-accent focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">End Date</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink dark:text-white focus:border-accent focus:outline-none"
                  required
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Scheduling..." : "Schedule Exam"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {examsQuery.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="space-y-4">
          {examsQuery.data?.items.map((exam) => (
            <Card key={exam.id}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-ink dark:text-white">{exam.name}</h3>
                    <Badge tone={EXAM_STATUS_TONE[examStatus(exam.start_date, exam.end_date)]}>
                      {examStatus(exam.start_date, exam.end_date).replace("_", " ")}
                    </Badge>
                    {exam.term && <Badge tone="violet">{exam.term}</Badge>}
                  </div>
                  <p className="text-sm text-ink-2">
                    {(exam.class_ids ?? []).map(getClassName).join(", ")} • {getYearName(exam.academic_year_id)}
                  </p>
                  <p className="text-xs text-ink-3">
                    {new Date(exam.start_date).toLocaleDateString()} - {new Date(exam.end_date).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => setOpenExamId(openExamId === exam.id ? null : exam.id)}>
                    {openExamId === exam.id ? "Hide subjects" : "Subjects & marks"}
                  </Button>
                </div>
              </div>
              {openExamId === exam.id && <ExamSubjectsPanel examId={exam.id} classIds={exam.class_ids} />}
            </Card>
          ))}
          {examsQuery.data?.items.length === 0 && (
            <Card>
              <p className="text-center text-ink-3 py-8">No exams scheduled yet. Click "Schedule Exam" to create one.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
