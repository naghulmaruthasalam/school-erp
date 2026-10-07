import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, Spinner, Select } from "../../components/ui";
import { AttendanceLineChart } from "../../components/Charts";
import { api } from "../../api/client";
import { fetchAttendanceTrend } from "./api";
import { useLanguage } from "../../i18n/LanguageContext";

interface AttendanceStats {
  total_students: number;
  present_today: number;
  absent_today: number;
  attendance_percentage: number;
}

interface Class {
  id: string;
  name: string;
}

export default function AttendanceReports() {
  const { t, te } = useLanguage();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [classFilter, setClassFilter] = useState("");

  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data } = await api.get<Class[]>("/academics/classes");
      return data;
    },
  });

  const statsQuery = useQuery({
    queryKey: ["attendance-stats", selectedDate, classFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("date", selectedDate);
      if (classFilter) params.append("class_id", classFilter);
      const { data } = await api.get<AttendanceStats>(`/attendance/stats?${params}`);
      return data;
    },
  });

  const trendQuery = useQuery({ queryKey: ["attendance-trend", 14], queryFn: () => fetchAttendanceTrend(14) });

  const stats = statsQuery.data || { total_students: 0, present_today: 0, absent_today: 0, attendance_percentage: 0 };

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={t("principal.attendance.title")} subtitle={t("principal.attendance.subtitle")} />

      <Card className="mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="w-48">
            <label className="block text-sm font-medium text-ink-2 mb-1">{t("principal.attendance.date")}</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink dark:text-white focus:border-accent focus:outline-none"
            />
          </div>
          <div className="w-48">
            <label className="block text-sm font-medium text-ink-2 mb-1">{t("principal.common.class")}</label>
            <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="">{t("principal.common.allClasses")}</option>
              {classesQuery.data?.map((c) => (
                <option key={c.id} value={c.id}>{te("class", c.name)}</option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {statsQuery.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <p className="text-sm font-medium text-ink-2">{t("principal.attendance.totalStudents")}</p>
            <p className="text-3xl font-bold text-accent-fg dark:text-accent-fg mt-1">{stats.total_students}</p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-ink-2">{t("principal.attendance.presentToday")}</p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">{stats.present_today}</p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-ink-2">{t("principal.attendance.absentToday")}</p>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">{stats.absent_today}</p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-ink-2">{t("principal.attendance.rate")}</p>
            <p className="text-3xl font-bold text-accent-fg dark:text-accent-fg mt-1">{(stats.attendance_percentage ?? 0).toFixed(1)}%</p>
          </Card>
        </div>
      )}

      <Card className="mt-6">
        <h3 className="font-semibold text-ink dark:text-white mb-4">{t("principal.attendance.trend")}</h3>
        {trendQuery.isLoading ? (
          <div className="flex h-64 items-center justify-center"><Spinner /></div>
        ) : trendQuery.data && trendQuery.data.length > 0 ? (
          <AttendanceLineChart data={trendQuery.data} height={260} />
        ) : (
          <p className="flex h-64 items-center justify-center text-sm text-ink-3">{t("principal.attendance.noTrend")}</p>
        )}
      </Card>
    </div>
  );
}
