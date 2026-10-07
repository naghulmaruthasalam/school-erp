import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Badge, Card, PageHeader, Spinner } from "../../components/ui";
import { DataTable } from "../../components/DataTable";
import { openDocument } from "../../api/files";
import { fetchSectionRoster, getHomework, listHomeworkSubmissions } from "./api";
import { sectionLabel, useClasses, useSections, useSubjects } from "./hooks";
import type { HomeworkSubmissionStatus } from "./types";

const STATUS_TONE: Record<HomeworkSubmissionStatus, "gray" | "green" | "yellow"> = {
  PENDING: "gray",
  SUBMITTED: "green",
  LATE: "yellow",
};

export default function TeacherHomeworkSubmissions() {
  const { homeworkId } = useParams<{ homeworkId: string }>();
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
        title={homework ? homework.title : "Homework Submissions"}
        subtitle={
          homework
            ? `${sectionLabel(homework.section_id, sections, classes)} — ${
                subjects?.find((s) => s.id === homework.subject_id)?.name ?? homework.subject_id
              }`
            : undefined
        }
        actions={
          <Link to="/teacher/homework" className="text-sm text-accent-fg hover:underline">
            Back to Homework
          </Link>
        }
      />

      {homework?.description && (
        <Card className="mb-6">
          <p className="text-sm text-ink-2">{homework.description}</p>
          <p className="mt-2 text-xs text-accent-fg">
            Assigned {homework.assigned_date} — Due {homework.due_date}
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
          emptyLabel="No submissions found."
          columns={[
            {
              header: "Student",
              cell: (r) => rosterQuery.data?.find((s) => s.id === r.student_id)?.full_name ?? r.student_id,
            },
            {
              header: "Status",
              cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>,
            },
            {
              header: "Submitted At",
              cell: (r) => (r.submitted_at ? new Date(r.submitted_at).toLocaleString() : "—"),
            },
            {
              header: "Attachments",
              cell: (r) =>
                r.attachment_document_ids.length === 0 ? (
                  "—"
                ) : (
                  <span className="flex flex-wrap gap-2">
                    {r.attachment_document_ids.map((docId, i) => (
                      <button key={docId} type="button" className="text-accent-fg hover:underline" onClick={() => void openDocument(docId)}>
                        File {i + 1}
                      </button>
                    ))}
                  </span>
                ),
            },
            { header: "Remarks", cell: (r) => r.remarks ?? "—" },
          ]}
        />
      )}
    </div>
  );
}
