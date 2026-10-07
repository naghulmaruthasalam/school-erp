import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { FileText, GraduationCap, IndianRupee, PieChart, Printer, UserCheck, Users } from "lucide-react";
import { Badge, Button, Card, PageHeader, Select, Spinner, StatTile } from "../../components/ui";
import { AttendanceLineChart, ClassFeeBarChart, FeeCollectionBarChart, StudentDistributionPie } from "../../components/Charts";
import { api } from "../../api/client";
import { timeAgo } from "../../lib/time";
import type { PageResponse } from "../../types/common";

interface AttendanceStats {
  date: string;
  total_students: number;
  marked: number;
  present_today: number;
  late_today: number;
  absent_today: number;
  attendance_rate: number;
}

interface FeeStats {
  total_expected: number;
  total_collected: number;
  total_pending: number;
  collection_rate: number;
  overdue_invoices: number;
  total_invoices: number;
}

interface Section {
  id: string;
  name: string;
  class_id: string;
}

interface ClassItem {
  id: string;
  name: string;
}

interface Student {
  id: string;
  full_name: string;
  admission_no: string;
  gender?: string | null;
  status: string;
  admission_date?: string | null;
}

interface PaymentRow {
  id: string;
  student_name: string | null;
  amount: number;
  payment_method: string;
  payment_date: string;
}

type ReportId = "overview" | "attendance" | "fees" | "students";

const rupees = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
const today = () => new Date().toISOString().slice(0, 10);

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [activeReport, setActiveReport] = useState<ReportId>("overview");
  const [selectedSection, setSelectedSection] = useState("");
  const [date, setDate] = useState(today());

  const sectionsQuery = useQuery({
    queryKey: ["sections"],
    queryFn: async () => (await api.get<Section[]>("/academics/sections")).data,
  });
  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: async () => (await api.get<ClassItem[]>("/academics/classes")).data,
  });
  const subjectsQuery = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await api.get<{ id: string }[]>("/academics/subjects")).data,
  });
  const studentsQuery = useQuery({
    queryKey: ["students-report", selectedSection],
    queryFn: async () => {
      const params: Record<string, string | number> = { status: "ACTIVE", page_size: 500 };
      if (selectedSection) params.section_id = selectedSection;
      return (await api.get<PageResponse<Student>>("/students", { params })).data;
    },
  });
  const attendanceQuery = useQuery({
    queryKey: ["attendance-stats", selectedSection, date],
    queryFn: async () =>
      (await api.get<AttendanceStats>("/attendance/stats", { params: { date, ...(selectedSection ? { section_id: selectedSection } : {}) } })).data,
  });
  const trendQuery = useQuery({
    queryKey: ["attendance-trend", 7],
    queryFn: async () => (await api.get<{ date: string; percentage: number }[]>("/analytics/attendance-trend", { params: { days: 7 } })).data,
  });
  const feeQuery = useQuery({
    queryKey: ["fee-stats"],
    queryFn: async () => (await api.get<FeeStats>("/fees/stats")).data,
  });
  const monthlyQuery = useQuery({
    queryKey: ["fee-collection", 6],
    queryFn: async () => (await api.get<{ month: string; amount: number }[]>("/analytics/fee-collection", { params: { months: 6 } })).data,
  });
  const byClassQuery = useQuery({
    queryKey: ["fee-by-class"],
    queryFn: async () => (await api.get<{ name: string; billed: number; collected: number; pending: number }[]>("/analytics/fee-by-class")).data,
  });
  const paymentsQuery = useQuery({
    queryKey: ["payments", "recent"],
    queryFn: async () => (await api.get<PageResponse<PaymentRow>>("/payments", { params: { page_size: 6 } })).data,
  });
  const distributionQuery = useQuery({
    queryKey: ["student-distribution"],
    queryFn: async () => (await api.get<{ name: string; value: number }[]>("/analytics/student-distribution")).data,
  });

  const sectionStats = useQueries({
    queries: (sectionsQuery.data ?? []).map((section) => ({
      queryKey: ["attendance-stats", section.id, date],
      queryFn: async () => (await api.get<AttendanceStats>("/attendance/stats", { params: { date, section_id: section.id } })).data,
      enabled: activeReport === "attendance",
    })),
  });

  const className = (id: string) => classesQuery.data?.find((c) => c.id === id)?.name ?? "";
  const sectionLabel = (s: Section) => `${className(s.class_id)} - ${s.name}`.trim();

  const students = studentsQuery.data?.items ?? [];
  const att = attendanceQuery.data;
  const fee = feeQuery.data;
  const male = students.filter((s) => (s.gender ?? "").toUpperCase().startsWith("M")).length;
  const female = students.filter((s) => (s.gender ?? "").toUpperCase().startsWith("F")).length;
  const pct = (n: number) => (students.length ? Math.round((n / students.length) * 100) : 0);

  const tabs: { id: ReportId; label: string; icon: typeof PieChart }[] = [
    { id: "overview", label: "Overview", icon: PieChart },
    { id: "attendance", label: "Attendance", icon: UserCheck },
    { id: "fees", label: "Fee Collection", icon: IndianRupee },
    { id: "students", label: "Student Analytics", icon: GraduationCap },
  ];

  function exportCsv() {
    if (activeReport === "attendance") {
      downloadCsv(`attendance-${date}.csv`, [
        ["Section", "Enrolled", "Present", "Late", "Absent", "Rate %"],
        ...(sectionsQuery.data ?? []).map((s, i) => {
          const d = sectionStats[i]?.data;
          return [sectionLabel(s), d?.total_students ?? 0, d?.present_today ?? 0, d?.late_today ?? 0, d?.absent_today ?? 0, d?.attendance_rate ?? 0];
        }),
      ]);
    } else if (activeReport === "fees") {
      downloadCsv("fee-collection-by-class.csv", [
        ["Class", "Billed", "Collected", "Pending"],
        ...(byClassQuery.data ?? []).map((c) => [c.name, c.billed, c.collected, c.pending]),
      ]);
    } else {
      downloadCsv("students.csv", [
        ["Admission No", "Name", "Gender", "Status"],
        ...students.map((s) => [s.admission_no, s.full_name, s.gender ?? "", s.status]),
      ]);
    }
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Reports & Analytics" subtitle="Comprehensive school performance insights">
        <Button variant="secondary" className="gap-2" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print / Save PDF
        </Button>
        <Button variant="secondary" className="gap-2" onClick={exportCsv}>
          <FileText className="h-4 w-4" /> Export CSV
        </Button>
      </PageHeader>

      <div className="lg-seg mb-6 !flex !w-fit max-w-full flex-wrap !rounded-[22px] !p-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            aria-pressed={activeReport === t.id}
            onClick={() => setActiveReport(t.id)}
            className="flex items-center gap-2 !rounded-2xl !px-4 !py-2 !text-sm"
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      <Card className="mb-6" animate={false}>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[200px]">
            <label className="mb-1.5 block text-[13px] font-medium text-ink-2">Section</label>
            <Select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)}>
              <option value="">All sections</option>
              {sectionsQuery.data?.map((s) => (
                <option key={s.id} value={s.id}>{sectionLabel(s)}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-ink-2">Date</label>
            <input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value || today())} className="lg-field" />
          </div>
        </div>
      </Card>

      {activeReport === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatTile label="Active Students" value={studentsQuery.isLoading ? "…" : students.length} icon={<Users size={20} />} color="blue" />
            <StatTile
              label="Attendance"
              value={attendanceQuery.isLoading ? "…" : att && att.marked ? `${att.attendance_rate}%` : "—"}
              hint={att && att.marked ? `${att.marked} of ${att.total_students} marked` : "Not marked yet"}
              icon={<UserCheck size={20} />}
              color="green"
            />
            <StatTile label="Fees Collected" value={fee ? rupees(fee.total_collected) : "…"} hint={fee ? `${fee.collection_rate}% of billed` : undefined} icon={<IndianRupee size={20} />} color="purple" />
            <StatTile label="Subjects" value={subjectsQuery.data?.length ?? "…"} hint={`${classesQuery.data?.length ?? 0} classes`} icon={<GraduationCap size={20} />} color="orange" />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card animate={false}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-ink">Attendance Trend</h3>
                <Badge tone="violet">Last 7 days</Badge>
              </div>
              {trendQuery.isLoading ? (
                <div className="flex h-56 items-center justify-center"><Spinner /></div>
              ) : trendQuery.data && trendQuery.data.length > 0 ? (
                <AttendanceLineChart data={trendQuery.data} height={230} />
              ) : (
                <p className="flex h-56 items-center justify-center text-sm text-ink-3">No attendance marked in the last 7 days.</p>
              )}
            </Card>
            <Card animate={false}>
              <h3 className="mb-4 font-semibold text-ink">Students by Class</h3>
              {distributionQuery.isLoading ? (
                <div className="flex h-56 items-center justify-center"><Spinner /></div>
              ) : distributionQuery.data && distributionQuery.data.length > 0 ? (
                <StudentDistributionPie data={distributionQuery.data} height={230} />
              ) : (
                <p className="flex h-56 items-center justify-center text-sm text-ink-3">No students enrolled yet.</p>
              )}
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card animate={false}>
              <h3 className="mb-4 font-semibold text-ink">Today's Summary</h3>
              <div className="space-y-2.5">
                {[
                  { label: "Present", value: att?.present_today ?? 0, tone: "#30c25a" },
                  { label: "Late", value: att?.late_today ?? 0, tone: "#ff9f0a" },
                  { label: "Absent", value: att?.absent_today ?? 0, tone: "#ff453a" },
                ].map((row) => (
                  <div key={row.label} className="glass-row !justify-between">
                    <span className="flex items-center gap-2 text-sm text-ink-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.tone }} />
                      {row.label}
                    </span>
                    <span className="tabular font-semibold text-ink">{row.value}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card animate={false}>
              <h3 className="mb-4 font-semibold text-ink">Fee Collection</h3>
              {fee ? (
                <div className="space-y-4">
                  <div>
                    <div className="mb-1 flex justify-between text-sm"><span className="text-ink-3">Collected</span><span className="tabular font-medium text-green-600 dark:text-green-400">{rupees(fee.total_collected)}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400" style={{ width: `${fee.collection_rate}%` }} /></div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-sm"><span className="text-ink-3">Pending</span><span className="tabular font-medium text-red-600 dark:text-red-400">{rupees(fee.total_pending)}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-400" style={{ width: `${100 - fee.collection_rate}%` }} /></div>
                  </div>
                </div>
              ) : (
                <Spinner />
              )}
            </Card>
          </div>
        </div>
      )}

      {activeReport === "attendance" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatTile label="Enrolled" value={att?.total_students ?? "…"} icon={<Users size={20} />} color="blue" />
            <StatTile label="Present" value={att?.present_today ?? "…"} icon={<UserCheck size={20} />} color="green" />
            <StatTile label="Absent" value={att?.absent_today ?? "…"} icon={<Users size={20} />} color="pink" />
            <StatTile label="Attendance Rate" value={att ? `${att.attendance_rate}%` : "…"} hint={att ? `${att.marked} marked` : undefined} icon={<PieChart size={20} />} color="purple" />
          </div>
          <Card animate={false}>
            <h3 className="mb-4 font-semibold text-ink">Attendance by Section</h3>
            <div className="overflow-x-auto">
              <table className="lg-table">
                <thead>
                  <tr><th>Section</th><th className="!text-center">Enrolled</th><th className="!text-center">Present</th><th className="!text-center">Absent</th><th className="!text-center">Rate</th></tr>
                </thead>
                <tbody>
                  {(sectionsQuery.data ?? []).map((section, i) => {
                    const d = sectionStats[i]?.data;
                    return (
                      <tr key={section.id}>
                        <td className="font-medium">{sectionLabel(section)}</td>
                        <td className="text-center">{d?.total_students ?? "…"}</td>
                        <td className="text-center text-green-600 dark:text-green-400">{d?.present_today ?? "…"}</td>
                        <td className="text-center text-red-600 dark:text-red-400">{d?.absent_today ?? "…"}</td>
                        <td className="text-center">
                          {d && d.marked > 0 ? <Badge tone={d.attendance_rate >= 90 ? "green" : d.attendance_rate >= 75 ? "yellow" : "red"}>{d.attendance_rate}%</Badge> : <span className="text-ink-3">Not marked</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {sectionsQuery.data?.length === 0 && (
                    <tr><td colSpan={5} className="!py-8 text-center text-ink-3">No sections have been set up yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeReport === "fees" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatTile label="Billed" value={fee ? rupees(fee.total_expected) : "…"} icon={<FileText size={20} />} color="blue" />
            <StatTile label="Collected" value={fee ? rupees(fee.total_collected) : "…"} hint={fee ? `${fee.collection_rate}% collected` : undefined} icon={<IndianRupee size={20} />} color="green" />
            <StatTile label="Pending" value={fee ? rupees(fee.total_pending) : "…"} icon={<IndianRupee size={20} />} color="orange" />
            <StatTile label="Overdue Invoices" value={fee?.overdue_invoices ?? "…"} hint={fee ? `of ${fee.total_invoices} invoices` : undefined} icon={<FileText size={20} />} color="pink" />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card animate={false}>
              <h3 className="mb-4 font-semibold text-ink">Collection by Month</h3>
              {monthlyQuery.data && monthlyQuery.data.length > 0 ? <FeeCollectionBarChart data={monthlyQuery.data} height={240} /> : <p className="flex h-60 items-center justify-center text-sm text-ink-3">No payments recorded yet.</p>}
            </Card>
            <Card animate={false}>
              <h3 className="mb-4 font-semibold text-ink">Collection by Class</h3>
              {byClassQuery.data && byClassQuery.data.length > 0 ? <ClassFeeBarChart data={byClassQuery.data} height={240} /> : <p className="flex h-60 items-center justify-center text-sm text-ink-3">No invoices raised yet.</p>}
            </Card>
          </div>
          <Card animate={false}>
            <h3 className="mb-4 font-semibold text-ink">Recent Payments</h3>
            <div className="overflow-x-auto">
              <table className="lg-table">
                <thead><tr><th>Student</th><th>Method</th><th>When</th><th className="!text-end">Amount</th></tr></thead>
                <tbody>
                  {paymentsQuery.data?.items.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.student_name ?? "—"}</td>
                      <td>{p.payment_method.replace("_", " ")}</td>
                      <td className="text-ink-3">{timeAgo(p.payment_date)}</td>
                      <td className="tabular text-end font-medium">{rupees(p.amount)}</td>
                    </tr>
                  ))}
                  {paymentsQuery.data?.items.length === 0 && <tr><td colSpan={4} className="!py-8 text-center text-ink-3">No payments yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeReport === "students" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatTile label="Enrolled" value={students.length} icon={<Users size={20} />} color="blue" />
            <StatTile label="Boys" value={`${pct(male)}%`} hint={`${male} students`} icon={<Users size={20} />} color="purple" />
            <StatTile label="Girls" value={`${pct(female)}%`} hint={`${female} students`} icon={<Users size={20} />} color="pink" />
            <StatTile label="Classes" value={classesQuery.data?.length ?? "…"} icon={<GraduationCap size={20} />} color="green" />
          </div>
          <Card animate={false}>
            <h3 className="mb-4 font-semibold text-ink">Students by Class</h3>
            {distributionQuery.data && distributionQuery.data.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
                {distributionQuery.data.map((d) => (
                  <div key={d.name} className="glass-row !flex-col !items-start !gap-0.5 !rounded-2xl !p-4">
                    <p className="tabular text-2xl font-semibold text-ink">{d.value}</p>
                    <p className="text-sm text-ink-3">{d.name}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-3">No students enrolled yet.</p>
            )}
          </Card>
          <Card animate={false}>
            <h3 className="mb-4 font-semibold text-ink">Students</h3>
            <div className="overflow-x-auto">
              <table className="lg-table">
                <thead><tr><th>Student</th><th>Admission No</th><th className="!text-center">Status</th></tr></thead>
                <tbody>
                  {students.slice(0, 10).map((s) => (
                    <tr key={s.id}>
                      <td className="font-medium">{s.full_name}</td>
                      <td className="text-ink-2">{s.admission_no}</td>
                      <td className="text-center"><Badge tone={s.status === "ACTIVE" ? "green" : "gray"}>{s.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
