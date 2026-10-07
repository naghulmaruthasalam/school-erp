import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Card, ErrorText, PageHeader, Spinner } from "../../components/ui";
import { DataTable, Pagination } from "../../components/DataTable";
import { fetchHomeworkList, fetchPendingHomework } from "./api";
import { formatDisplayDate, todayIso } from "./dates";
import { useSubjects } from "./hooks";
import { useSelectedChild } from "./SelectedChildContext";
import type { HomeworkOut } from "./types";

const PAGE_SIZE = 20;

export default function HomeworkPage() {
  const { selectedChild, selectedChildId } = useSelectedChild();
  const [page, setPage] = useState(1);
  const subjectsQuery = useSubjects();

  const pendingQuery = useQuery({
    queryKey: ["parent", "homework-pending"],
    queryFn: fetchPendingHomework,
    enabled: !!selectedChildId,
  });

  const historyQuery = useQuery({
    queryKey: ["parent", "homework-history", selectedChild?.section_id, page],
    queryFn: () =>
      fetchHomeworkList({ section_id: selectedChild!.section_id, page, page_size: PAGE_SIZE }),
    enabled: !!selectedChild,
  });

  if (!selectedChild) {
    return (
      <div>
        <PageHeader title="Homework" />
        <p className="text-sm text-accent-fg">Select a child above to view homework.</p>
      </div>
    );
  }

  const subjectName = (id: string) => subjectsQuery.data?.find((s) => s.id === id)?.name ?? id;

  const pendingForChild = (pendingQuery.data ?? []).filter((h) => h.student_id === selectedChildId);

  return (
    <div>
      <PageHeader title="Homework" subtitle={`Homework assignments for ${selectedChild.full_name}.`} />

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-ink">Pending ({pendingForChild.length})</h2>
        {pendingQuery.isLoading ? (
          <Spinner />
        ) : pendingQuery.error ? (
          <ErrorText>Could not load pending homework.</ErrorText>
        ) : pendingForChild.length === 0 ? (
          <p className="text-sm text-accent-fg">No pending homework. All caught up.</p>
        ) : (
          <ul className="divide-y divide-line">
            {pendingForChild.map((hw) => (
              <li key={hw.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{hw.title}</p>
                  <p className="text-xs text-accent-fg">
                    {subjectName(hw.subject_id)} — due {formatDisplayDate(hw.due_date)}
                  </p>
                  {hw.description && <p className="mt-1 text-xs text-accent-fg">{hw.description}</p>}
                </div>
                <Badge tone={hw.due_date < todayIso() ? "red" : "yellow"}>
                  {hw.due_date < todayIso() ? "Overdue" : "Pending"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <h2 className="mb-3 text-sm font-semibold text-ink">All Homework</h2>
      <DataTable<HomeworkOut>
        columns={[
          { header: "Title", cell: (r) => r.title },
          { header: "Subject", cell: (r) => subjectName(r.subject_id) },
          { header: "Assigned", cell: (r) => formatDisplayDate(r.assigned_date) },
          { header: "Due", cell: (r) => formatDisplayDate(r.due_date) },
        ]}
        rows={historyQuery.data?.items ?? []}
        isLoading={historyQuery.isLoading}
        rowKey={(r) => r.id}
        emptyLabel="No homework has been assigned yet."
      />
      {historyQuery.error && <ErrorText>Could not load homework history.</ErrorText>}
      <Pagination page={page} pageSize={PAGE_SIZE} total={historyQuery.data?.total ?? 0} onPageChange={setPage} />
    </div>
  );
}
