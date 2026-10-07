import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Card, Input, Label, PageHeader, StatTile } from "../../components/ui";
import { DataTable, Pagination, type Column } from "../../components/DataTable";
import { useLanguage } from "../../i18n/LanguageContext";
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

const PAGE_SIZE = 10;

export default function StudentAttendance() {
  const { t, te, fmtDate, fmtNumber } = useLanguage();
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
    { header: t("attendance.date"), cell: (row) => fmtDate(row.date) },
    {
      header: t("fees.status"),
      cell: (row) => <Badge tone={STATUS_TONE[row.status]}>{te("status", row.status.replace("_", " "))}</Badge>,
    },
    { header: t("student.attendance.remarks"), cell: (row) => row.remarks || "—" },
  ];

  return (
    <div>
      <PageHeader title={t("navigation.attendance")} subtitle={t("student.attendance.subtitle")} />

      <Card className="mb-6">
        <div className="grid grid-cols-2 gap-4 sm:max-w-md">
          <div>
            <Label htmlFor="att-from">{t("student.attendance.from")}</Label>
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
            <Label htmlFor="att-to">{t("student.attendance.to")}</Label>
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
        <StatTile label={t("student.attendance.pct")} value={summary ? `${fmtNumber(summary.percentage_present, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : "—"} />
        <StatTile label={t("student.attendance.totalDays")} value={summary?.total_days ?? "—"} />
        <StatTile label={t("attendance.present")} value={summary?.counts.PRESENT ?? 0} />
        <StatTile label={t("attendance.absent")} value={summary?.counts.ABSENT ?? 0} />
      </div>

      <DataTable
        columns={columns}
        rows={historyQuery.data?.items ?? []}
        isLoading={historyQuery.isLoading}
        rowKey={(row) => row.id}
        emptyLabel={t("student.attendance.empty")}
      />
      {historyQuery.data && (
        <Pagination page={page} pageSize={PAGE_SIZE} total={historyQuery.data.total} onPageChange={setPage} />
      )}
    </div>
  );
}
