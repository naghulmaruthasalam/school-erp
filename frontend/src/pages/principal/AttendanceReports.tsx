import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, Spinner, Select } from "../../components/ui";
import { api } from "../../api/client";

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
      try {
        const { data } = await api.get<AttendanceStats>(`/attendance/stats?${params}`);
        return data;
      } catch {
        return { total_students: 0, present_today: 0, absent_today: 0, attendance_percentage: 0 };
      }
    },
  });

  const stats = statsQuery.data || { total_students: 0, present_today: 0, absent_today: 0, attendance_percentage: 0 };

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Attendance Reports" subtitle="View school-wide attendance statistics" />

      <Card className="mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="w-48">
            <label className="block text-sm font-medium text-ink-2 mb-1">Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-ink dark:text-white focus:border-accent focus:outline-none"
            />
          </div>
          <div className="w-48">
            <label className="block text-sm font-medium text-ink-2 mb-1">Class</label>
            <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="">All Classes</option>
              {classesQuery.data?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
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
            <p className="text-sm font-medium text-ink-2">Total Students</p>
            <p className="text-3xl font-bold text-accent-fg dark:text-accent-fg mt-1">{stats.total_students}</p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-ink-2">Present Today</p>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">{stats.present_today}</p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-ink-2">Absent Today</p>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">{stats.absent_today}</p>
          </Card>
          <Card>
            <p className="text-sm font-medium text-ink-2">Attendance Rate</p>
            <p className="text-3xl font-bold text-accent-fg dark:text-accent-fg mt-1">{stats.attendance_percentage.toFixed(1)}%</p>
          </Card>
        </div>
      )}

      <Card className="mt-6">
        <h3 className="font-semibold text-ink dark:text-white mb-4">Attendance Trends</h3>
        <div className="h-64 flex items-center justify-center text-ink-3">
          <p>Attendance trend chart will be displayed here</p>
        </div>
      </Card>
    </div>
  );
}
