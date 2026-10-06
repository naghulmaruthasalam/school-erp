import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, ErrorText, PageHeader, Spinner, StatTile } from "../../components/ui";
import { fetchAttendanceSummary, fetchExams, fetchInvoices, fetchPendingHomework } from "./api";
import { daysAgoIso, formatDisplayDate, todayIso } from "./dates";
import { useSelectedChild } from "./SelectedChildContext";

const ATTENDANCE_WINDOW_DAYS = 90;

export default function ParentDashboard() {
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
        <PageHeader title="My Children" subtitle="Attendance, homework, exams and fees for your children." />
        <Spinner />
      </div>
    );
  }

  if (!selectedChild) {
    return (
      <div>
        <PageHeader title="My Children" subtitle="Attendance, homework, exams and fees for your children." />
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
        subtitle={`Admission No. ${selectedChild.admission_no} — overview of attendance, homework, exams and fees.`}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <StatTile
            label="Attendance"
            value={
              attendanceQuery.isLoading
                ? "…"
                : attendancePct !== undefined
                  ? `${attendancePct.toFixed(1)}%`
                  : "—"
            }
            hint={`Last ${ATTENDANCE_WINDOW_DAYS} days`}
          />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
          <StatTile
            label="Pending Homework"
            value={homeworkQuery.isLoading ? "…" : pendingHomeworkCount}
            hint="Not yet submitted"
          />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <StatTile
            label="Upcoming Exam"
            value={examsQuery.isLoading ? "…" : upcomingExam ? upcomingExam.name : "None scheduled"}
            hint={upcomingExam ? formatDisplayDate(upcomingExam.start_date) : undefined}
          />
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
          <StatTile
            label="Pending Fees"
            value={invoicesQuery.isLoading ? "…" : `₹${outstandingTotal.toFixed(2)}`}
            hint="Outstanding amount"
          />
        </div>
      </div>

      {(attendanceQuery.error || homeworkQuery.error || examsQuery.error || invoicesQuery.error) && (
        <ErrorText>Some data could not be loaded. Please refresh the page.</ErrorText>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <Card className="group">
            <h2 className="mb-2 text-sm font-semibold text-ink">Attendance</h2>
            <p className="mb-3 text-sm text-accent-fg">Full history and date-range breakdown.</p>
            <Link to={`/parent/attendance?child=${selectedChildId}`} className="text-sm font-medium text-accent-fg group-hover:text-ink-2 transition-colors">
              View attendance →
            </Link>
          </Card>
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "0.35s" }}>
          <Card className="group">
            <h2 className="mb-2 text-sm font-semibold text-ink">Homework</h2>
            <p className="mb-3 text-sm text-accent-fg">Pending and past assignments.</p>
            <Link to={`/parent/homework?child=${selectedChildId}`} className="text-sm font-medium text-accent-fg group-hover:text-ink-2 transition-colors">
              View homework →
            </Link>
          </Card>
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
          <Card className="group">
            <h2 className="mb-2 text-sm font-semibold text-ink">Exams</h2>
            <p className="mb-3 text-sm text-accent-fg">Results and report cards.</p>
            <Link to={`/parent/exams?child=${selectedChildId}`} className="text-sm font-medium text-accent-fg group-hover:text-ink-2 transition-colors">
              View exams →
            </Link>
          </Card>
        </div>
        <div className="animate-fade-in-up" style={{ animationDelay: "0.45s" }}>
          <Card className="group">
            <h2 className="mb-2 text-sm font-semibold text-ink">Fees</h2>
            <p className="mb-3 text-sm text-accent-fg">Invoices, payment status and online payment.</p>
            <Link to={`/parent/fees?child=${selectedChildId}`} className="text-sm font-medium text-accent-fg group-hover:text-ink-2 transition-colors">
              View fees →
            </Link>
          </Card>
        </div>
      </div>
    </div>
  );
}
