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
import { Spinner } from "../../components/ui";
import { api } from "../../api/client";
import { timeAgo } from "../../lib/time";
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

  const content = (
    <div className={`relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group glass`}>
      {/* Glass reflection effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

      <div className="flex items-start justify-between relative z-10">
        <div className={`p-3 rounded-xl shadow-lg ${bgColor} transition-transform duration-300 group-hover:scale-110`}>
          <div className={color}>{icon}</div>
        </div>
        <ChevronRight size={18} className={`transition-all duration-300 group-hover:translate-x-1 text-ink-2 group-hover:text-ink-3`} />
      </div>
      <div className="mt-4 relative z-10">
        <p className={`text-sm font-medium text-ink-3`}>{label}</p>
        <p className={`text-3xl font-bold mt-1 text-ink`}>{value}</p>
        {trend && (
          <div className={`flex items-center gap-1.5 mt-2 text-xs font-semibold ${
            trend.up ? "text-emerald-500" : "text-rose-500"
          }`}>
            <span className={`p-0.5 rounded ${trend.up ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
              {trend.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            </span>
            <span>{trend.value}</span>
            <span className={"text-ink-3 font-normal"}>vs last month</span>
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

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 p-3.5 rounded-xl transition-all duration-200 group hover:bg-surface-3 active:bg-surface-3`}
    >
      <div className={`p-2.5 rounded-xl shadow-md transition-transform duration-200 group-hover:scale-105 ${color}`}>
        {icon}
      </div>
      <span className={`flex-1 text-sm font-medium text-ink-2`}>
        {label}
      </span>
      <div className={`p-1 rounded-full transition-all duration-200 group-hover:translate-x-1 bg-surface-3 text-ink-3`}>
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

  return (
    <div className="flex items-start gap-3 py-3.5 group">
      <div className={`p-2 rounded-xl shrink-0 shadow-sm transition-transform duration-200 group-hover:scale-105 ${color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium text-ink`}>{title}</p>
        <p className={`text-xs truncate mt-0.5 text-ink-3`}>{description}</p>
      </div>
      <span className={`text-xs shrink-0 px-2 py-1 rounded-full text-ink-3 bg-surface-3`}>{time}</span>
    </div>
  );
}

interface ActivityEvent {
  type: "admission" | "leave" | "payment" | "attendance";
  title: string;
  description: string;
  time: string;
}

const ACTIVITY_LOOK: Record<string, { Icon: typeof UserPlus; color: string }> = {
  admission: { Icon: UserPlus, color: "bg-gradient-to-br from-blue-500 to-blue-600" },
  leave: { Icon: Calendar, color: "bg-gradient-to-br from-amber-500 to-amber-600" },
  payment: { Icon: IndianRupee, color: "bg-gradient-to-br from-emerald-500 to-emerald-600" },
  attendance: { Icon: ClipboardList, color: "bg-gradient-to-br from-violet-500 to-violet-600" },
};

export default function AdminDashboard() {
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

  const activityQuery = useQuery({
    queryKey: ["admin", "recent-activity"],
    queryFn: async () => (await api.get<ActivityEvent[]>("/analytics/recent-activity", { params: { limit: 8 } })).data,
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
      <div className={`relative overflow-hidden rounded-3xl p-8 lg-hero`}>
        <AnimatedSparkles />

        <div className="relative z-10 flex items-center justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-[#ffd60a] animate-pulse" />
              <p className="text-white/90 text-sm font-medium tracking-wide uppercase">
                {greeting}
              </p>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Welcome to School ERP
            </h1>
            <p className="text-white/80 text-sm max-w-md">
              Manage your school efficiently with real-time insights and quick actions.
              Here's what's happening today.
            </p>
            <div className={`inline-flex items-center gap-2 mt-2 px-4 py-2.5 rounded-full text-sm font-medium backdrop-blur-sm bg-white/20 text-white border border-white/25`}>
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
              bgColor={"bg-gradient-to-br from-blue-500/15 to-blue-600/15"}
              to="/admin/students"
            />
            <StatCard
              label="Total Teachers"
              value={loadingTeachers ? "..." : activeTeachers?.total ?? 0}
              trend={{ value: "6%", up: true }}
              icon={<GraduationCap size={20} />}
              color="text-emerald-500"
              bgColor={"bg-gradient-to-br from-emerald-500/15 to-emerald-600/15"}
              to="/admin/teachers"
            />
            <StatCard
              label="Pending Admissions"
              value={pendingAdmissions}
              trend={{ value: "3%", up: true }}
              icon={<FileText size={20} />}
              color="text-amber-500"
              bgColor={"bg-gradient-to-br from-amber-500/15 to-amber-600/15"}
              to="/admin/admissions"
            />
            <StatCard
              label="Pending Fees"
              value={pendingFeesQuery.isLoading ? "..." : `₹${((pendingFeesQuery.data?.total_pending ?? 0) / 1000).toFixed(0)}K`}
              trend={{ value: "8%", up: false }}
              icon={<IndianRupee size={20} />}
              color="text-rose-500"
              bgColor={"bg-gradient-to-br from-rose-500/15 to-rose-600/15"}
              to="/admin/fees"
            />
            <StatCard
              label="Leave Requests"
              value={leaveStatsQuery.isLoading ? "..." : leaveStatsQuery.data?.pending ?? 0}
              trend={{ value: "2%", up: true }}
              icon={<Calendar size={20} />}
              color="text-accent-fg"
              bgColor={"bg-gradient-to-br from-violet-500/15 to-violet-600/15"}
              to="/admin/leave"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Attendance Chart */}
            <div className={`rounded-2xl p-6 transition-all duration-300 hover:shadow-lg glass`}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className={`font-semibold text-lg text-ink`}>
                    Attendance Overview
                  </h3>
                  <p className={`text-xs mt-1 text-ink-3`}>
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
                <div className={`h-[200px] flex items-center justify-center text-sm text-ink-3`}>
                  No data available
                </div>
              )}
            </div>

            {/* Fee Collection Chart */}
            <div className={`rounded-2xl p-6 transition-all duration-300 hover:shadow-lg glass`}>
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className={`font-semibold text-lg text-ink`}>
                    Fee Collection
                  </h3>
                  <p className={`text-xs mt-1 text-ink-3`}>
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
                <div className={`h-[200px] flex items-center justify-center text-sm text-ink-3`}>
                  No data available
                </div>
              )}
              {/* Summary Stats */}
              {pendingFeesQuery.data && (
                <div className={`flex gap-6 mt-5 pt-5 border-t border-line`}>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30" />
                    <div>
                      <p className={`text-xs text-ink-3`}>Collected</p>
                      <p className={`text-sm font-bold text-ink`}>
                        ₹{((pendingFeesQuery.data.total_paid ?? 0) / 1000).toFixed(1)}K
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-rose-500 shadow-lg shadow-rose-500/30" />
                    <div>
                      <p className={`text-xs text-ink-3`}>Pending</p>
                      <p className={`text-sm font-bold text-ink`}>
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
              { label: "Academic Calendar", desc: "View events", icon: <CalendarDays size={20} className="text-blue-500" />, to: "/admin/calendar", bg: "bg-blue-500/10" },
              { label: "Timetable", desc: "Class schedule", icon: <Clock size={20} className="text-accent-fg" />, to: "/admin/timetable", bg: "bg-violet-500/10" },
              { label: "Circulars", desc: "Announcements", icon: <Bell size={20} className="text-amber-500" />, to: "/admin/notifications", bg: "bg-amber-500/10" },
              { label: "Reports", desc: "Performance", icon: <FileBarChart size={20} className="text-emerald-500" />, to: "/admin/report-cards", bg: "bg-emerald-500/10" },
            ].map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className={`flex items-center gap-3 p-4 rounded-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group glass`}
              >
                <div className={`p-2.5 rounded-xl transition-transform duration-200 group-hover:scale-110 ${item.bg}`}>{item.icon}</div>
                <div>
                  <p className={`text-sm font-medium text-ink`}>{item.label}</p>
                  <p className={`text-xs text-ink-3`}>{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="col-span-12 xl:col-span-3 space-y-6">
          {/* Quick Actions */}
          <div className={`rounded-2xl p-5 glass`}>
            <h3 className={`font-semibold mb-4 flex items-center gap-2 text-ink`}>
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
          <div className={`rounded-2xl p-5 glass`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-semibold flex items-center gap-2 text-ink`}>
                <Clock size={18} className="text-ink-3" /> Recent Activity
              </h3>
              <Link
                to="/admin/notifications"
                className="text-xs font-medium text-blue-500 hover:text-blue-600 flex items-center gap-1"
              >
                View All <ArrowRight size={12} />
              </Link>
            </div>
            <div className="divide-y divide-line">
              {activityQuery.isLoading ? (
                <div className="flex justify-center py-6"><Spinner /></div>
              ) : activityQuery.data && activityQuery.data.length > 0 ? (
                activityQuery.data.slice(0, 5).map((a, i) => {
                  const look = ACTIVITY_LOOK[a.type] ?? ACTIVITY_LOOK.attendance;
                  return (
                    <ActivityItem
                      key={`${a.type}-${a.time}-${i}`}
                      title={a.title}
                      description={a.description}
                      time={timeAgo(a.time)}
                      icon={<look.Icon size={14} className="text-white" />}
                      color={look.color}
                    />
                  );
                })
              ) : (
                <p className="py-6 text-center text-sm text-ink-3">Nothing has happened yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
