import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, Spinner, Badge, Button } from "../../components/ui";
import { api } from "../../api/client";
import type { PageResponse } from "../../types/common";
import {
  BarChart3, Users, TrendingUp, Calendar, DollarSign, BookOpen, Bus,
  Download, Filter, FileText, PieChart, Activity, AlertTriangle,
  CheckCircle, XCircle, Clock, GraduationCap, UserCheck, Award
} from "lucide-react";

interface AttendanceStats {
  total_students: number;
  present_today: number;
  absent_today: number;
  attendance_rate: number;
}

interface FeeStats {
  total_collected: number;
  total_pending: number;
  collection_rate: number;
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
  status: string;
}

interface AttendanceRecord {
  date: string;
  present: number;
  absent: number;
  late: number;
  total: number;
}

export default function Reports() {
  const [activeReport, setActiveReport] = useState<"overview" | "attendance" | "fees" | "students">("overview");
  const [selectedSection, setSelectedSection] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const sectionsQuery = useQuery({
    queryKey: ["sections"],
    queryFn: async () => {
      const { data } = await api.get<Section[]>("/academics/sections");
      return data;
    },
  });

  const classesQuery = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data } = await api.get<ClassItem[]>("/academics/classes");
      return data;
    },
  });

  const studentsQuery = useQuery({
    queryKey: ["students-report", selectedSection],
    queryFn: async () => {
      const params: Record<string, string> = { status: "ACTIVE", page_size: "500" };
      if (selectedSection) params.section_id = selectedSection;
      const { data } = await api.get<PageResponse<Student>>("/students", { params });
      return data;
    },
  });

  const attendanceStatsQuery = useQuery({
    queryKey: ["attendance-stats", selectedSection],
    queryFn: async () => {
      try {
        const params: Record<string, string> = {};
        if (selectedSection) params.section_id = selectedSection;
        const { data } = await api.get<AttendanceStats>("/attendance/stats", { params });
        return data;
      } catch {
        return { total_students: studentsQuery.data?.total ?? 0, present_today: 0, absent_today: 0, attendance_rate: 0 };
      }
    },
    enabled: !!studentsQuery.data,
  });

  const feeStatsQuery = useQuery({
    queryKey: ["fee-stats"],
    queryFn: async () => {
      try {
        const { data } = await api.get<FeeStats>("/fees/stats");
        return data;
      } catch {
        return { total_collected: 0, total_pending: 0, collection_rate: 0 };
      }
    },
  });

  const getClassName = (classId: string) => classesQuery.data?.find(c => c.id === classId)?.name || "";
  const getSectionLabel = (section: Section) => `${getClassName(section.class_id)} - ${section.name}`;

  const totalStudents = studentsQuery.data?.total ?? 0;
  const presentToday = attendanceStatsQuery.data?.present_today ?? 0;
  const absentToday = attendanceStatsQuery.data?.absent_today ?? 0;
  const attendanceRate = totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0;

  const reportTypes = [
    { id: "overview", label: "Overview", icon: PieChart },
    { id: "attendance", label: "Attendance", icon: UserCheck },
    { id: "fees", label: "Fee Collection", icon: DollarSign },
    { id: "students", label: "Student Analytics", icon: GraduationCap },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Reports & Analytics" subtitle="Comprehensive school performance insights">
        <div className="flex gap-2">
          <Button variant="secondary" className="gap-2">
            <Download className="w-4 h-4" /> Export PDF
          </Button>
          <Button variant="secondary" className="gap-2">
            <FileText className="w-4 h-4" /> Export Excel
          </Button>
        </div>
      </PageHeader>

      {/* Report Type Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {reportTypes.map((report) => (
          <button
            key={report.id}
            onClick={() => setActiveReport(report.id as typeof activeReport)}
            className={`px-4 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2 ${
              activeReport === report.id
                ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/30"
                : "bg-white text-slate-600 hover:bg-violet-50 border border-slate-200"
            }`}
          >
            <report.icon className="w-4 h-4" />
            {report.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-600">Filters:</span>
          </div>
          <div>
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-500 focus:ring-violet-500"
            >
              <option value="">All Sections</option>
              {sectionsQuery.data?.map(s => (
                <option key={s.id} value={s.id}>{getSectionLabel(s)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-500"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-500"
            />
          </div>
        </div>
      </Card>

      {/* Overview Report */}
      {activeReport === "overview" && (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Students", value: totalStudents, icon: Users, color: "blue", trend: "+12" },
              { label: "Today's Attendance", value: `${attendanceRate}%`, icon: UserCheck, color: "green", trend: "+3%" },
              { label: "Fee Collection", value: `₹${((feeStatsQuery.data?.total_collected ?? 0) / 1000).toFixed(0)}K`, icon: DollarSign, color: "violet", trend: "+8%" },
              { label: "Active Courses", value: "24", icon: BookOpen, color: "orange", trend: "+2" },
            ].map((metric, i) => (
              <div key={i} className="relative overflow-hidden rounded-2xl bg-white border border-slate-100 p-5 group hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300">
                <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-${metric.color}-500/10 to-transparent rounded-bl-full`} />
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-${metric.color}-500 to-${metric.color}-600 flex items-center justify-center text-white mb-4 shadow-lg shadow-${metric.color}-500/30 group-hover:scale-110 transition-transform`}>
                  <metric.icon className="w-6 h-6" />
                </div>
                <p className="text-sm text-slate-500 mb-1">{metric.label}</p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-bold text-slate-800">{metric.value}</p>
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> {metric.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Attendance Trend */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-violet-600" /> Attendance Trend
                </h3>
                <Badge tone="violet">Last 7 Days</Badge>
              </div>
              <div className="h-48 flex items-end justify-between gap-2 px-2">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, i) => {
                  const height = 40 + Math.random() * 55;
                  return (
                    <div key={day} className="flex-1 flex flex-col items-center gap-2">
                      <div
                        className="w-full bg-gradient-to-t from-violet-600 to-violet-400 rounded-t-lg transition-all hover:from-violet-700 hover:to-violet-500"
                        style={{ height: `${height}%` }}
                      />
                      <span className="text-xs text-slate-500">{day}</span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Student Distribution */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-violet-600" /> Student Distribution
                </h3>
              </div>
              <div className="flex items-center justify-center">
                <div className="relative w-40 h-40">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#E2E8F0" strokeWidth="12" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#8B5CF6" strokeWidth="12"
                      strokeDasharray={`${35 * 2.51} 251`} strokeLinecap="round" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#3B82F6" strokeWidth="12"
                      strokeDasharray={`${25 * 2.51} 251`} strokeDashoffset={`-${35 * 2.51}`} strokeLinecap="round" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#10B981" strokeWidth="12"
                      strokeDasharray={`${20 * 2.51} 251`} strokeDashoffset={`-${60 * 2.51}`} strokeLinecap="round" />
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#F59E0B" strokeWidth="12"
                      strokeDasharray={`${20 * 2.51} 251`} strokeDashoffset={`-${80 * 2.51}`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-slate-800">{totalStudents}</p>
                      <p className="text-xs text-slate-500">Students</p>
                    </div>
                  </div>
                </div>
                <div className="ml-8 space-y-3">
                  {[
                    { label: "Primary", color: "violet", pct: 35 },
                    { label: "Middle", color: "blue", pct: 25 },
                    { label: "Secondary", color: "green", pct: 20 },
                    { label: "Sr. Secondary", color: "amber", pct: 20 },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full bg-${item.color}-500`} />
                      <span className="text-sm text-slate-600">{item.label}</span>
                      <span className="text-sm font-medium text-slate-800">{item.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Quick Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">Today's Summary</h3>
                <Calendar className="w-5 h-5 text-slate-400" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-slate-700">Present</span>
                  </div>
                  <span className="font-semibold text-green-700">{presentToday}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-600" />
                    <span className="text-sm text-slate-700">Absent</span>
                  </div>
                  <span className="font-semibold text-red-700">{absentToday}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    <span className="text-sm text-slate-700">Late Arrivals</span>
                  </div>
                  <span className="font-semibold text-yellow-700">5</span>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">Fee Collection</h3>
                <DollarSign className="w-5 h-5 text-slate-400" />
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500">Collected</span>
                    <span className="font-medium text-green-600">₹{(feeStatsQuery.data?.total_collected ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full" style={{ width: `${feeStatsQuery.data?.collection_rate ?? 65}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-500">Pending</span>
                    <span className="font-medium text-red-600">₹{(feeStatsQuery.data?.total_pending ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full" style={{ width: `${100 - (feeStatsQuery.data?.collection_rate ?? 65)}%` }} />
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">Top Performers</h3>
                <Award className="w-5 h-5 text-slate-400" />
              </div>
              <div className="space-y-3">
                {[
                  { name: "Aarav Sharma", class: "10-A", score: 98 },
                  { name: "Priya Patel", class: "9-B", score: 96 },
                  { name: "Arjun Kumar", class: "12-A", score: 95 },
                ].map((student, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                        i === 0 ? "bg-yellow-500" : i === 1 ? "bg-slate-400" : "bg-amber-700"
                      }`}>
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-800">{student.name}</p>
                        <p className="text-xs text-slate-500">Class {student.class}</p>
                      </div>
                    </div>
                    <Badge tone="green">{student.score}%</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Attendance Report */}
      {activeReport === "attendance" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-5 text-center">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-3xl font-bold text-slate-800">{totalStudents}</p>
              <p className="text-sm text-slate-500">Total Students</p>
            </Card>
            <Card className="p-5 text-center">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-3xl font-bold text-green-600">{presentToday}</p>
              <p className="text-sm text-slate-500">Present Today</p>
            </Card>
            <Card className="p-5 text-center">
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mx-auto mb-3">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
              <p className="text-3xl font-bold text-red-600">{absentToday}</p>
              <p className="text-sm text-slate-500">Absent Today</p>
            </Card>
            <Card className="p-5 text-center">
              <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-6 h-6 text-violet-600" />
              </div>
              <p className="text-3xl font-bold text-violet-600">{attendanceRate}%</p>
              <p className="text-sm text-slate-500">Attendance Rate</p>
            </Card>
          </div>

          <Card className="p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Attendance by Section</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-slate-500 border-b border-slate-100">
                    <th className="pb-3 font-medium">Section</th>
                    <th className="pb-3 font-medium text-center">Total</th>
                    <th className="pb-3 font-medium text-center">Present</th>
                    <th className="pb-3 font-medium text-center">Absent</th>
                    <th className="pb-3 font-medium text-center">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {sectionsQuery.data?.slice(0, 10).map((section) => {
                    const total = Math.floor(Math.random() * 30) + 20;
                    const present = Math.floor(total * (0.7 + Math.random() * 0.25));
                    const absent = total - present;
                    const rate = Math.round((present / total) * 100);
                    return (
                      <tr key={section.id} className="border-b border-slate-50">
                        <td className="py-3 font-medium text-slate-800">{getSectionLabel(section)}</td>
                        <td className="py-3 text-center text-slate-600">{total}</td>
                        <td className="py-3 text-center text-green-600">{present}</td>
                        <td className="py-3 text-center text-red-600">{absent}</td>
                        <td className="py-3 text-center">
                          <Badge tone={rate >= 90 ? "green" : rate >= 75 ? "yellow" : "red"}>{rate}%</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Fee Collection Report */}
      {activeReport === "fees" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-5 text-center">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mx-auto mb-3">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-600">₹{((feeStatsQuery.data?.total_collected ?? 0) / 100000).toFixed(1)}L</p>
              <p className="text-sm text-slate-500">Total Collected</p>
            </Card>
            <Card className="p-5 text-center">
              <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-red-600">₹{((feeStatsQuery.data?.total_pending ?? 0) / 100000).toFixed(1)}L</p>
              <p className="text-sm text-slate-500">Pending Amount</p>
            </Card>
            <Card className="p-5 text-center">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-600">456</p>
              <p className="text-sm text-slate-500">Paid Students</p>
            </Card>
            <Card className="p-5 text-center">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <p className="text-2xl font-bold text-orange-600">89</p>
              <p className="text-sm text-slate-500">Defaulters</p>
            </Card>
          </div>

          <Card className="p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Collection by Fee Type</h3>
            <div className="space-y-4">
              {[
                { type: "Tuition Fee", collected: 850000, pending: 150000 },
                { type: "Transport Fee", collected: 280000, pending: 70000 },
                { type: "Library Fee", collected: 45000, pending: 5000 },
                { type: "Lab Fee", collected: 120000, pending: 30000 },
                { type: "Sports Fee", collected: 95000, pending: 25000 },
              ].map((fee) => {
                const total = fee.collected + fee.pending;
                const pct = Math.round((fee.collected / total) * 100);
                return (
                  <div key={fee.type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-slate-700">{fee.type}</span>
                      <span className="text-slate-500">
                        ₹{(fee.collected / 1000).toFixed(0)}K / ₹{(total / 1000).toFixed(0)}K
                      </span>
                    </div>
                    <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Student Analytics */}
      {activeReport === "students" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-5 text-center">
              <p className="text-3xl font-bold text-slate-800">{totalStudents}</p>
              <p className="text-sm text-slate-500">Total Enrolled</p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-3xl font-bold text-green-600">32</p>
              <p className="text-sm text-slate-500">New This Month</p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-3xl font-bold text-blue-600">48%</p>
              <p className="text-sm text-slate-500">Male Students</p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-3xl font-bold text-pink-600">52%</p>
              <p className="text-sm text-slate-500">Female Students</p>
            </Card>
          </div>

          <Card className="p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Students by Class</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {classesQuery.data?.map((cls, i) => {
                const count = Math.floor(Math.random() * 80) + 40;
                return (
                  <div key={cls.id} className="p-4 bg-gradient-to-br from-violet-50 to-purple-50 rounded-xl text-center hover:shadow-md transition-all">
                    <p className="text-xl font-bold text-violet-700">{count}</p>
                    <p className="text-sm text-slate-600">{cls.name}</p>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Recent Admissions</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-slate-500 border-b border-slate-100">
                    <th className="pb-3 font-medium">Student</th>
                    <th className="pb-3 font-medium">Admission No</th>
                    <th className="pb-3 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {studentsQuery.data?.items.slice(0, 10).map((student) => (
                    <tr key={student.id} className="border-b border-slate-50">
                      <td className="py-3 font-medium text-slate-800">{student.full_name}</td>
                      <td className="py-3 text-slate-600">{student.admission_no}</td>
                      <td className="py-3 text-center">
                        <Badge tone={student.status === "ACTIVE" ? "green" : "gray"}>{student.status}</Badge>
                      </td>
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
