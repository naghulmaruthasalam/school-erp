import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Card, ErrorText, Input, Label, PageHeader, StatTile } from "../../components/ui";
import { DataTable, Pagination } from "../../components/DataTable";
import { fetchAttendanceHistory, fetchAttendanceSummary } from "./api";
import { daysAgoIso, formatDisplayDate, todayIso } from "./dates";
import { useSelectedChild } from "./SelectedChildContext";
import type { AttendanceStatus, StudentAttendanceOut } from "./types";
import { useLanguage } from "../../i18n/LanguageContext";

const STATUS_TONE: Record<AttendanceStatus, "green" | "red" | "yellow" | "gray"> = {
  PRESENT: "green",
  ABSENT: "red",
  LATE: "yellow",
  HALF_DAY: "yellow",
  EXCUSED: "gray",
};

const PAGE_SIZE = 20;

export default function AttendancePage() {
  const { t, te } = useLanguage();
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
        <PageHeader title={t("navigation.attendance")} />
        <p className="text-sm text-accent-fg">{t("parent.attendance.selectChild")}</p>
      </div>
    );
  }

  const summary = summaryQuery.data?.[0];

  return (
    <div>
      <PageHeader title={t("navigation.attendance")} subtitle={t("parent.attendance.subtitle", { name: selectedChild.full_name })} />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="date_from">{t("parent.attendance.from")}</Label>
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
            <Label htmlFor="date_to">{t("parent.attendance.to")}</Label>
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

      {summaryQuery.error && <ErrorText>{t("parent.attendance.summaryError")}</ErrorText>}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={t("parent.attendance.percent")}
          value={summaryQuery.isLoading ? "…" : summary ? `${summary.percentage_present.toFixed(1)}%` : "—"}
        />
        <StatTile label={t("parent.attendance.totalDays")} value={summaryQuery.isLoading ? "…" : (summary?.total_days ?? 0)} />
        <StatTile label={t("attendance.present")} value={summaryQuery.isLoading ? "…" : (summary?.counts.PRESENT ?? 0)} />
        <StatTile label={t("attendance.absent")} value={summaryQuery.isLoading ? "…" : (summary?.counts.ABSENT ?? 0)} />
      </div>

      {historyQuery.error && <ErrorText>{t("parent.attendance.historyError")}</ErrorText>}

      <DataTable<StudentAttendanceOut>
        columns={[
          { header: t("parent.attendance.date"), cell: (r) => formatDisplayDate(r.date) },
          {
            header: t("parent.attendance.status"),
            cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{te("status", r.status.replace("_", " "))}</Badge>,
          },
          { header: t("parent.attendance.remarks"), cell: (r) => r.remarks ?? "—" },
        ]}
        rows={historyQuery.data?.items ?? []}
        isLoading={historyQuery.isLoading}
        rowKey={(r) => r.id}
        emptyLabel={t("parent.attendance.empty")}
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
