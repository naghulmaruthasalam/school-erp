import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, ErrorText, PageHeader, Spinner, StatTile } from "../../components/ui";
import { fetchAttendanceSummary, fetchExams, fetchInvoices, fetchPendingHomework } from "./api";
import { daysAgoIso, formatDisplayDate, todayIso } from "./dates";
import { useSelectedChild } from "./SelectedChildContext";
import { useLanguage } from "../../i18n/LanguageContext";

const ATTENDANCE_WINDOW_DAYS = 90;

export default function ParentDashboard() {
  const { t } = useLanguage();
  const { selectedChild, selectedChildId, isLoading: childrenLoading } = useSelectedChild();

  const attendanceQuery = useQuery({
    queryKey: ["parent", "dashboard", "attendance", selectedChildId],
    queryFn: () =>
      fetchAttendanceSummary(selectedChildId as string, daysAgoIso(ATTENDANCE_WINDOW_DAYS), todayIso()),
    enabled: !!selectedChildId,
  });

  const homeworkQuery = useQuery({
    queryKey: ["parent", "dashboard", "pending-homework"],
    queryFn: fetchPendingHomework,
    enabled: !!selectedChildId,
  });

  const examsQuery = useQuery({
    queryKey: ["parent", "dashboard", "exams"],
    queryFn: () => fetchExams({ page_size: 200 }),
    enabled: !!selectedChildId,
  });

  const invoicesQuery = useQuery({
    queryKey: ["parent", "dashboard", "invoices", selectedChildId],
    queryFn: () => fetchInvoices({ student_id: selectedChildId as string, page_size: 200 }),
    enabled: !!selectedChildId,
  });

  if (childrenLoading) {
    return (
      <div>
        <PageHeader title={t("parent.dashboard.title")} subtitle={t("parent.dashboard.subtitle")} />
        <Spinner />
      </div>
    );
  }

  if (!selectedChild) {
    return (
      <div>
        <PageHeader title={t("parent.dashboard.title")} subtitle={t("parent.dashboard.subtitle")} />
      </div>
    );
  }

  const attendancePct = attendanceQuery.data?.[0]?.percentage_present;
  const pendingHomeworkCount = homeworkQuery.data?.filter((h) => h.student_id === selectedChildId).length ?? 0;

  const upcomingExam = examsQuery.data?.items
    .filter((e) => e.class_ids?.includes(selectedChild.class_id) && e.start_date >= todayIso())
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];

  const outstandingTotal = invoicesQuery.data?.items.reduce((sum, inv) => sum + inv.outstanding_amount, 0) ?? 0;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={selectedChild.full_name}
        subtitle={t("parent.dashboard.overview", { no: selectedChild.admission_no })}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <StatTile
            label={t("parent.dashboard.attendance")}
            value={
              attendanceQuery.isLoading
                ? "…"
                : attendancePct !== undefined
                  ? `${attendancePct.toFixed(1)}%`
                  : "—"
            }
            hint={t("parent.dashboard.lastDays", { n: ATTENDANCE_WINDOW_DAYS })}
          />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
          <StatTile
            label={t("parent.dashboard.pendingHomework")}
            value={homeworkQuery.isLoading ? "…" : pendingHomeworkCount}
            hint={t("parent.dashboard.notSubmitted")}
          />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <StatTile
            label={t("parent.dashboard.upcomingExam")}
            value={examsQuery.isLoading ? "…" : upcomingExam ? upcomingExam.name : t("parent.dashboard.noneScheduled")}
            hint={upcomingExam ? formatDisplayDate(upcomingExam.start_date) : undefined}
          />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
          <StatTile
            label={t("parent.dashboard.pendingFees")}
            value={invoicesQuery.isLoading ? "…" : `₹${outstandingTotal.toFixed(2)}`}
            hint={t("parent.dashboard.outstanding")}
          />
        </div>
      </div>

      {(attendanceQuery.error || homeworkQuery.error || examsQuery.error || invoicesQuery.error) && (
        <ErrorText>{t("parent.dashboard.loadError")}</ErrorText>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <Card className="group">
            <h2 className="mb-2 text-sm font-semibold text-ink">{t("parent.dashboard.attendance")}</h2>
            <p className="mb-3 text-sm text-accent-fg">{t("parent.dashboard.attendanceDesc")}</p>
            <Link to={`/parent/attendance?child=${selectedChildId}`} className="text-sm font-medium text-accent-fg group-hover:text-ink-2 transition-colors">
              {t("parent.dashboard.viewAttendance")} <span className="inline-block rtl:-scale-x-100">→</span>
            </Link>
          </Card>
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "0.35s" }}>
          <Card className="group">
            <h2 className="mb-2 text-sm font-semibold text-ink">{t("parent.dashboard.homework")}</h2>
            <p className="mb-3 text-sm text-accent-fg">{t("parent.dashboard.homeworkDesc")}</p>
            <Link to={`/parent/homework?child=${selectedChildId}`} className="text-sm font-medium text-accent-fg group-hover:text-ink-2 transition-colors">
              {t("parent.dashboard.viewHomework")} <span className="inline-block rtl:-scale-x-100">→</span>
            </Link>
          </Card>
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
          <Card className="group">
            <h2 className="mb-2 text-sm font-semibold text-ink">{t("parent.dashboard.exams")}</h2>
            <p className="mb-3 text-sm text-accent-fg">{t("parent.dashboard.examsDesc")}</p>
            <Link to={`/parent/exams?child=${selectedChildId}`} className="text-sm font-medium text-accent-fg group-hover:text-ink-2 transition-colors">
              {t("parent.dashboard.viewExams")} <span className="inline-block rtl:-scale-x-100">→</span>
            </Link>
          </Card>
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "0.45s" }}>
          <Card className="group">
            <h2 className="mb-2 text-sm font-semibold text-ink">{t("parent.dashboard.fees")}</h2>
            <p className="mb-3 text-sm text-accent-fg">{t("parent.dashboard.feesDesc")}</p>
            <Link to={`/parent/fees?child=${selectedChildId}`} className="text-sm font-medium text-accent-fg group-hover:text-ink-2 transition-colors">
              {t("parent.dashboard.viewFees")} <span className="inline-block rtl:-scale-x-100">→</span>
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
