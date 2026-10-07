import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Card, ErrorText, PageHeader, Spinner } from "../../components/ui";
import { DataTable } from "../../components/DataTable";
import { useLanguage } from "../../i18n/LanguageContext";
import { fetchExamResult, fetchExams, fetchReportCardPdf } from "./api";
import { useMyProfile, useSubjects, subjectMap } from "./hooks";

function ReportCardButton({ examId, studentId, examName }: { examId: string; studentId: string; examName: string }) {
  const { t } = useLanguage();
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState("");

  async function handleDownload() {
    setIsDownloading(true);
    setError("");
    try {
      const blob = await fetchReportCardPdf(examId, studentId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-card-${examName.replace(/\s+/g, "-").toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(t("student.exams.reportUnavailable"));
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div>
      <Button variant="secondary" onClick={handleDownload} disabled={isDownloading}>
        {isDownloading ? t("student.exams.preparing") : t("student.exams.downloadReport")}
      </Button>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

function ExamResultPanel({
  examId,
  studentId,
  subjectNames,
}: {
  examId: string;
  studentId: string;
  subjectNames: Record<string, string>;
}) {
  const { t, te } = useLanguage();
  const { data: result, isLoading, error } = useQuery({
    queryKey: ["student", "exam-result", examId, studentId],
    queryFn: () => fetchExamResult(examId, studentId),
  });

  if (isLoading) return <Spinner />;
  if (error || !result) return <p className="text-sm text-accent-fg">{t("student.exams.notPublished")}</p>;

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-accent-fg">{t("student.exams.total")}</p>
          <p className="mt-0.5 text-sm text-ink">
            {result.total_marks_obtained} / {result.total_max_marks}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-accent-fg">{t("exams.percentage")}</p>
          <p className="mt-0.5 text-sm text-ink">{result.percentage.toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-accent-fg">{t("exams.grade")}</p>
          <p className="mt-0.5 text-sm text-ink">{result.overall_grade}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-accent-fg">{t("student.exams.rollNo")}</p>
          <p className="mt-0.5 text-sm text-ink">{result.roll_number || "—"}</p>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-violet-50">
            <tr>
              <th className="px-4 py-2.5 text-start text-xs font-medium uppercase tracking-wide text-accent-fg">{t("student.exams.subject")}</th>
              <th className="px-4 py-2.5 text-start text-xs font-medium uppercase tracking-wide text-accent-fg">{t("student.exams.marks")}</th>
              <th className="px-4 py-2.5 text-start text-xs font-medium uppercase tracking-wide text-accent-fg">{t("student.exams.max")}</th>
              <th className="px-4 py-2.5 text-start text-xs font-medium uppercase tracking-wide text-accent-fg">{t("exams.grade")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {result.subjects.map((s) => (
              <tr key={s.exam_subject_id}>
                <td className="px-4 py-2.5 text-ink-2">{subjectNames[s.subject_id] ? te("subject", subjectNames[s.subject_id]) : s.subject_id}</td>
                <td className="px-4 py-2.5 text-ink-2">{s.marks_obtained ?? "—"}</td>
                <td className="px-4 py-2.5 text-ink-2">{s.max_marks}</td>
                <td className="px-4 py-2.5 text-ink-2">{s.grade ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function StudentExams() {
  const { t, fmtDate } = useLanguage();
  const { data: profile } = useMyProfile();
  const { data: subjects } = useSubjects();
  const subjectNames = Object.fromEntries(Object.entries(subjectMap(subjects)).map(([id, s]) => [id, s.name]));
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

  const examsQuery = useQuery({
    queryKey: ["student", "exams"],
    queryFn: () => fetchExams(),
  });

  const exams = examsQuery.data?.items ?? [];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <PageHeader title={t("student.nav.exams")} subtitle={t("student.exams.subtitle")} />

      <DataTable
        columns={[
          { header: t("student.exams.exam"), cell: (row) => row.name },
          { header: t("student.exams.term"), cell: (row) => row.term || "—" },
          { header: t("student.exams.start"), cell: (row) => fmtDate(row.start_date) },
          { header: t("student.exams.end"), cell: (row) => fmtDate(row.end_date) },
          {
            header: t("fees.status"),
            cell: (row) => (row.end_date < today ? <Badge tone="gray">{t("student.exams.completed")}</Badge> : <Badge tone="yellow">{t("student.exams.upcoming")}</Badge>),
          },
          {
            header: "",
            cell: (row) => (
              <button
                className="text-sm font-medium text-accent-fg hover:text-ink-2"
                onClick={() => setSelectedExamId(selectedExamId === row.id ? null : row.id)}
              >
                {selectedExamId === row.id ? t("student.exams.hideResult") : t("student.exams.viewResult")}
              </button>
            ),
          },
        ]}
        rows={exams}
        isLoading={examsQuery.isLoading}
        rowKey={(row) => row.id}
        emptyLabel={t("student.exams.empty")}
      />

      {selectedExamId && profile && (
        <Card className="mt-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">
              {t("student.exams.result")} · {exams.find((e) => e.id === selectedExamId)?.name}
            </h2>
            <ReportCardButton
              examId={selectedExamId}
              studentId={profile.id}
              examName={exams.find((e) => e.id === selectedExamId)?.name ?? "exam"}
            />
          </div>
          <ExamResultPanel examId={selectedExamId} studentId={profile.id} subjectNames={subjectNames} />
        </Card>
      )}
    </div>
  );
}
