import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Card, ErrorText, Input, Label, PageHeader, StatTile } from "../../components/ui";
import { DataTable, Pagination } from "../../components/DataTable";
import { fetchAttendanceHistory, fetchAttendanceSummary } from "./api";
import { daysAgoIso, formatDisplayDate, todayIso } from "./dates";
import { useSelectedChild } from "./SelectedChildContext";
import type { AttendanceStatus, StudentAttendanceOut } from "./types";

const STATUS_TONE: Record<AttendanceStatus, "green" | "red" | "yellow" | "gray"> = {
  PRESENT: "green",
  ABSENT: "red",
  LATE: "yellow",
  HALF_DAY: "yellow",
  EXCUSED: "gray",
};

const PAGE_SIZE = 20;

export default function AttendancePage() {
  const { selectedChild, selectedChildId } = useSelectedChild();
  const [dateFrom, setDateFrom] = useState(daysAgoIso(90));
  const [dateTo, setDateTo] = useState(todayIso());
  const [page, setPage] = useState(1);

  const summaryQuery = useQuery({
    queryKey: ["parent", "attendance-summary", selectedChildId, dateFrom, dateTo],
    queryFn: () => fetchAttendanceSummary(selectedChildId as string, dateFrom, dateTo),
    enabled: !!selectedChildId,
  });

  const historyQuery = useQuery({
    queryKey: ["parent", "attendance-history", selectedChildId, dateFrom, dateTo, page],
    queryFn: () =>
      fetchAttendanceHistory({
        student_id: selectedChildId as string,
        date_from: dateFrom,
        date_to: dateTo,
        page,
        page_size: PAGE_SIZE,
      }),
    enabled: !!selectedChildId,
  });

  if (!selectedChild) {
    return (
      <div>
        <PageHeader title="Attendance" />
        <p className="text-sm text-accent-fg">Select a child above to view attendance.</p>
      </div>
    );
  }

  const summary = summaryQuery.data?.[0];

  return (
    <div>
      <PageHeader title="Attendance" subtitle={`Attendance history for ${selectedChild.full_name}.`} />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="date_from">From</Label>
            <Input
              id="date_from"
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <Label htmlFor="date_to">To</Label>
            <Input
              id="date_to"
              type="date"
              value={dateTo}
              min={dateFrom}
              max={todayIso()}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </Card>

      {summaryQuery.error && <ErrorText>Could not load the attendance summary.</ErrorText>}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Attendance %"
          value={summaryQuery.isLoading ? "…" : summary ? `${summary.percentage_present.toFixed(1)}%` : "—"}
        />
        <StatTile label="Total Days" value={summaryQuery.isLoading ? "…" : (summary?.total_days ?? 0)} />
        <StatTile label="Present" value={summaryQuery.isLoading ? "…" : (summary?.counts.PRESENT ?? 0)} />
        <StatTile label="Absent" value={summaryQuery.isLoading ? "…" : (summary?.counts.ABSENT ?? 0)} />
      </div>

      {historyQuery.error && <ErrorText>Could not load the attendance history.</ErrorText>}

      <DataTable<StudentAttendanceOut>
        columns={[
          { header: "Date", cell: (r) => formatDisplayDate(r.date) },
          {
            header: "Status",
            cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status.replace("_", " ")}</Badge>,
          },
          { header: "Remarks", cell: (r) => r.remarks ?? "—" },
        ]}
        rows={historyQuery.data?.items ?? []}
        isLoading={historyQuery.isLoading}
        rowKey={(r) => r.id}
        emptyLabel="No attendance records in this date range."
      />
      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={historyQuery.data?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
}
