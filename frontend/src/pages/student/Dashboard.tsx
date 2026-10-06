import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Badge, Spinner } from "../../components/ui";
import { useTheme } from "../../theme/ThemeContext";
import { useLanguage } from "../../i18n/LanguageContext";
import { fetchAttendanceSummary, fetchExams, fetchInvoices, fetchPendingHomework } from "./api";
import { useMyProfile } from "./hooks";
import { Sparkles, BookOpen, Calendar, Trophy, Star } from "lucide-react";

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export default function StudentDashboard() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { data: profile } = useMyProfile();
  const { t } = useLanguage();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("dashboard.goodMorning") : hour < 17 ? t("dashboard.goodAfternoon") : t("dashboard.goodEvening");

  const today = new Date();
  const monthStart = toISODate(new Date(today.getFullYear(), today.getMonth(), 1));
  const todayIso = toISODate(today);
  const tomorrowIso = toISODate(new Date(today.getTime() + 86_400_000));

  const attendanceQuery = useQuery({
    queryKey: ["student", "attendance-summary", "dashboard", monthStart, todayIso],
    queryFn: () => fetchAttendanceSummary(monthStart, todayIso),
  });

  const homeworkQuery = useQuery({
    queryKey: ["student", "homework-pending", "dashboard"],
    queryFn: fetchPendingHomework,
  });

  const examsQuery = useQuery({
    queryKey: ["student", "exams", "dashboard"],
    queryFn: () => fetchExams(),
  });

  const invoicesQuery = useQuery({
    queryKey: ["student", "invoices", "dashboard"],
    queryFn: () => fetchInvoices(),
  });

  const attendancePct = attendanceQuery.data?.[0]?.percentage_present;
  const pendingHomework = homeworkQuery.data ?? [];
  const dueTomorrow = pendingHomework.filter((hw) => hw.due_date === tomorrowIso);

  const upcomingExam = (examsQuery.data?.items ?? [])
    .filter((e) => e.start_date >= todayIso)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];

  const outstanding = (invoicesQuery.data?.items ?? []).reduce((sum, inv) => sum + inv.outstanding_amount, 0);

  const dateStr = today.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="animate-fade-in-up">
      {/* Welcome Banner with Eye-Following Emoji */}
      <div className={`relative overflow-hidden rounded-3xl p-8 mb-6 ${
        isDark
          ? "bg-gradient-to-r from-purple-900 via-pink-800 to-violet-900"
          : "bg-gradient-to-r from-purple-500 via-pink-500 to-violet-500"
      }`}>
        {/* Floating decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-float"
              style={{
                left: `${10 + i * 12}%`,
                top: `${20 + (i % 3) * 25}%`,
                animationDelay: `${i * 0.3}s`,
                animationDuration: `${3 + (i % 2)}s`,
              }}
            >
              <Star size={12 + (i % 3) * 6} className="text-white/20" fill="currentColor" />
            </div>
          ))}
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles size={20} className="text-yellow-300 animate-pulse" />
              <p className="text-purple-100 text-sm font-medium tracking-wide uppercase">
                {greeting}
              </p>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              {profile ? `Hey, ${profile.first_name}!` : "Welcome Back!"}
            </h1>
            <p className="text-purple-100/80 text-sm max-w-md">
              Ready to learn something amazing today? Your journey to success continues here.
            </p>
            <div className={`inline-flex items-center gap-2 mt-2 px-4 py-2.5 rounded-full text-sm font-medium backdrop-blur-sm bg-white/10 text-white border border-white/10`}>
              <Calendar size={16} />
              {dateStr}
            </div>
          </div>

        </div>

        {/* Decorative gradient orbs */}
        <div className="absolute top-0 right-1/4 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2" />
        <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-pink-500/10 rounded-full blur-2xl translate-y-1/2" />
      </div>

      {/* Stats Grid */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Attendance",
            value: attendanceQuery.isLoading ? "..." : attendancePct !== undefined ? `${attendancePct.toFixed(0)}%` : "—",
            hint: attendanceQuery.data?.[0] ? `${attendanceQuery.data[0].total_days} school days` : undefined,
            icon: <Trophy size={20} />,
            color: "from-emerald-500 to-teal-500",
            bgColor: isDark ? "bg-emerald-500/10" : "bg-emerald-50",
          },
          {
            label: "Pending Homework",
            value: homeworkQuery.isLoading ? "..." : pendingHomework.length,
            hint: dueTomorrow.length > 0 ? `${dueTomorrow.length} due tomorrow` : "All caught up",
            icon: <BookOpen size={20} />,
            color: "from-amber-500 to-orange-500",
            bgColor: isDark ? "bg-amber-500/10" : "bg-amber-50",
          },
          {
            label: "Next Exam",
            value: examsQuery.isLoading ? "..." : upcomingExam ? upcomingExam.name.slice(0, 12) : "—",
            hint: upcomingExam ? `In ${daysUntil(upcomingExam.start_date)} days` : "None scheduled",
            icon: <Calendar size={20} />,
            color: "from-blue-500 to-indigo-500",
            bgColor: isDark ? "bg-blue-500/10" : "bg-blue-50",
          },
          {
            label: "Fees Due",
            value: invoicesQuery.isLoading ? "..." : `₹${(outstanding / 1000).toFixed(0)}K`,
            hint: outstanding > 0 ? "Payment pending" : "All clear",
            icon: <Star size={20} />,
            color: "from-rose-500 to-pink-500",
            bgColor: isDark ? "bg-rose-500/10" : "bg-rose-50",
          },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={`animate-fade-in-up rounded-2xl p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
              isDark
                ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50"
                : "bg-white border border-slate-200 shadow-sm"
            }`}
            style={{ animationDelay: `${0.1 + i * 0.05}s` }}
          >
            <div className={`inline-flex p-3 rounded-xl mb-3 ${stat.bgColor}`}>
              <div className={`bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                {stat.icon}
              </div>
            </div>
            <p className={`text-sm font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>{stat.label}</p>
            <p className={`text-2xl font-bold mt-1 ${isDark ? "text-white" : "text-slate-800"}`}>{stat.value}</p>
            <p className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>{stat.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Homework Card */}
        <div className="animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <div className={`rounded-2xl p-6 ${
            isDark
              ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50"
              : "bg-white border border-slate-200 shadow-sm"
          }`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className={`font-semibold flex items-center gap-2 ${isDark ? "text-white" : "text-slate-800"}`}>
                <BookOpen size={18} className="text-amber-500" />
                What's Due Soon
              </h2>
              <Link to="/student/homework" className="text-xs font-medium text-purple-500 hover:text-purple-600 transition-colors">
                View all
              </Link>
            </div>
            {homeworkQuery.isLoading ? (
              <Spinner />
            ) : pendingHomework.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Trophy size={40} className={isDark ? "text-slate-600 mb-3" : "text-slate-300 mb-3"} />
                <p className={isDark ? "text-slate-400" : "text-slate-500"}>No pending homework. Great job!</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {pendingHomework
                  .slice()
                  .sort((a, b) => a.due_date.localeCompare(b.due_date))
                  .slice(0, 5)
                  .map((hw, idx) => (
                    <li
                      key={hw.id}
                      className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm transition-all duration-200 animate-slide-in-right ${
                        isDark
                          ? "bg-slate-700/30 hover:bg-slate-700/50"
                          : "bg-slate-50 hover:bg-slate-100"
                      }`}
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <span className={isDark ? "text-white" : "text-slate-700"}>{hw.title}</span>
                      <Badge tone={hw.due_date < todayIso ? "red" : hw.due_date === todayIso || hw.due_date === tomorrowIso ? "yellow" : "gray"}>
                        {formatDate(hw.due_date)}
                      </Badge>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>

        {/* Exams Card */}
        <div className="animate-fade-in-up" style={{ animationDelay: "0.35s" }}>
          <div className={`rounded-2xl p-6 ${
            isDark
              ? "bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50"
              : "bg-white border border-slate-200 shadow-sm"
          }`}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className={`font-semibold flex items-center gap-2 ${isDark ? "text-white" : "text-slate-800"}`}>
                <Calendar size={18} className="text-blue-500" />
                Upcoming Exams
              </h2>
              <Link to="/student/exams" className="text-xs font-medium text-purple-500 hover:text-purple-600 transition-colors">
                View all
              </Link>
            </div>
            {examsQuery.isLoading ? (
              <Spinner />
            ) : (examsQuery.data?.items ?? []).filter((e) => e.start_date >= todayIso).length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Calendar size={40} className={isDark ? "text-slate-600 mb-3" : "text-slate-300 mb-3"} />
                <p className={isDark ? "text-slate-400" : "text-slate-500"}>No upcoming exams scheduled.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {(examsQuery.data?.items ?? [])
                  .filter((e) => e.start_date >= todayIso)
                  .sort((a, b) => a.start_date.localeCompare(b.start_date))
                  .slice(0, 5)
                  .map((exam, idx) => (
                    <li
                      key={exam.id}
                      className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm transition-all duration-200 animate-slide-in-right ${
                        isDark
                          ? "bg-slate-700/30 hover:bg-slate-700/50"
                          : "bg-slate-50 hover:bg-slate-100"
                      }`}
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <span className={isDark ? "text-white" : "text-slate-700"}>
                        {exam.name}
                        {exam.term ? ` · ${exam.term}` : ""}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600"
                      }`}>
                        {formatDate(exam.start_date)}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
