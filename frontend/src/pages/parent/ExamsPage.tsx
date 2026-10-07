import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Card, ErrorText, PageHeader, Spinner } from "../../components/ui";
import { fetchExamResult, fetchExams, fetchReportCardPdf } from "./api";
import { formatDisplayDate } from "./dates";
import { useSubjects } from "./hooks";
import { useSelectedChild } from "./SelectedChildContext";
import type { ExamOut } from "./types";
import { useLanguage } from "../../i18n/LanguageContext";

function ResultPanel({ examId, studentId }: { examId: string; studentId: string }) {
  const { t, te } = useLanguage();
  const subjectsQuery = useSubjects();
  const resultQuery = useQuery({
    queryKey: ["parent", "exam-result", examId, studentId],
    queryFn: () => fetchExamResult(examId, studentId),
  });

  const subjectName = (id: string) => te("subject", subjectsQuery.data?.find((s) => s.id === id)?.name ?? id);

  if (resultQuery.isLoading) return <Spinner className="my-3" />;
  if (resultQuery.error) return <ErrorText>{t("parent.exams.resultUnavailable")}</ErrorText>;
  const result = resultQuery.data;
  if (!result) return null;

  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-line">
      <table className="min-w-full divide-y divide-line text-sm">
        <thead className="bg-violet-50">
          <tr>
            <th className="px-3 py-2 text-start text-xs font-medium uppercase text-accent-fg">{t("parent.exams.subject")}</th>
            <th className="px-3 py-2 text-start text-xs font-medium uppercase text-accent-fg">{t("parent.exams.maxMarks")}</th>
            <th className="px-3 py-2 text-start text-xs font-medium uppercase text-accent-fg">{t("parent.exams.obtained")}</th>
            <th className="px-3 py-2 text-start text-xs font-medium uppercase text-accent-fg">{t("parent.exams.grade")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {result.subjects.map((s) => (
            <tr key={s.exam_subject_id}>
              <td className="px-3 py-2 text-ink-2">{subjectName(s.subject_id)}</td>
              <td className="px-3 py-2 text-ink-2">{s.max_marks}</td>
              <td className="px-3 py-2 text-ink-2">{s.marks_obtained ?? "—"}</td>
              <td className="px-3 py-2 text-ink-2">{s.grade ?? "—"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-violet-50 font-medium">
          <tr>
            <td className="px-3 py-2 text-ink">{t("parent.exams.total")}</td>
            <td className="px-3 py-2 text-ink">{result.total_max_marks}</td>
            <td className="px-3 py-2 text-ink">{result.total_marks_obtained}</td>
            <td className="px-3 py-2 text-ink">
              {result.overall_grade} ({result.percentage.toFixed(1)}%)
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function ExamsPage() {
  const { t } = useLanguage();
  const { selectedChild, selectedChildId } = useSelectedChild();
  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);
  const [downloadingExamId, setDownloadingExamId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const examsQuery = useQuery({
    queryKey: ["parent", "exams", selectedChild?.class_id],
    queryFn: () => fetchExams({ page_size: 200 }),
    enabled: !!selectedChild,
  });

  if (!selectedChild) {
    return (
      <div>
        <PageHeader title={t("exams.title")} />
        <p className="text-sm text-accent-fg">{t("parent.exams.selectChild")}</p>
      </div>
    );
  }

  const child = selectedChild;

  const exams: ExamOut[] =
    examsQuery.data?.items
      .filter((e) => !e.class_ids?.length || e.class_ids?.includes(child.class_id))
      .sort((a, b) => b.start_date.localeCompare(a.start_date)) ?? [];

  async function handleDownload(exam: ExamOut) {
    if (!selectedChildId) return;
    setDownloadError(null);
    setDownloadingExamId(exam.id);
    try {
      const blob = await fetchReportCardPdf(exam.id, selectedChildId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${child.full_name.replace(/\s+/g, "_")}_${exam.name.replace(/\s+/g, "_")}_report_card.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setDownloadError(t("parent.exams.downloadFailed"));
    } finally {
      setDownloadingExamId(null);
    }
  }

  return (
    <div>
      <PageHeader title={t("exams.title")} subtitle={t("parent.exams.subtitle", { name: selectedChild.full_name })} />

      {examsQuery.error && <ErrorText>{t("parent.exams.loadError")}</ErrorText>}
      {downloadError && <ErrorText>{downloadError}</ErrorText>}

      {examsQuery.isLoading ? (
        <Spinner />
      ) : exams.length === 0 ? (
        <Card>
          <p className="text-sm text-accent-fg">{t("parent.exams.empty")}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {exams.map((exam) => {
            const isPast = exam.end_date < new Date().toISOString().slice(0, 10);
            const isExpanded = expandedExamId === exam.id;
            return (
              <Card key={exam.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{exam.name}</p>
                    <p className="text-xs text-accent-fg">
                      {exam.term ? `${exam.term} — ` : ""}
                      {t("parent.exams.dateRange", { from: formatDisplayDate(exam.start_date), to: formatDisplayDate(exam.end_date) })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={isPast ? "gray" : "yellow"}>{isPast ? t("exams.completed") : t("exams.upcoming")}</Badge>
                    <Button
                      variant="secondary"
                      onClick={() => setExpandedExamId(isExpanded ? null : exam.id)}
                    >
                      {isExpanded ? t("parent.exams.hideResult") : t("exams.viewResults")}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={downloadingExamId === exam.id}
                      onClick={() => handleDownload(exam)}
                    >
                      {downloadingExamId === exam.id ? t("parent.exams.preparing") : t("parent.exams.downloadReportCard")}
                    </Button>
                  </div>
                </div>
                {isExpanded && selectedChildId && <ResultPanel examId={exam.id} studentId={selectedChildId} />}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
