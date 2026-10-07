import { Link } from "react-router-dom";
import { Badge, Button, Card, Spinner } from "../../components/ui";
import { useMyTimetable, useOwnTeacherId, useSections, useSubjects } from "./hooks";
import { useLanguage } from "../../i18n/LanguageContext";

const WEEKDAY_KEYS = ["days.monday", "days.tuesday", "days.wednesday", "days.thursday", "days.friday", "days.saturday", "days.sunday"];

function todayBackendWeekday(): number {
  const jsDay = new Date().getDay();
  return (jsDay + 6) % 7;
}

const CalendarIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const ClockIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const BookIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ClipboardIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const PencilIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  gradient: string;
  delay: string;
}

function StatCard({ label, value, icon, gradient, delay }: StatCardProps) {
  return (
    <div className="animate-fade-in-up" style={{ animationDelay: delay }}>
      <div className={`relative overflow-hidden rounded-2xl p-5 ${gradient} group transition-all duration-300 hover:scale-[1.02] hover:shadow-xl`}>
        <div className="absolute top-0 end-0 w-32 h-32 transform translate-x-8 rtl:-translate-x-8 -translate-y-8">
          <div className="w-full h-full rounded-full bg-white/10 animate-pulse-soft" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <div className="text-white">{icon}</div>
            </div>
          </div>
          <p className="text-white/80 text-sm font-medium mb-1">{label}</p>
          <p className="text-white text-3xl font-bold tracking-tight">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function TeacherDashboard() {
  const teacherId = useOwnTeacherId();
  const { data: slots, isLoading } = useMyTimetable();
  const { data: sections } = useSections();
  const { data: subjects } = useSubjects();
  const { t, te } = useLanguage();

  const todayDow = todayBackendWeekday();
  const todaysClasses = (slots ?? [])
    .filter((s) => s.day_of_week === todayDow)
    .sort((a, b) => a.period_number - b.period_number);

  const totalClasses = slots?.length ?? 0;
  const uniqueSections = new Set(slots?.map(s => s.section_id)).size;
  const uniqueSubjects = new Set(slots?.map(s => s.subject_id)).size;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("dashboard.goodMorning") : hour < 17 ? t("dashboard.goodAfternoon") : t("dashboard.goodEvening");

  return (
    <div className="animate-fade-in-up">
      {/* Hero Section - Teal/Cyan theme */}
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-teal-600 via-[#14B8A6] to-[#2DD4BF] p-8">
        <div className="absolute inset-0 bg-grid-pattern opacity-10" />
        <div className="absolute top-0 end-0 w-96 h-96 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 rtl:-translate-x-1/2 -translate-y-1/2 animate-pulse-soft" />
        <div className="absolute bottom-0 start-0 w-64 h-64 bg-[#06B6D4]/30 rounded-full blur-3xl transform -translate-x-1/2 rtl:translate-x-1/2 translate-y-1/2 animate-pulse-soft" style={{ animationDelay: '1s' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm animate-bounce-in">
              <SparklesIcon />
            </div>
            <span className="text-white/80 text-sm font-medium px-3 py-1 bg-white/10 rounded-full backdrop-blur-sm">
              {t("dashboard.teacherPortal")}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">{t("teacher.dashboard.greeting", { greeting, role: t("roles.teacher") })}</h1>
          <p className="text-white/70 max-w-lg">
            {todaysClasses.length > 0
              ? `${todaysClasses.length} ${t("dashboard.classesScheduledToday")}`
              : t("common.noData")}
          </p>
        </div>
      </div>

      {!teacherId && (
        <Card className="mb-6 border-s-4 border-s-amber-500">
          <p className="text-sm text-ink-3 dark:text-ink-2">
            {t("teacher.dashboard.noProfile")}
          </p>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        <StatCard
          label={t("dashboard.myClasses")}
          value={isLoading ? <Spinner className="!text-white" /> : uniqueSections}
          icon={<UsersIcon />}
          gradient="bg-gradient-to-br from-teal-600 to-[#0F766E]"
          delay="0.1s"
        />
        <StatCard
          label={t("dashboard.todaysClasses")}
          value={isLoading ? <Spinner className="!text-white" /> : todaysClasses.length}
          icon={<CalendarIcon />}
          gradient="bg-gradient-to-br from-[#0891B2] to-[#0E7490]"
          delay="0.15s"
        />
        <StatCard
          label={t("dashboard.weeklyClasses")}
          value={isLoading ? <Spinner className="!text-white" /> : totalClasses}
          icon={<ClockIcon />}
          gradient="bg-gradient-to-br from-[#06B6D4] to-[#0891B2]"
          delay="0.2s"
        />
        <StatCard
          label={t("dashboard.subjects")}
          value={isLoading ? <Spinner className="!text-white" /> : uniqueSubjects}
          icon={<BookIcon />}
          gradient="bg-gradient-to-br from-teal-500 to-teal-600"
          delay="0.25s"
        />
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-ink dark:text-white mb-4">{t("dashboard.quickActions")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Link to="/teacher/attendance" className="animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
            <div className="group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-teal-50 to-white dark:from-[#042F2E] dark:to-surface border border-line hover:border-teal-500 transition-all duration-300 hover:shadow-xl hover:shadow-teal-500/10">
              <div className="absolute top-0 end-0 w-24 h-24 bg-teal-500/10 rounded-full blur-2xl" />
              <div className="relative z-10 flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl text-white">
                  <CheckCircleIcon />
                </div>
                <div>
                  <p className="font-semibold text-teal-600 dark:text-[#2DD4BF] group-hover:text-[#0F766E] dark:group-hover:text-[#5EEAD4] transition-colors">{t("dashboard.takeAttendance")}</p>
                  <p className="text-xs text-ink-2">{t("dashboard.markTodaysAttendance")}</p>
                </div>
              </div>
            </div>
          </Link>
          <Link to="/teacher/homework" className="animate-fade-in-up" style={{ animationDelay: "0.35s" }}>
            <div className="group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-teal-50 to-white dark:from-[#042F2E] dark:to-surface border border-line hover:border-teal-500 transition-all duration-300 hover:shadow-xl hover:shadow-teal-500/10">
              <div className="absolute top-0 end-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl" />
              <div className="relative z-10 flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-[#06B6D4] to-[#0891B2] rounded-xl text-white">
                  <ClipboardIcon />
                </div>
                <div>
                  <p className="font-semibold text-[#0891B2] dark:text-[#22D3EE] group-hover:text-[#0E7490] dark:group-hover:text-[#67E8F9] transition-colors">{t("dashboard.assignHomework")}</p>
                  <p className="text-xs text-ink-2">{t("dashboard.createNewAssignments")}</p>
                </div>
              </div>
            </div>
          </Link>
          <Link to="/teacher/marks" className="animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
            <div className="group relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-teal-50 to-white dark:from-[#042F2E] dark:to-surface border border-line hover:border-teal-500 transition-all duration-300 hover:shadow-xl hover:shadow-teal-500/10">
              <div className="absolute top-0 end-0 w-24 h-24 bg-teal-500/10 rounded-full blur-2xl" />
              <div className="relative z-10 flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-teal-600 to-[#0F766E] rounded-xl text-white">
                  <PencilIcon />
                </div>
                <div>
                  <p className="font-semibold text-[#0F766E] dark:text-[#14B8A6] group-hover:text-[#115E59] dark:group-hover:text-[#2DD4BF] transition-colors">{t("dashboard.enterMarks")}</p>
                  <p className="text-xs text-ink-2">{t("dashboard.recordExamScores")}</p>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Today's Schedule */}
      <div className="animate-fade-in-up" style={{ animationDelay: "0.45s" }}>
        <Card className="!p-0 overflow-hidden">
          <div className="p-5 border-b border-line bg-gradient-to-r from-teal-50 to-white dark:from-[#042F2E] dark:to-surface">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#14B8A6]/10 dark:bg-[#14B8A6]/20 rounded-xl text-teal-600">
                  <CalendarIcon />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-ink dark:text-white">{t("dashboard.todaysSchedule")}</h3>
                  <p className="text-xs text-ink-3">{t(WEEKDAY_KEYS[todayDow])}</p>
                </div>
              </div>
              <Link to="/teacher/timetable">
                <Button variant="secondary">{t("navigation.viewFullTimetable")}</Button>
              </Link>
            </div>
          </div>
          <div className="p-5">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center"><Spinner /></div>
            ) : todaysClasses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-16 h-16 bg-[#F0FDFA] dark:bg-[#042F2E] rounded-full flex items-center justify-center mb-4">
                  <CalendarIcon />
                </div>
                <p className="text-sm text-ink-3 dark:text-ink-2">{t("teacher.dashboard.noClassesToday")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todaysClasses.map((slot, idx) => {
                  const section = sections?.find((s) => s.id === slot.section_id);
                  const subject = subjects?.find((s) => s.id === slot.subject_id);
                  return (
                    <div
                      key={slot.id}
                      className="animate-slide-in-right group flex items-center justify-between p-4 bg-gradient-to-r from-teal-50 to-white dark:from-[#042F2E] dark:to-surface rounded-xl border border-line hover:border-teal-500 transition-all duration-300 hover:shadow-lg hover:shadow-teal-500/10"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-white font-bold">
                          {t("teacher.dashboard.periodShort", { n: slot.period_number })}
                        </div>
                        <div>
                          <p className="font-medium text-ink dark:text-white">
                            {subject ? te("subject", subject.name) : slot.subject_id}
                          </p>
                          <p className="text-sm text-ink-3 dark:text-ink-2">
                            {t("teacher.dashboard.section", { name: section ? te("section", section.name) : slot.section_id })}
                          </p>
                        </div>
                      </div>
                      <div className="text-end">
                        <Badge tone="gray" className="bg-[#F0FDFA] dark:bg-[#042F2E] text-teal-600">
                          <span dir="ltr">{slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}</span>
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
