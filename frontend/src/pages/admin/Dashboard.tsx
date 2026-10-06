import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Users,
  GraduationCap,
  FileText,
  IndianRupee,
  Calendar,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  UserPlus,
  ClipboardList,
  Wallet,
  FileBarChart,
  CalendarDays,
  Clock,
  Bell,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { useTheme } from "../../theme/ThemeContext";
import { Spinner } from "../../components/ui";
import { AttendanceLineChart, FeeCollectionBarChart } from "../../components/Charts";
import { fetchAttendanceTrend, fetchFeeCollection, fetchLeaveStats, fetchPendingFees, listAdmissions, listStudents, listTeachers } from "./api";

// Animated Sparkle Component
function AnimatedSparkles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-pulse"
          style={{
            left: `${10 + (i * 8)}%`,
            top: `${15 + (i % 3) * 25}%`,
            animationDelay: `${i * 0.2}s`,
            animationDuration: `${1.5 + (i % 3) * 0.5}s`,
          }}
        >
          <Sparkles
            size={10 + (i % 3) * 4}
            className="text-white/30"
          />
        </div>
      ))}
    </div>
  );
}

// School Building Illustration
function SchoolIllustration() {
  return (
    <svg viewBox="0 0 200 160" className="w-48 h-36 opacity-90">
      {/* Main Building */}
      <rect x="40" y="60" width="120" height="80" fill="white" fillOpacity="0.15" rx="4" />
      <rect x="60" y="40" width="80" height="100" fill="white" fillOpacity="0.2" rx="4" />
      {/* Roof */}
      <polygon points="100,10 150,40 50,40" fill="white" fillOpacity="0.25" />
      {/* Clock */}
      <circle cx="100" cy="55" r="12" fill="white" fillOpacity="0.3" />
      <circle cx="100" cy="55" r="8" fill="white" fillOpacity="0.2" />
      {/* Windows */}
      <rect x="70" y="70" width="15" height="20" fill="white" fillOpacity="0.4" rx="2" />
      <rect x="115" y="70" width="15" height="20" fill="white" fillOpacity="0.4" rx="2" />
      <rect x="70" y="100" width="15" height="20" fill="white" fillOpacity="0.4" rx="2" />
      <rect x="115" y="100" width="15" height="20" fill="white" fillOpacity="0.4" rx="2" />
      {/* Door */}
      <rect x="90" y="105" width="20" height="35" fill="white" fillOpacity="0.35" rx="2" />
      {/* Flag */}
      <line x1="100" y1="10" x2="100" y2="-5" stroke="white" strokeOpacity="0.4" strokeWidth="2" />
      <polygon points="100,-5 120,0 100,5" fill="white" fillOpacity="0.3" />
      {/* Trees */}
      <circle cx="25" cy="120" r="15" fill="white" fillOpacity="0.15" />
      <rect x="22" y="120" width="6" height="20" fill="white" fillOpacity="0.1" />
      <circle cx="175" cy="115" r="18" fill="white" fillOpacity="0.15" />
      <rect x="172" y="115" width="6" height="25" fill="white" fillOpacity="0.1" />
    </svg>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: { value: string; up: boolean };
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  to?: string;
  miniIllustration?: React.ReactNode;
}

function StatCard({ label, value, trend, icon, color, bgColor, to, miniIllustration }: StatCardProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const content = (
    <div className={`relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group ${
      isDark
        ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 hover:shadow-slate-900/50 hover:border-slate-600/50"
        : "bg-white/70 backdrop-blur-xl border border-white/50 hover:shadow-slate-200/50 hover:bg-white/90"
    }`}>
      {/* Glass reflection effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

      <div className="flex items-start justify-between relative z-10">
        <div className={`p-3 rounded-xl shadow-lg ${bgColor} transition-transform duration-300 group-hover:scale-110`}>
          <div className={color}>{icon}</div>
        </div>
        <ChevronRight size={18} className={`transition-all duration-300 group-hover:translate-x-1 ${isDark ? "text-slate-600 group-hover:text-slate-400" : "text-slate-300 group-hover:text-slate-500"}`} />
      </div>
      <div className="mt-4 relative z-10">
        <p className={`text-sm font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
        <p className={`text-3xl font-bold mt-1 ${isDark ? "text-white" : "text-slate-800"}`}>{value}</p>
        {trend && (
          <div className={`flex items-center gap-1.5 mt-2 text-xs font-semibold ${
            trend.up ? "text-emerald-500" : "text-rose-500"
          }`}>
            <span className={`p-0.5 rounded ${trend.up ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
              {trend.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            </span>
            <span>{trend.value}</span>
            <span className={isDark ? "text-slate-500 font-normal" : "text-slate-400 font-normal"}>vs last month</span>
          </div>
        )}
      </div>
      {/* Decorative gradient blob */}
      <div className={`absolute -bottom-6 -right-6 w-28 h-28 rounded-full opacity-20 blur-xl transition-opacity duration-300 group-hover:opacity-30 ${color.replace("text-", "bg-")}`} />
      {/* Mini illustration */}
      {miniIllustration && (
        <div className="absolute bottom-2 right-2 opacity-10 group-hover:opacity-20 transition-opacity">
          {miniIllustration}
        </div>
      )}
    </div>
  );

  return to ? <Link to={to} className="block">{content}</Link> : content;
}

interface QuickActionProps {
  label: string;
  icon: React.ReactNode;
  to: string;
  color: string;
}

function QuickAction({ label, icon, to, color }: QuickActionProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 p-3.5 rounded-xl transition-all duration-200 group ${
        isDark
          ? "hover:bg-slate-700/50 active:bg-slate-700"
          : "hover:bg-slate-50 active:bg-slate-100"
      }`}
    >
      <div className={`p-2.5 rounded-xl shadow-md transition-transform duration-200 group-hover:scale-105 ${color}`}>
        {icon}
      </div>
      <span className={`flex-1 text-sm font-medium ${isDark ? "text-slate-300" : "text-slate-700"}`}>
        {label}
      </span>
      <div className={`p-1 rounded-full transition-all duration-200 group-hover:translate-x-1 ${
        isDark ? "bg-slate-700 text-slate-400" : "bg-slate-100 text-slate-500"
      }`}>
        <ChevronRight size={14} />
      </div>
    </Link>
  );
}

interface ActivityItemProps {
  title: string;
  description: string;
  time: string;
  icon: React.ReactNode;
  color: string;
}

function ActivityItem({ title, description, time, icon, color }: ActivityItemProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="flex items-start gap-3 py-3.5 group">
      <div className={`p-2 rounded-xl shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-105 ${color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isDark ? "text-slate-200" : "text-slate-800"}`}>{title}</p>
        <p className={`text-xs truncate mt-0.5 ${isDark ? "text-slate-500" : "text-slate-500"}`}>{description}</p>
      </div>
      <span className={`text-xs shrink-0 px-2 py-1 rounded-full ${
        isDark ? "text-slate-500 bg-slate-800" : "text-slate-400 bg-slate-100"
      }`}>{time}</span>
    </div>
  );
}

export default function AdminDashboard() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [greeting, setGreeting] = useState(getGreeting());

  useEffect(() => {
    const interval = setInterval(() => {
      setGreeting(getGreeting());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const { data: activeStudents, isLoading: loadingStudents } = useQuery({
    queryKey: ["admin", "dashboard", "students-active"],
    queryFn: () => listStudents({ status: "ACTIVE", page: 1, page_size: 1 }),
  });

  const { data: activeTeachers, isLoading: loadingTeachers } = useQuery({
    queryKey: ["admin", "dashboard", "teachers-active"],
    queryFn: () => listTeachers({ status: "ACTIVE", page: 1, page_size: 1 }),
  });

  const { data: submittedAdmissions } = useQuery({
    queryKey: ["admin", "dashboard", "admissions-submitted"],
    queryFn: () => listAdmissions({ status: "SUBMITTED", page: 1, page_size: 1 }),
  });

  const { data: underReviewAdmissions } = useQuery({
    queryKey: ["admin", "dashboard", "admissions-under-review"],
    queryFn: () => listAdmissions({ status: "UNDER_REVIEW", page: 1, page_size: 1 }),
  });

  const attendanceTrendQuery = useQuery({
    queryKey: ["admin", "attendance-trend"],
    queryFn: () => fetchAttendanceTrend(14),
  });

  const feeCollectionQuery = useQuery({
    queryKey: ["admin", "fee-collection"],
    queryFn: () => fetchFeeCollection(6),
  });

  const pendingFeesQuery = useQuery({
    queryKey: ["admin", "pending-fees"],
    queryFn: fetchPendingFees,
  });

  const leaveStatsQuery = useQuery({
    queryKey: ["admin", "leave-stats"],
    queryFn: fetchLeaveStats,
  });

  const pendingAdmissions =
    submittedAdmissions !== undefined && underReviewAdmissions !== undefined
      ? submittedAdmissions.total + underReviewAdmissions.total
      : 0;

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Welcome Banner with Sparkles */}
      <div className={`relative overflow-hidden rounded-3xl p-8 ${
        isDark
          ? "bg-gradient-to-r from-indigo-900 via-blue-800 to-violet-900"
          : "bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-600"
      }`}>
        <AnimatedSparkles />

        <div className="relative z-10 flex items-center justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-yellow-300 animate-pulse" />
              <p className="text-blue-100 text-sm font-medium tracking-wide uppercase">
                {greeting}
              </p>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Welcome to School ERP
            </h1>
            <p className="text-blue-100/80 text-sm max-w-md">
              Manage your school efficiently with real-time insights and quick actions.
              Here's what's happening today.
            </p>
            <div className={`inline-flex items-center gap-2 mt-2 px-4 py-2.5 rounded-full text-sm font-medium backdrop-blur-sm ${
              isDark ? "bg-white/10 text-white border border-white/10" : "bg-white/20 text-white border border-white/20"
            }`}>
              <CalendarDays size={16} />
              {today}
            </div>
          </div>

          {/* School Illustration */}
          <div className="hidden lg:block">
            <SchoolIllustration />
          </div>
        </div>

        {/* Decorative gradient orbs */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-violet-500/10 rounded-full blur-2xl translate-y-1/2" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Stats and Charts */}
        <div className="col-span-12 xl:col-span-9 space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard
              label="Total Students"
              value={loadingStudents ? "..." : activeStudents?.total ?? 0}
              trend={{ value: "12%", up: true }}
              icon={<Users size={20} />}
              color="text-blue-500"
              bgColor={isDark ? "bg-gradient-to-br from-blue-500/20 to-blue-600/20" : "bg-gradient-to-br from-blue-50 to-blue-100"}
              to="/admin/students"
            />
            <StatCard
              label="Total Teachers"
              value={loadingTeachers ? "..." : activeTeachers?.total ?? 0}
              trend={{ value: "6%", up: true }}
              icon={<GraduationCap size={20} />}
              color="text-emerald-500"
              bgColor={isDark ? "bg-gradient-to-br from-emerald-500/20 to-emerald-600/20" : "bg-gradient-to-br from-emerald-50 to-emerald-100"}
              to="/admin/teachers"
            />
            <StatCard
              label="Pending Admissions"
              value={pendingAdmissions}
              trend={{ value: "3%", up: true }}
              icon={<FileText size={20} />}
              color="text-amber-500"
              bgColor={isDark ? "bg-gradient-to-br from-amber-500/20 to-amber-600/20" : "bg-gradient-to-br from-amber-50 to-amber-100"}
              to="/admin/admissions"
            />
            <StatCard
              label="Pending Fees"
              value={pendingFeesQuery.isLoading ? "..." : `₹${((pendingFeesQuery.data?.total_pending ?? 0) / 1000).toFixed(0)}K`}
              trend={{ value: "8%", up: false }}
              icon={<IndianRupee size={20} />}
              color="text-rose-500"
              bgColor={isDark ? "bg-gradient-to-br from-rose-500/20 to-rose-600/20" : "bg-gradient-to-br from-rose-50 to-rose-100"}
              to="/admin/fees"
            />
            <StatCard
              label="Leave Requests"
              value={leaveStatsQuery.isLoading ? "..." : leaveStatsQuery.data?.pending ?? 0}
              trend={{ value: "2%", up: true }}
              icon={<Calendar size={20} />}
              color="text-violet-500"
              bgColor={isDark ? "bg-gradient-to-br from-violet-500/20 to-violet-600/20" : "bg-gradient-to-br from-violet-50 to-violet-100"}
              to="/admin/leave"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Attendance Chart */}
            <div className={`rounded-2xl p-6 transition-all duration-300 hover:shadow-lg ${
              isDark
                ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50"
                : "bg-white/70 backdrop-blur-xl border border-white/50"
            }`}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className={`font-semibold text-lg ${isDark ? "text-white" : "text-slate-800"}`}>
                    Attendance Overview
                  </h3>
                  <p className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                    Last 14 days trend
                  </p>
                </div>
                <Link
                  to="/admin/attendance"
                  className="text-xs font-medium text-blue-500 hover:text-blue-600 flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                >
                  View Details <ArrowRight size={14} />
                </Link>
              </div>
              {attendanceTrendQuery.isLoading ? (
                <div className="flex h-[200px] items-center justify-center"><Spinner /></div>
              ) : attendanceTrendQuery.data && attendanceTrendQuery.data.length > 0 ? (
                <AttendanceLineChart data={attendanceTrendQuery.data} height={200} />
              ) : (
                <div className={`h-[200px] flex items-center justify-center text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  No data available
                </div>
              )}
            </div>

            {/* Fee Collection Chart */}
            <div className={`rounded-2xl p-6 transition-all duration-300 hover:shadow-lg ${
              isDark
                ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50"
                : "bg-white/70 backdrop-blur-xl border border-white/50"
            }`}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className={`font-semibold text-lg ${isDark ? "text-white" : "text-slate-800"}`}>
                    Fee Collection
                  </h3>
                  <p className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                    Last 6 months
                  </p>
                </div>
                <Link
                  to="/admin/fees"
                  className="text-xs font-medium text-emerald-500 hover:text-emerald-600 flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                >
                  View Details <ArrowRight size={14} />
                </Link>
              </div>
              {feeCollectionQuery.isLoading ? (
                <div className="flex h-[200px] items-center justify-center"><Spinner /></div>
              ) : feeCollectionQuery.data && feeCollectionQuery.data.length > 0 ? (
                <FeeCollectionBarChart data={feeCollectionQuery.data} height={200} />
              ) : (
                <div className={`h-[200px] flex items-center justify-center text-sm ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                  No data available
                </div>
              )}
              {/* Summary Stats */}
              {pendingFeesQuery.data && (
                <div className={`flex gap-6 mt-5 pt-5 border-t ${isDark ? "border-slate-700/50" : "border-slate-100"}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30" />
                    <div>
                      <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>Collected</p>
                      <p className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-800"}`}>
                        ₹{((pendingFeesQuery.data.total_paid ?? 0) / 1000).toFixed(1)}K
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-rose-500 shadow-lg shadow-rose-500/30" />
                    <div>
                      <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>Pending</p>
                      <p className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-800"}`}>
                        ₹{((pendingFeesQuery.data.total_pending ?? 0) / 1000).toFixed(1)}K
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Academic Calendar", desc: "View events", icon: <CalendarDays size={20} className="text-blue-500" />, to: "/admin/calendar", bg: isDark ? "bg-blue-500/10" : "bg-blue-50" },
              { label: "Timetable", desc: "Class schedule", icon: <Clock size={20} className="text-violet-500" />, to: "/admin/timetable", bg: isDark ? "bg-violet-500/10" : "bg-violet-50" },
              { label: "Circulars", desc: "Announcements", icon: <Bell size={20} className="text-amber-500" />, to: "/admin/notifications", bg: isDark ? "bg-amber-500/10" : "bg-amber-50" },
              { label: "Reports", desc: "Performance", icon: <FileBarChart size={20} className="text-emerald-500" />, to: "/admin/report-cards", bg: isDark ? "bg-emerald-500/10" : "bg-emerald-50" },
            ].map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className={`flex items-center gap-3 p-4 rounded-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group ${
                  isDark
                    ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50 hover:border-slate-600/50"
                    : "bg-white/70 backdrop-blur-xl border border-white/50 hover:bg-white/90"
                }`}
              >
                <div className={`p-2.5 rounded-xl transition-transform duration-200 group-hover:scale-110 ${item.bg}`}>{item.icon}</div>
                <div>
                  <p className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-800"}`}>{item.label}</p>
                  <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="col-span-12 xl:col-span-3 space-y-6">
          {/* Quick Actions */}
          <div className={`rounded-2xl p-5 ${
            isDark
              ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50"
              : "bg-white/70 backdrop-blur-xl border border-white/50"
          }`}>
            <h3 className={`font-semibold mb-4 flex items-center gap-2 ${isDark ? "text-white" : "text-slate-800"}`}>
              <span className="p-1.5 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500">
                <Sparkles size={14} className="text-white" />
              </span>
              Quick Actions
            </h3>
            <div className="space-y-1">
              <QuickAction
                label="Add New Student"
                icon={<UserPlus size={18} className="text-white" />}
                to="/admin/students/new"
                color="bg-gradient-to-br from-blue-500 to-blue-600"
              />
              <QuickAction
                label="Add Teacher"
                icon={<GraduationCap size={18} className="text-white" />}
                to="/admin/teachers/new"
                color="bg-gradient-to-br from-emerald-500 to-emerald-600"
              />
              <QuickAction
                label="Record Attendance"
                icon={<ClipboardList size={18} className="text-white" />}
                to="/admin/attendance"
                color="bg-gradient-to-br from-violet-500 to-violet-600"
              />
              <QuickAction
                label="Collect Fees"
                icon={<Wallet size={18} className="text-white" />}
                to="/admin/fees"
                color="bg-gradient-to-br from-amber-500 to-amber-600"
              />
              <QuickAction
                label="Create Report"
                icon={<FileBarChart size={18} className="text-white" />}
                to="/admin/report-cards"
                color="bg-gradient-to-br from-rose-500 to-rose-600"
              />
            </div>
          </div>

          {/* Recent Activity */}
          <div className={`rounded-2xl p-5 ${
            isDark
              ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-xl border border-slate-700/50"
              : "bg-white/70 backdrop-blur-xl border border-white/50"
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-semibold flex items-center gap-2 ${isDark ? "text-white" : "text-slate-800"}`}>
                <Clock size={18} className="text-slate-400" /> Recent Activity
              </h3>
              <Link
                to="/admin/notifications"
                className="text-xs font-medium text-blue-500 hover:text-blue-600 flex items-center gap-1"
              >
                View All <ArrowRight size={12} />
              </Link>
            </div>
            <div className={`divide-y ${isDark ? "divide-slate-700/50" : "divide-slate-100"}`}>
              <ActivityItem
                title="New Admission"
                description="Priya Sharma admitted to Grade 6"
                time="2h ago"
                icon={<UserPlus size={14} className="text-white" />}
                color="bg-gradient-to-br from-blue-500 to-blue-600"
              />
              <ActivityItem
                title="Leave Request"
                description="Teacher Mrs. S. Priya applied for leave"
                time="4h ago"
                icon={<Calendar size={14} className="text-white" />}
                color="bg-gradient-to-br from-amber-500 to-amber-600"
              />
              <ActivityItem
                title="Fee Payment"
                description="Rahul Verma paid ₹5,000"
                time="5h ago"
                icon={<IndianRupee size={14} className="text-white" />}
                color="bg-gradient-to-br from-emerald-500 to-emerald-600"
              />
              <ActivityItem
                title="Attendance Updated"
                description="Class 8 - A (28 students marked)"
                time="6h ago"
                icon={<ClipboardList size={14} className="text-white" />}
                color="bg-gradient-to-br from-violet-500 to-violet-600"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
