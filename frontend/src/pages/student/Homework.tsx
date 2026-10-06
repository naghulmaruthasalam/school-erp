import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { api } from "../../api/client";
import { Badge, Button, Card, ErrorText, PageHeader, Spinner } from "../../components/ui";
import { DataTable, Pagination, type Column } from "../../components/DataTable";
import { fetchHomework, fetchHomeworkSubmissions, fetchPendingHomework, updateHomeworkSubmission } from "./api";
import { useMyProfile, useSubjects, subjectMap } from "./hooks";
import type { Homework, PendingHomework } from "./types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const PAGE_SIZE = 10;

function MarkSubmittedButton({ homeworkId, studentId }: { homeworkId: string; studentId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const submissions = await fetchHomeworkSubmissions(homeworkId);
      const mine = submissions.find((s) => s.student_id === studentId);
      if (!mine) throw new Error("No submission record found for this homework yet.");
      let attachmentIds = mine.attachment_document_ids ?? [];
      if (file) {
        const form = new FormData();
        form.append("file", file);
        form.append("module", "HOMEWORK_SUBMISSION");
        const { data } = await api.post<{ id: string }>("/uploads", form);
        attachmentIds = [...attachmentIds, data.id];
      }
      return updateHomeworkSubmission(mine.id, { status: "SUBMITTED", attachment_document_ids: attachmentIds });
    },
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({ queryKey: ["student", "homework-pending"] });
      queryClient.invalidateQueries({ queryKey: ["student", "homework-all"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to mark homework as submitted."),
  });

  return (
    <div className="text-right">
      <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <button type="button" className="mb-2 block w-full text-xs text-accent-fg hover:underline" onClick={() => fileRef.current?.click()}>
        {file ? `Attached: ${file.name}` : "Attach file (optional)"}
      </button>
      <Button variant="secondary" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Mark as Submitted"}
      </Button>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

function PendingHomeworkCard({ hw, subjectName, studentId }: { hw: PendingHomework; subjectName: string; studentId: string }) {
  const overdue = hw.due_date < new Date().toISOString().slice(0, 10);
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-ink">{hw.title}</h3>
            <Badge tone="gray">{subjectName}</Badge>
          </div>
          {hw.description && <p className="mb-2 text-sm text-ink-2">{hw.description}</p>}
          <p className="text-xs text-accent-fg">
            Assigned {formatDate(hw.assigned_date)} ·{" "}
            <span className={overdue ? "font-medium text-red-600" : ""}>Due {formatDate(hw.due_date)}</span>
          </p>
        </div>
        <MarkSubmittedButton homeworkId={hw.id} studentId={studentId} />
      </div>
    </Card>
  );
}

export default function StudentHomework() {
  const { data: profile } = useMyProfile();
  const { data: subjects } = useSubjects();
  const subjects_ = subjectMap(subjects);
  const [page, setPage] = useState(1);

  const pendingQuery = useQuery({
    queryKey: ["student", "homework-pending"],
    queryFn: fetchPendingHomework,
  });

  const allQuery = useQuery({
    queryKey: ["student", "homework-all", profile?.section_id, page],
    queryFn: () => fetchHomework({ section_id: profile!.section_id, page, page_size: PAGE_SIZE }),
    enabled: !!profile?.section_id,
  });

  const pendingIds = new Set((pendingQuery.data ?? []).map((hw) => hw.id));

  const columns: Column<Homework>[] = [
    { header: "Title", cell: (row) => row.title },
    { header: "Subject", cell: (row) => subjects_[row.subject_id]?.name ?? "—" },
    { header: "Assigned", cell: (row) => formatDate(row.assigned_date) },
    { header: "Due", cell: (row) => formatDate(row.due_date) },
    {
      header: "Status",
      cell: (row) => (pendingIds.has(row.id) ? <Badge tone="yellow">Pending</Badge> : <Badge tone="green">Submitted</Badge>),
    },
  ];

  return (
    <div>
      <PageHeader title="Homework" subtitle="Pending assignments and your full homework history." />

      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-ink">Pending ({pendingQuery.data?.length ?? 0})</h2>
        {pendingQuery.isLoading ? (
          <Spinner />
        ) : (pendingQuery.data ?? []).length === 0 ? (
          <Card>
            <p className="text-sm text-accent-fg">No pending homework. Nice work!</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {(pendingQuery.data ?? [])
              .slice()
              .sort((a, b) => a.due_date.localeCompare(b.due_date))
              .map((hw) => (
                <PendingHomeworkCard
                  key={hw.id}
                  hw={hw}
                  subjectName={subjects_[hw.subject_id]?.name ?? "—"}
                  studentId={hw.student_id}
                />
              ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink">All Homework</h2>
        <DataTable
          columns={columns}
          rows={allQuery.data?.items ?? []}
          isLoading={allQuery.isLoading}
          rowKey={(row) => row.id}
          emptyLabel="No homework assigned yet."
        />
        {allQuery.data && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={allQuery.data.total} onPageChange={setPage} />
        )}
      </div>
    </div>
  );
}
