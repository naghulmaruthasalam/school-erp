import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Card, Input, Label, PageHeader, StatTile } from "../../components/ui";
import { DataTable, Pagination, type Column } from "../../components/DataTable";
import { fetchAttendanceHistory, fetchAttendanceSummary } from "./api";
import type { AttendanceStatus, StudentAttendance } from "./types";

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const STATUS_TONE: Record<AttendanceStatus, "green" | "red" | "yellow" | "gray"> = {
  PRESENT: "green",
  ABSENT: "red",
  LATE: "yellow",
  HALF_DAY: "yellow",
  EXCUSED: "gray",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const PAGE_SIZE = 10;

export default function StudentAttendance() {
  const today = new Date();
  const [dateFrom, setDateFrom] = useState(toISODate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [dateTo, setDateTo] = useState(toISODate(today));
  const [page, setPage] = useState(1);

  const summaryQuery = useQuery({
    queryKey: ["student", "attendance-summary", dateFrom, dateTo],
    queryFn: () => fetchAttendanceSummary(dateFrom, dateTo),
    enabled: !!dateFrom && !!dateTo,
  });

  const historyQuery = useQuery({
    queryKey: ["student", "attendance-history", dateFrom, dateTo, page],
    queryFn: () => fetchAttendanceHistory({ date_from: dateFrom, date_to: dateTo, page, page_size: PAGE_SIZE }),
    enabled: !!dateFrom && !!dateTo,
  });

  const summary = summaryQuery.data?.[0];

  const columns: Column<StudentAttendance>[] = [
    { header: "Date", cell: (row) => formatDate(row.date) },
    {
      header: "Status",
      cell: (row) => <Badge tone={STATUS_TONE[row.status]}>{row.status.replace("_", " ")}</Badge>,
    },
    { header: "Remarks", cell: (row) => row.remarks || "—" },
  ];

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Your attendance summary and recent history." />

      <Card className="mb-6">
        <div className="grid grid-cols-2 gap-4 sm:max-w-md">
          <div>
            <Label htmlFor="att-from">From</Label>
            <Input
              id="att-from"
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
            <Label htmlFor="att-to">To</Label>
            <Input
              id="att-to"
              type="date"
              value={dateTo}
              min={dateFrom}
              max={toISODate(today)}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Attendance %" value={summary ? `${summary.percentage_present.toFixed(1)}%` : "—"} />
        <StatTile label="Total Days" value={summary?.total_days ?? "—"} />
        <StatTile label="Present" value={summary?.counts.PRESENT ?? 0} />
        <StatTile label="Absent" value={summary?.counts.ABSENT ?? 0} />
      </div>

      <DataTable
        columns={columns}
        rows={historyQuery.data?.items ?? []}
        isLoading={historyQuery.isLoading}
        rowKey={(row) => row.id}
        emptyLabel="No attendance records in this range."
      />
      {historyQuery.data && (
        <Pagination page={page} pageSize={PAGE_SIZE} total={historyQuery.data.total} onPageChange={setPage} />
      )}
    </div>
  );
}
