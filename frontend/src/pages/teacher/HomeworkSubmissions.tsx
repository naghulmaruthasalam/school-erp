import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Badge, Card, PageHeader, Spinner } from "../../components/ui";
import { DataTable } from "../../components/DataTable";
import { openDocument } from "../../api/files";
import { fetchSectionRoster, getHomework, listHomeworkSubmissions } from "./api";
import { sectionLabel, useClasses, useSections, useSubjects } from "./hooks";
import type { HomeworkSubmissionStatus } from "./types";
import { useLanguage } from "../../i18n/LanguageContext";

const STATUS_TONE: Record<HomeworkSubmissionStatus, "gray" | "green" | "yellow"> = {
  PENDING: "gray",
  SUBMITTED: "green",
  LATE: "yellow",
};

export default function TeacherHomeworkSubmissions() {
  const { homeworkId } = useParams<{ homeworkId: string }>();
  const { t, te, fmtDate } = useLanguage();
  const { data: sections } = useSections();
  const { data: classes } = useClasses();
  const { data: subjects } = useSubjects();

  const homeworkQuery = useQuery({
    queryKey: ["teacher", "homework", homeworkId],
    queryFn: () => getHomework(homeworkId as string),
    enabled: !!homeworkId,
  });

  const submissionsQuery = useQuery({
    queryKey: ["teacher", "homework", homeworkId, "submissions"],
    queryFn: () => listHomeworkSubmissions(homeworkId as string),
    enabled: !!homeworkId,
  });

  const rosterQuery = useQuery({
    queryKey: ["teacher", "roster", homeworkQuery.data?.section_id],
    queryFn: () => fetchSectionRoster(homeworkQuery.data!.section_id),
    enabled: !!homeworkQuery.data,
  });

  const homework = homeworkQuery.data;

  return (
    <div>
      <PageHeader
        title={homework ? homework.title : t("teacher.homeworkSubmissions.title")}
        subtitle={
          homework
            ? `${sectionLabel(homework.section_id, sections, classes, te)} — ${
                te("subject", subjects?.find((s) => s.id === homework.subject_id)?.name) || homework.subject_id
              }`
            : undefined
        }
        actions={
          <Link to="/teacher/homework" className="text-sm text-accent-fg hover:underline">
            {t("teacher.homeworkSubmissions.back")}
          </Link>
        }
      />

      {homework?.description && (
        <Card className="mb-6">
          <p className="text-sm text-ink-2">{homework.description}</p>
          <p className="mt-2 text-xs text-accent-fg">
            {t("teacher.homeworkSubmissions.assignedDue", { assigned: fmtDate(homework.assigned_date), due: fmtDate(homework.due_date) })}
          </p>
        </Card>
      )}

      {submissionsQuery.isLoading || rosterQuery.isLoading ? (
        <Card>
          <Spinner className="mx-auto" />
        </Card>
      ) : (
        <DataTable
          rowKey={(row) => row.id}
          rows={submissionsQuery.data ?? []}
          emptyLabel={t("teacher.homeworkSubmissions.empty")}
          columns={[
            {
              header: t("teacher.homeworkSubmissions.student"),
              cell: (r) => rosterQuery.data?.find((s) => s.id === r.student_id)?.full_name ?? r.student_id,
            },
            {
              header: t("teacher.homeworkSubmissions.status"),
              cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{te("status", r.status)}</Badge>,
            },
            {
              header: t("teacher.homeworkSubmissions.submittedAt"),
              cell: (r) => (r.submitted_at ? fmtDate(r.submitted_at, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"),
            },
            {
              header: t("teacher.homeworkSubmissions.attachments"),
              cell: (r) =>
                r.attachment_document_ids.length === 0 ? (
                  "—"
                ) : (
                  <span className="flex flex-wrap gap-2">
                    {r.attachment_document_ids.map((docId, i) => (
                      <button key={docId} type="button" className="text-accent-fg hover:underline" onClick={() => void openDocument(docId)}>
                        {t("teacher.homeworkSubmissions.file", { n: i + 1 })}
                      </button>
                    ))}
                  </span>
                ),
            },
            { header: t("teacher.homeworkSubmissions.remarks"), cell: (r) => r.remarks ?? "—" },
          ]}
        />
      )}
    </div>
  );
}
