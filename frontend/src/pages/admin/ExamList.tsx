import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, PageHeader, Spinner, Badge } from "../../components/ui";
import { api } from "../../api/client";
import { fetchAcademicYears, fetchClasses } from "./api";
import type { PageResponse } from "../../types/common";

interface Exam {
  id: string;
  name: string;
  exam_type: string;
  academic_year_id: string;
  class_id: string;
  start_date: string;
  end_date: string;
  status: string;
}

export default function ExamList() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    exam_type: "UNIT_TEST",
    academic_year_id: "",
    class_id: "",
    start_date: "",
    end_date: "",
  });

  const yearsQuery = useQuery({ queryKey: ["academic-years"], queryFn: fetchAcademicYears });
  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: () => fetchClasses() });

  const examsQuery = useQuery({
    queryKey: ["exams"],
    queryFn: async () => {
      const { data } = await api.get<PageResponse<Exam>>("/exams");
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const { data } = await api.post("/exams", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      setShowForm(false);
      setForm({ name: "", exam_type: "UNIT_TEST", academic_year_id: "", class_id: "", start_date: "", end_date: "" });
    },
  });

  const getClassName = (id: string) => classesQuery.data?.find((c) => c.id === id)?.name || id;
  const getYearName = (id: string) => yearsQuery.data?.find((y) => y.id === id)?.name || id;

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Examination Management" subtitle="Schedule and manage exams">
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "Create Exam"}</Button>
      </PageHeader>

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-violet-700 mb-1">Exam Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-violet-700 mb-1">Type</label>
                <select
                  value={form.exam_type}
                  onChange={(e) => setForm({ ...form, exam_type: e.target.value })}
                  className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500"
                >
                  <option value="UNIT_TEST">Unit Test</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="HALF_YEARLY">Half Yearly</option>
                  <option value="ANNUAL">Annual</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-violet-700 mb-1">Academic Year</label>
                <select
                  value={form.academic_year_id}
                  onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })}
                  className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500"
                  required
                >
                  <option value="">-- Select --</option>
                  {yearsQuery.data?.map((y) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-violet-700 mb-1">Class</label>
                <select
                  value={form.class_id}
                  onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                  className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500"
                  required
                >
                  <option value="">-- Select --</option>
                  {classesQuery.data?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-violet-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-violet-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500"
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Exam"}
            </Button>
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
                    <h3 className="font-semibold text-violet-900">{exam.name}</h3>
                    <Badge tone={exam.status === "COMPLETED" ? "green" : exam.status === "CANCELLED" ? "red" : exam.status === "IN_PROGRESS" ? "yellow" : "violet"}>{exam.status}</Badge>
                    <Badge tone="violet">{exam.exam_type}</Badge>
                  </div>
                  <p className="text-sm text-violet-600">
                    {getClassName(exam.class_id)} · {getYearName(exam.academic_year_id)}
                  </p>
                  <p className="text-xs text-violet-400">
                    {new Date(exam.start_date).toLocaleDateString()} - {new Date(exam.end_date).toLocaleDateString()}
                  </p>
                </div>
                <Button variant="secondary">View Results</Button>
              </div>
            </Card>
          ))}
          {examsQuery.data?.items.length === 0 && (
            <Card><p className="text-center text-violet-400 py-8">No exams scheduled.</p></Card>
          )}
        </div>
      )}
    </div>
  );
}
