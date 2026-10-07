import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, PageHeader, Spinner, Badge, StatTile } from "../../components/ui";
import { api } from "../../api/client";
import type { PageResponse } from "../../types/common";
import { fetchClasses, fetchSections, listStudents } from "./api";
import { useLanguage } from "../../i18n/LanguageContext";

interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  status: string;
  remarks: string | null;
}

export default function AttendanceList() {
  const { t, te } = useLanguage();
  const queryClient = useQueryClient();
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  const classesQuery = useQuery({ queryKey: ["classes"], queryFn: () => fetchClasses() });
  const sectionsQuery = useQuery({ queryKey: ["sections"], queryFn: () => fetchSections() });

  const studentsQuery = useQuery({
    queryKey: ["students", selectedSection],
    queryFn: () => listStudents({ section_id: selectedSection, status: "ACTIVE", page: 1, page_size: 100 }),
    enabled: !!selectedSection,
  });

  const attendanceQuery = useQuery({
    queryKey: ["attendance", selectedSection, selectedDate],
    queryFn: async () => {
      if (!selectedSection) return [];
      const { data } = await api.get<PageResponse<AttendanceRecord>>("/attendance/students", {
        params: { section_id: selectedSection, date_from: selectedDate, date_to: selectedDate, page_size: 500 },
      });
      return data.items;
    },
    enabled: !!selectedSection && !!selectedDate,
  });

  const markMutation = useMutation({
    mutationFn: async (payload: { student_id: string; date: string; status: string }) => {
      const { data } = await api.post("/attendance/students", {
        section_id: selectedSection,
        date: payload.date,
        records: [{ student_id: payload.student_id, status: payload.status }],
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });

  const getSectionName = (id: string) => {
    const section = sectionsQuery.data?.find((s) => s.id === id);
    if (!section) return id;
    const cls = classesQuery.data?.find((c) => c.id === section.class_id);
    return `${te("class", cls?.name)} - ${te("section", section.name)}`;
  };

  const getAttendanceStatus = (studentId: string) => {
    const record = attendanceQuery.data?.find((r) => r.student_id === studentId);
    return record?.status || null;
  };

  const statusColors: Record<string, string> = {
    PRESENT: "bg-green-100 text-green-700",
    ABSENT: "bg-red-100 text-red-700",
    LATE: "bg-yellow-100 text-yellow-700",
    HALF_DAY: "bg-orange-100 text-orange-700",
  };

  const presentCount = attendanceQuery.data?.filter((r) => r.status === "PRESENT").length ?? 0;
  const absentCount = attendanceQuery.data?.filter((r) => r.status === "ABSENT").length ?? 0;
  const totalStudents = studentsQuery.data?.total ?? 0;

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={t("admin.attendance.title")} subtitle={t("admin.attendance.subtitle")} />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.common.section")}</label>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="rounded-lg border border-line px-3 py-2 focus:border-violet-500 focus:ring-violet-500"
            >
              <option value="">{t("admin.attendance.select")}</option>
              {sectionsQuery.data?.map((section) => (
                <option key={section.id} value={section.id}>
                  {getSectionName(section.id)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.common.date")}</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-lg border border-line px-3 py-2 focus:border-violet-500 focus:ring-violet-500"
            />
          </div>
        </div>
      </Card>

      {selectedSection && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label={t("admin.attendance.totalStudents")} value={totalStudents} />
            <StatTile label={t("admin.attendance.present")} value={presentCount} />
            <StatTile label={t("admin.attendance.absent")} value={absentCount} />
            <StatTile
              label={t("admin.attendance.attendancePct")}
              value={totalStudents > 0 ? `${((presentCount / totalStudents) * 100).toFixed(0)}%` : t("admin.attendance.na")}
            />
          </div>

          {studentsQuery.isLoading || attendanceQuery.isLoading ? (
            <div className="flex justify-center py-12"><Spinner /></div>
          ) : (
            <Card>
              <div className="space-y-2">
                {studentsQuery.data?.items.map((student) => {
                  const status = getAttendanceStatus(student.id);
                  return (
                    <div key={student.id} className="flex items-center justify-between p-3 bg-violet-50 rounded-lg">
                      <div>
                        <p className="font-medium text-ink">{student.full_name}</p>
                        <p className="text-sm text-accent-fg">{student.admission_no}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {status && <Badge className={statusColors[status]}>{te("status", status)}</Badge>}
                        <div className="flex gap-1">
                          {["PRESENT", "ABSENT", "LATE"].map((s) => (
                            <button
                              key={s}
                              title={te("status", s)}
                              onClick={() => markMutation.mutate({ student_id: student.id, date: selectedDate, status: s })}
                              disabled={markMutation.isPending}
                              className={`px-2 py-1 text-xs rounded ${
                                status === s
                                  ? statusColors[s]
                                  : "bg-surface-3 text-ink-2 hover:bg-violet-100"
                              }`}
                            >
                              {te("status", s).charAt(0)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {studentsQuery.data?.items.length === 0 && (
                  <p className="text-center text-accent-fg py-4">{t("admin.attendance.noStudents")}</p>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      {!selectedSection && (
        <Card>
          <p className="text-center text-accent-fg py-8">{t("admin.attendance.selectSection")}</p>
        </Card>
      )}
    </div>
  );
}
