import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, ErrorText, Label, PageHeader, Spinner } from "../../components/ui";
import { listStudentAttendance, markStudentAttendance, fetchSectionRoster } from "./api";
import { sectionLabel, useClasses, useMySectionIds, useSections } from "./hooks";
import { ATTENDANCE_STATUSES, type AttendanceStatus } from "./types";
import { useLanguage } from "../../i18n/LanguageContext";
import { CheckCircle, XCircle, Clock, AlertCircle, Calendar, Users, Save } from "lucide-react";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const statusConfig: Record<AttendanceStatus, { icon: typeof CheckCircle; color: string; bg: string }> = {
  PRESENT: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-100 dark:bg-green-500/20" },
  ABSENT: { icon: XCircle, color: "text-red-600", bg: "bg-red-100 dark:bg-red-500/20" },
  LATE: { icon: Clock, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-500/20" },
  EXCUSED: { icon: AlertCircle, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-500/20" },
};

export default function TeacherAttendance() {
  const { t } = useLanguage();
  const sectionIds = useMySectionIds();
  const { data: sections } = useSections();
  const { data: classes } = useClasses();
  const queryClient = useQueryClient();

  const [sectionId, setSectionId] = useState<string>("");
  const [date, setDate] = useState<string>(todayIso());
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!sectionId && sectionIds.length > 0) setSectionId(sectionIds[0]);
  }, [sectionIds, sectionId]);

  const rosterQuery = useQuery({
    queryKey: ["teacher", "roster", sectionId],
    queryFn: () => fetchSectionRoster(sectionId),
    enabled: !!sectionId,
  });

  const existingQuery = useQuery({
    queryKey: ["teacher", "attendance", sectionId, date],
    queryFn: () => listStudentAttendance({ section_id: sectionId, date_from: date, date_to: date }),
    enabled: !!sectionId && !!date,
  });

  useEffect(() => {
    if (!existingQuery.data) return;
    const nextStatuses: Record<string, AttendanceStatus> = {};
    const nextRemarks: Record<string, string> = {};
    for (const record of existingQuery.data.items) {
      nextStatuses[record.student_id] = record.status;
      if (record.remarks) nextRemarks[record.student_id] = record.remarks;
    }
    setStatuses(nextStatuses);
    setRemarks(nextRemarks);
  }, [existingQuery.data]);

  const saveMutation = useMutation({
    mutationFn: markStudentAttendance,
    onSuccess: () => {
      setSaveError(null);
      void queryClient.invalidateQueries({ queryKey: ["teacher", "attendance", sectionId, date] });
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setSaveError(message ?? "Failed to save attendance.");
    },
  });

  const roster = useMemo(() => rosterQuery.data ?? [], [rosterQuery.data]);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setStatuses((prev) => ({ ...prev, [studentId]: status }));
  }

  function setRemark(studentId: string, value: string) {
    setRemarks((prev) => ({ ...prev, [studentId]: value }));
  }

  function handleSave() {
    if (!sectionId || roster.length === 0) return;
    saveMutation.mutate({
      section_id: sectionId,
      date,
      records: roster.map((student) => ({
        student_id: student.id,
        status: statuses[student.id] ?? "PRESENT",
        remarks: remarks[student.id] || null,
      })),
    });
  }

  const stats = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    roster.forEach((s) => {
      const status = statuses[s.id] ?? "PRESENT";
      if (status === "PRESENT") counts.present++;
      else if (status === "ABSENT") counts.absent++;
      else if (status === "LATE") counts.late++;
      else if (status === "EXCUSED") counts.excused++;
    });
    return counts;
  }, [roster, statuses]);

  return (
    <div className="animate-page-enter">
      <PageHeader title={t("attendance.title")} subtitle={t("attendance.subtitle")} />

      {/* Filters Card */}
      <Card className="mb-6" gradient>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="section" className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-[#6D28D9]" />
              {t("attendance.selectSection")}
            </Label>
            <select
              id="section"
              className="w-full rounded-xl border border-[#E5DDF5] dark:border-[#2D1B4E] bg-white dark:bg-[#1B1230] px-4 py-3 text-sm text-[#24113F] dark:text-white focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 transition-all"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
            >
              <option value="" disabled>
                {t("attendance.selectSection")}
              </option>
              {sectionIds.map((id) => (
                <option key={id} value={id}>
                  {sectionLabel(id, sections, classes)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="date" className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-[#6D28D9]" />
              {t("attendance.date")}
            </Label>
            <input
              id="date"
              type="date"
              className="w-full rounded-xl border border-[#E5DDF5] dark:border-[#2D1B4E] bg-white dark:bg-[#1B1230] px-4 py-3 text-sm text-[#24113F] dark:text-white focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 transition-all"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {!sectionId ? (
        <Card className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-[#6D28D9]/10 to-[#EC4899]/10 flex items-center justify-center">
            <Users className="w-8 h-8 text-[#6D28D9]" />
          </div>
          <p className="text-[#7C6F95] dark:text-[#D8CCEA]">
            {sectionIds.length === 0
              ? "No sections found — you have no timetable slots assigned yet."
              : "Select a section to mark attendance."}
          </p>
        </Card>
      ) : rosterQuery.isLoading || existingQuery.isLoading ? (
        <Card className="py-12 flex justify-center">
          <Spinner size="lg" />
        </Card>
      ) : roster.length === 0 ? (
        <Card className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-amber-500" />
          </div>
          <p className="text-[#7C6F95]">No active students in this section.</p>
        </Card>
      ) : (
        <>
          {/* Stats Summary */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: "Present", count: stats.present, color: "from-green-500 to-emerald-500", icon: CheckCircle },
              { label: "Absent", count: stats.absent, color: "from-red-500 to-rose-500", icon: XCircle },
              { label: "Late", count: stats.late, color: "from-amber-500 to-orange-500", icon: Clock },
              { label: "Excused", count: stats.excused, color: "from-blue-500 to-cyan-500", icon: AlertCircle },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className="p-4 rounded-2xl bg-white dark:bg-[#1B1230] border border-[#E5DDF5] dark:border-[#2D1B4E] hover:shadow-lg transition-all"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-2`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-2xl font-bold text-[#24113F] dark:text-white">{stat.count}</p>
                <p className="text-sm text-[#7C6F95]">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Attendance Table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E5DDF5] dark:border-[#2D1B4E]">
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#7C6F95]">
                      Student
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#7C6F95]">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#7C6F95]">
                      Remarks
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5DDF5] dark:divide-[#2D1B4E]">
                  {roster.map((student, i) => {
                    const currentStatus = statuses[student.id] ?? "PRESENT";
                    const config = statusConfig[currentStatus];
                    return (
                      <tr
                        key={student.id}
                        className="hover:bg-[#F7F5FF] dark:hover:bg-[#2D1B4E] transition-colors"
                        style={{ animationDelay: `${i * 0.05}s` }}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6D28D9] to-[#8B5CF6] flex items-center justify-center text-white font-semibold">
                              {student.full_name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-[#24113F] dark:text-white">{student.full_name}</p>
                              {student.roll_number && (
                                <p className="text-xs text-[#7C6F95]">Roll #{student.roll_number}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex gap-2">
                            {ATTENDANCE_STATUSES.map((status) => {
                              const cfg = statusConfig[status];
                              const isActive = currentStatus === status;
                              return (
                                <button
                                  key={status}
                                  onClick={() => setStatus(student.id, status)}
                                  className={`p-2 rounded-xl transition-all ${
                                    isActive
                                      ? `${cfg.bg} ${cfg.color} ring-2 ring-offset-2 ring-current scale-110`
                                      : "bg-gray-100 dark:bg-[#2D1B4E] text-gray-400 hover:scale-105"
                                  }`}
                                  title={status}
                                >
                                  <cfg.icon className="w-5 h-5" />
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <input
                            className="w-full rounded-xl border border-[#E5DDF5] dark:border-[#2D1B4E] bg-white dark:bg-[#1B1230] px-3 py-2 text-sm text-[#24113F] dark:text-white focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20 transition-all"
                            value={remarks[student.id] ?? ""}
                            onChange={(e) => setRemark(student.id, e.target.value)}
                            placeholder="Add remarks..."
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-6 pt-4 border-t border-[#E5DDF5] dark:border-[#2D1B4E] flex items-center gap-4">
              <Button onClick={handleSave} disabled={saveMutation.isPending} glow>
                {saveMutation.isPending ? (
                  <>
                    <Spinner size="sm" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Attendance
                  </>
                )}
              </Button>
              {saveMutation.isSuccess && !saveMutation.isPending && (
                <span className="flex items-center gap-2 text-sm text-green-600 animate-pulse">
                  <CheckCircle className="w-4 h-4" />
                  Saved successfully!
                </span>
              )}
              <ErrorText>{saveError}</ErrorText>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
