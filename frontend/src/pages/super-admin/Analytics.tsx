import { useQuery } from "@tanstack/react-query";
import { Button, Card, Spinner } from "../../components/ui";
import { useLanguage } from "../../i18n/LanguageContext";
import { fetchPlatformStats, fetchUsersByRole, listSchools, exportDataToCsv } from "./api";

const UsersIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const GlobeIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const LightBulbIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);

interface MetricCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon: React.ReactNode;
  gradient: string;
  delay: string;
  trend?: { value: string; up: boolean };
}

function MetricCard({ title, value, subtitle, icon, gradient, delay, trend }: MetricCardProps) {
  return (
    <div className="animate-fade-in-up" style={{ animationDelay: delay }}>
      <div className={`relative overflow-hidden rounded-2xl p-6 ${gradient} group transition-all duration-300 hover:scale-[1.02] hover:shadow-xl`}>
        <div className="absolute top-0 end-0 w-32 h-32 transform translate-x-8 rtl:-translate-x-8 -translate-y-8">
          <div className="w-full h-full rounded-full bg-white/10 animate-pulse-soft" />
        </div>
        <div className="absolute bottom-0 start-0 w-24 h-24 transform -translate-x-6 rtl:translate-x-6 translate-y-6">
          <div className="w-full h-full rounded-full bg-white/5" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-sm">
              <div className="text-white">{icon}</div>
            </div>
            {trend && (
              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                trend.up ? 'bg-green-400/20 text-green-100' : 'bg-red-400/20 text-red-100'
              }`}>
                {trend.up ? '↑' : '↓'} {trend.value}
              </div>
            )}
          </div>
          <p className="text-white/80 text-sm font-medium mb-1">{title}</p>
          <p className="text-white text-4xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="text-white/60 text-sm mt-2">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

function AnimatedProgressBar({ label, value, max, color, delay }: { label: string; value: number; max: number; color: string; delay: string }) {
  const { fmtNumber } = useLanguage();
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="animate-fade-in-up group" style={{ animationDelay: delay }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-ink-2">{label}</span>
        <span className="text-sm font-bold text-ink dark:text-white">{fmtNumber(value)}</span>
      </div>
      <div className="h-3 bg-surface-3 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-out ${color} relative overflow-hidden`}
          style={{ width: `${Math.max(5, percentage)}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </div>
      </div>
    </div>
  );
}

export default function Analytics() {
  const { t, te, fmtNumber } = useLanguage();
  const roleLabel = (role: string) => {
    const label = te("role", role);
    return label === role ? role.replace("_", " ") : label;
  };
  const statsQuery = useQuery({
    queryKey: ["super-admin", "stats"],
    queryFn: fetchPlatformStats,
  });

  const usersQuery = useQuery({
    queryKey: ["super-admin", "users-by-role"],
    queryFn: fetchUsersByRole,
  });

  const schoolsQuery = useQuery({
    queryKey: ["super-admin", "schools-all"],
    queryFn: () => listSchools({ page: 1, page_size: 100 }),
  });

  const totalStudents = usersQuery.data?.find(u => u.role === "STUDENT")?.count ?? 0;
  const totalTeachers = usersQuery.data?.find(u => u.role === "TEACHER")?.count ?? 0;
  const totalParents = usersQuery.data?.find(u => u.role === "PARENT")?.count ?? 0;
  const totalAdmins = usersQuery.data?.find(u => u.role === "SCHOOL_ADMIN")?.count ?? 0;
  const maxUserCount = Math.max(...(usersQuery.data?.map(u => u.count) ?? [1]));

  const schoolsByState = schoolsQuery.data?.items.reduce((acc, school) => {
    const state = school.state || "Unknown";
    acc[state] = (acc[state] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) ?? {};

  return (
    <div className="animate-fade-in-up">
      {/* Hero Section */}
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-[#3B82F6] to-[#60A5FA] p-8">
        <div className="absolute inset-0 bg-grid-pattern opacity-10" />
        <div className="absolute top-0 end-0 w-96 h-96 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 rtl:-translate-x-1/2 -translate-y-1/2 animate-pulse-soft" />
        <div className="absolute bottom-0 start-0 w-64 h-64 bg-[#818CF8]/30 rounded-full blur-3xl transform -translate-x-1/2 rtl:translate-x-1/2 translate-y-1/2 animate-pulse-soft" style={{ animationDelay: '1s' }} />

        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm animate-bounce-in">
                <SparklesIcon />
              </div>
              <span className="text-white/80 text-sm font-medium px-3 py-1 bg-white/10 rounded-full backdrop-blur-sm">
                {t("superAdmin.analytics.aiInsights")}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">{t("superAdmin.analytics.title")}</h1>
            <p className="text-white/70 max-w-lg">
              {t("superAdmin.analytics.subtitle")}
            </p>
          </div>
          <Button
            variant="secondary"
            className="!bg-white/20 !text-white !border-white/30 hover:!bg-white/30 backdrop-blur-sm"
            onClick={() => {
              const exportData = [
                { metric: "Total Schools", value: statsQuery.data?.total_schools ?? 0 },
                { metric: "Active Schools", value: statsQuery.data?.active_schools ?? 0 },
                { metric: "Total Users", value: statsQuery.data?.total_users ?? 0 },
                { metric: "Total Students", value: totalStudents },
                { metric: "Total Teachers", value: totalTeachers },
                { metric: "Total Parents", value: totalParents },
              ];
              exportDataToCsv(exportData, "platform-analytics.csv");
            }}
          >
            <svg className="w-4 h-4 me-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {t("superAdmin.analytics.exportReport")}
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title={t("superAdmin.analytics.totalSchools")}
          value={statsQuery.isLoading ? <Spinner className="!text-white" /> : statsQuery.data?.total_schools ?? 0}
          subtitle={t("superAdmin.analytics.activeCount", { n: fmtNumber(statsQuery.data?.active_schools ?? 0) })}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            </svg>
          }
          gradient="bg-gradient-to-br from-accent to-[#4C1D95]"
          delay="0.1s"
          trend={{ value: "+12%", up: true }}
        />
        <MetricCard
          title={t("superAdmin.analytics.totalUsers")}
          value={statsQuery.isLoading ? <Spinner className="!text-white" /> : statsQuery.data?.total_users ?? 0}
          subtitle={t("superAdmin.analytics.activeCount", { n: fmtNumber(statsQuery.data?.active_users ?? 0) })}
          icon={<UsersIcon />}
          gradient="bg-gradient-to-br from-blue-600 to-[#1D4ED8]"
          delay="0.15s"
          trend={{ value: "+24%", up: true }}
        />
        <MetricCard
          title={t("superAdmin.analytics.students")}
          value={usersQuery.isLoading ? <Spinner className="!text-white" /> : fmtNumber(totalStudents)}
          subtitle={t("superAdmin.analytics.acrossSchools")}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
          gradient="bg-gradient-to-br from-emerald-600 to-[#047857]"
          delay="0.2s"
        />
        <MetricCard
          title={t("superAdmin.analytics.teachers")}
          value={usersQuery.isLoading ? <Spinner className="!text-white" /> : fmtNumber(totalTeachers)}
          subtitle={t("superAdmin.analytics.acrossSchools")}
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          }
          gradient="bg-gradient-to-br from-[#F59E0B] to-[#D97706]"
          delay="0.25s"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* User Distribution */}
        <div className="animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
          <Card className="!p-0 overflow-hidden">
            <div className="p-5 border-b border-line bg-gradient-to-r from-surface-2 to-white dark:from-surface-2 dark:to-surface">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent/10 dark:bg-accent/20 rounded-xl text-accent-fg">
                    <UsersIcon />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-ink dark:text-white">{t("superAdmin.analytics.userDistribution")}</h3>
                    <p className="text-xs text-ink-3">{t("superAdmin.analytics.byRole")}</p>
                  </div>
                </div>
                {usersQuery.data && (
                  <Button variant="secondary" onClick={() => exportDataToCsv(usersQuery.data!, "users-distribution.csv")}>
                    {t("superAdmin.analytics.export")}
                  </Button>
                )}
              </div>
            </div>
            <div className="p-6">
              {usersQuery.isLoading ? (
                <div className="flex h-60 items-center justify-center"><Spinner /></div>
              ) : usersQuery.data && usersQuery.data.length > 0 ? (
                <div className="space-y-5">
                  {usersQuery.data.map((item, idx) => {
                    const colors = [
                      "bg-gradient-to-r from-accent to-accent-2",
                      "bg-gradient-to-r from-emerald-600 to-emerald-500",
                      "bg-gradient-to-r from-blue-600 to-blue-500",
                      "bg-gradient-to-r from-[#F59E0B] to-[#FBBF24]",
                      "bg-gradient-to-r from-pink-500 to-pink-400",
                      "bg-gradient-to-r from-[#7C3AED] to-[#A78BFA]",
                    ];
                    return (
                      <AnimatedProgressBar
                        key={item.role}
                        label={roleLabel(item.role)}
                        value={item.count}
                        max={maxUserCount}
                        color={colors[idx % colors.length]}
                        delay={`${0.35 + idx * 0.05}s`}
                      />
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-ink-3 text-center py-8">{t("superAdmin.analytics.noUserData")}</p>
              )}
            </div>
          </Card>
        </div>

        {/* Schools by Region */}
        <div className="animate-fade-in-up" style={{ animationDelay: "0.35s" }}>
          <Card className="!p-0 overflow-hidden">
            <div className="p-5 border-b border-line bg-gradient-to-r from-surface-2 to-white dark:from-surface-2 dark:to-surface">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl text-emerald-600">
                    <GlobeIcon />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-ink dark:text-white">{t("superAdmin.analytics.schoolsByRegion")}</h3>
                    <p className="text-xs text-ink-3">{t("superAdmin.analytics.geoDistribution")}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-5">
              {schoolsQuery.isLoading ? (
                <div className="flex h-60 items-center justify-center"><Spinner /></div>
              ) : Object.keys(schoolsByState).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(schoolsByState)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([state, count], idx) => (
                      <div
                        key={state}
                        className="animate-slide-in-right group flex items-center justify-between p-4 bg-gradient-to-r from-surface-2 to-white dark:from-surface-2 dark:to-surface rounded-xl border border-line hover:border-[#059669]/50 transition-all duration-300 hover:shadow-lg hover:shadow-[#059669]/10"
                        style={{ animationDelay: `${0.1 * idx}s` }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-500 flex items-center justify-center text-white">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <span className="font-medium text-ink dark:text-white">{state === "Unknown" ? t("superAdmin.analytics.unknown") : state}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-emerald-600">{count}</span>
                          <span className="text-sm text-ink-3">{count === 1 ? t("superAdmin.analytics.school") : t("superAdmin.analytics.schools")}</span>
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-ink-3 text-center py-8">{t("superAdmin.analytics.noSchoolData")}</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Platform Insights */}
      <div className="animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
        <Card className="!p-0 overflow-hidden">
          <div className="p-5 border-b border-line bg-gradient-to-r from-surface-2 to-white dark:from-surface-2 dark:to-surface">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 dark:bg-amber-500/20 rounded-xl text-amber-500">
                <LightBulbIcon />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-ink dark:text-white">{t("superAdmin.analytics.platformInsights")}</h3>
                <p className="text-xs text-ink-3">{t("superAdmin.analytics.kpis")}</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="animate-scale-in group relative p-6 bg-gradient-to-br from-surface-2 to-white dark:from-surface-2 dark:to-surface rounded-2xl border border-line hover:border-accent/50 transition-all duration-300 hover:shadow-lg overflow-hidden" style={{ animationDelay: "0.45s" }}>
                <div className="absolute top-0 end-0 w-20 h-20 bg-gradient-to-br from-accent/10 to-transparent rounded-full transform translate-x-6 rtl:-translate-x-6 -translate-y-6" />
                <div className="relative">
                  <p className="text-sm text-ink-3 mb-2">{t("superAdmin.analytics.avgUsers")}</p>
                  <p className="text-3xl font-bold bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">
                    {statsQuery.data?.total_schools
                      ? Math.round((statsQuery.data.total_users ?? 0) / statsQuery.data.total_schools)
                      : 0}
                  </p>
                </div>
              </div>

              <div className="animate-scale-in group relative p-6 bg-gradient-to-br from-surface-2 to-white dark:from-surface-2 dark:to-surface rounded-2xl border border-line hover:border-[#059669]/50 transition-all duration-300 hover:shadow-lg overflow-hidden" style={{ animationDelay: "0.5s" }}>
                <div className="absolute top-0 end-0 w-20 h-20 bg-gradient-to-br from-[#059669]/10 to-transparent rounded-full transform translate-x-6 rtl:-translate-x-6 -translate-y-6" />
                <div className="relative">
                  <p className="text-sm text-ink-3 mb-2">{t("superAdmin.analytics.ratio")}</p>
                  <p className="text-3xl font-bold text-emerald-600">
                    {totalTeachers > 0 ? `${Math.round(totalStudents / totalTeachers)}:1` : t("superAdmin.analytics.na")}
                  </p>
                </div>
              </div>

              <div className="animate-scale-in group relative p-6 bg-gradient-to-br from-surface-2 to-white dark:from-surface-2 dark:to-surface rounded-2xl border border-line hover:border-[#2563EB]/50 transition-all duration-300 hover:shadow-lg overflow-hidden" style={{ animationDelay: "0.55s" }}>
                <div className="absolute top-0 end-0 w-20 h-20 bg-gradient-to-br from-[#2563EB]/10 to-transparent rounded-full transform translate-x-6 rtl:-translate-x-6 -translate-y-6" />
                <div className="relative">
                  <p className="text-sm text-ink-3 mb-2">{t("superAdmin.analytics.schoolAdmins")}</p>
                  <p className="text-3xl font-bold text-blue-600">{totalAdmins}</p>
                </div>
              </div>

              <div className="animate-scale-in group relative p-6 bg-gradient-to-br from-surface-2 to-white dark:from-surface-2 dark:to-surface rounded-2xl border border-line hover:border-[#DC2626]/50 transition-all duration-300 hover:shadow-lg overflow-hidden" style={{ animationDelay: "0.6s" }}>
                <div className="absolute top-0 end-0 w-20 h-20 bg-gradient-to-br from-[#DC2626]/10 to-transparent rounded-full transform translate-x-6 rtl:-translate-x-6 -translate-y-6" />
                <div className="relative">
                  <p className="text-sm text-ink-3 mb-2">{t("superAdmin.analytics.inactiveSchools")}</p>
                  <p className="text-3xl font-bold text-red-600">
                    {statsQuery.data?.inactive_schools ?? 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
