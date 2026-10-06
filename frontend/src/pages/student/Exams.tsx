import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Card, ErrorText, PageHeader, Spinner } from "../../components/ui";
import { DataTable } from "../../components/DataTable";
import { fetchExamResult, fetchExams, fetchReportCardPdf } from "./api";
import { useMyProfile, useSubjects, subjectMap } from "./hooks";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function ReportCardButton({ examId, studentId, examName }: { examId: string; studentId: string; examName: string }) {
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
      setError("Report card is not available yet.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div>
      <Button variant="secondary" onClick={handleDownload} disabled={isDownloading}>
        {isDownloading ? "Preparing…" : "Download Report Card"}
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
  const { data: result, isLoading, error } = useQuery({
    queryKey: ["student", "exam-result", examId, studentId],
    queryFn: () => fetchExamResult(examId, studentId),
  });

  if (isLoading) return <Spinner />;
  if (error || !result) return <p className="text-sm text-accent-fg">Result not published yet for this exam.</p>;

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-accent-fg">Total</p>
          <p className="mt-0.5 text-sm text-ink">
            {result.total_marks_obtained} / {result.total_max_marks}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-accent-fg">Percentage</p>
          <p className="mt-0.5 text-sm text-ink">{result.percentage.toFixed(1)}%</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-accent-fg">Grade</p>
          <p className="mt-0.5 text-sm text-ink">{result.overall_grade}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-accent-fg">Roll No.</p>
          <p className="mt-0.5 text-sm text-ink">{result.roll_number || "—"}</p>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-violet-50">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-accent-fg">Subject</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-accent-fg">Marks</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-accent-fg">Max</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-accent-fg">Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {result.subjects.map((s) => (
              <tr key={s.exam_subject_id}>
                <td className="px-4 py-2.5 text-ink-2">{subjectNames[s.subject_id] ?? s.subject_id}</td>
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
      <PageHeader title="Exams" subtitle="Your exam schedule, results and report cards." />

      <DataTable
        columns={[
          { header: "Exam", cell: (row) => row.name },
          { header: "Term", cell: (row) => row.term || "—" },
          { header: "Start", cell: (row) => formatDate(row.start_date) },
          { header: "End", cell: (row) => formatDate(row.end_date) },
          {
            header: "Status",
            cell: (row) => (row.end_date < today ? <Badge tone="gray">Completed</Badge> : <Badge tone="yellow">Upcoming</Badge>),
          },
          {
            header: "",
            cell: (row) => (
              <button
                className="text-sm font-medium text-accent-fg hover:text-ink-2"
                onClick={() => setSelectedExamId(selectedExamId === row.id ? null : row.id)}
              >
                {selectedExamId === row.id ? "Hide result" : "View result"}
              </button>
            ),
          },
        ]}
        rows={exams}
        isLoading={examsQuery.isLoading}
        rowKey={(row) => row.id}
        emptyLabel="No exams scheduled yet."
      />

      {selectedExamId && profile && (
        <Card className="mt-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">
              Result · {exams.find((e) => e.id === selectedExamId)?.name}
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
