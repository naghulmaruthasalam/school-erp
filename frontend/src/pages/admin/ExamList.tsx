import { useState } from "react";
import { EXAM_STATUS_TONE, EXAM_TERMS, examStatus } from "../../lib/exam";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, PageHeader, Spinner, Badge } from "../../components/ui";
import { ExamSubjectsPanel } from "../../components/ExamSubjectsPanel";
import { api } from "../../api/client";
import { fetchAcademicYears, fetchClasses } from "./api";
import type { PageResponse } from "../../types/common";
import { useLanguage } from "../../i18n/LanguageContext";

const TERM_KEYS: Record<string, string> = {
  "Unit Test": "admin.exams.terms.unitTest",
  Quarterly: "admin.exams.terms.quarterly",
  "Half Yearly": "admin.exams.terms.halfYearly",
  Annual: "admin.exams.terms.annual",
};

interface Exam {
  id: string;
  name: string;
  term?: string | null;
  academic_year_id: string;
  class_ids: string[];
  start_date: string;
  end_date: string;
}

export default function ExamList() {
  const { t, te, fmtDate } = useLanguage();
  const termLabel = (v: string) => (TERM_KEYS[v] ? t(TERM_KEYS[v]) : v);
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

  const getClassName = (id: string) => te("class", classesQuery.data?.find((c) => c.id === id)?.name) || id;
  const getYearName = (id: string) => yearsQuery.data?.find((y) => y.id === id)?.name || id;

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={t("admin.exams.title")} subtitle={t("admin.exams.subtitle")}>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? t("admin.common.cancel") : t("admin.exams.create")}</Button>
      </PageHeader>

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.exams.examName")}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.exams.term")}</label>
                <select
                  value={form.term}
                  onChange={(e) => setForm({ ...form, term: e.target.value })}
                  className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500"
                >
                  {EXAM_TERMS.map((term) => (
                    <option key={term} value={term}>{termLabel(term)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.common.academicYear")}</label>
                <select
                  value={form.academic_year_id}
                  onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })}
                  className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500"
                  required
                >
                  <option value="">{t("admin.common.selectDash")}</option>
                  {yearsQuery.data?.map((y) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.common.class")}</label>
                <select
                  value={form.class_id}
                  onChange={(e) => setForm({ ...form, class_id: e.target.value })}
                  className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500"
                  required
                >
                  <option value="">{t("admin.common.selectDash")}</option>
                  {classesQuery.data?.map((c) => (
                    <option key={c.id} value={c.id}>{te("class", c.name)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.common.startDate")}</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.common.endDate")}</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500"
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? t("admin.common.creating") : t("admin.exams.create")}
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
                    <h3 className="font-semibold text-ink">{exam.name}</h3>
                    <Badge tone={EXAM_STATUS_TONE[examStatus(exam.start_date, exam.end_date)]}>
                      {te("status", examStatus(exam.start_date, exam.end_date).replace("_", " "))}
                    </Badge>
                    {exam.term && <Badge tone="violet">{termLabel(exam.term)}</Badge>}
                  </div>
                  <p className="text-sm text-accent-fg">
                    {(exam.class_ids ?? []).map(getClassName).join(", ")} · {getYearName(exam.academic_year_id)}
                  </p>
                  <p className="text-xs text-accent-fg">
                    {fmtDate(exam.start_date)} - {fmtDate(exam.end_date)}
                  </p>
                </div>
                <Button variant="secondary" onClick={() => setOpenExamId(openExamId === exam.id ? null : exam.id)}>
                  {openExamId === exam.id ? t("admin.exams.hideSubjects") : t("admin.exams.subjectsMarks")}
                </Button>
              </div>
              {openExamId === exam.id && <ExamSubjectsPanel examId={exam.id} classIds={exam.class_ids} />}
            </Card>
          ))}
          {examsQuery.data?.items.length === 0 && (
            <Card><p className="text-center text-accent-fg py-8">{t("admin.exams.empty")}</p></Card>
          )}
        </div>
      )}
    </div>
  );
}
