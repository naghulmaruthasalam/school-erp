import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Badge, Button, Card, Spinner } from "../../components/ui";
import { fetchPlatformStats, fetchUsersByRole, fetchAuditLogs, listSchools, exportDataToCsv } from "./api";

const SchoolIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
  </svg>
);

const UsersIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const StudentIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

const TeacherIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
  </svg>
);

const ChartIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const ActivityIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const ArrowTrendingUp = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2 12l6-6m0 0l6 6m-6-6v12" transform="rotate(-45 12 12)" />
  </svg>
);

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  gradient: string;
  delay: string;
  trend?: string;
  trendUp?: boolean;
}

function StatCard({ label, value, icon, gradient, delay, trend, trendUp }: StatCardProps) {
  return (
    <div className="animate-fade-in-up" style={{ animationDelay: delay }}>
      <div className={`relative overflow-hidden rounded-2xl p-5 ${gradient} group transition-all duration-300 hover:scale-[1.02] hover:shadow-xl`}>
        <div className="absolute top-0 right-0 w-32 h-32 transform translate-x-8 -translate-y-8">
          <div className="w-full h-full rounded-full bg-white/10 animate-pulse-soft" />
        </div>
        <div className="absolute bottom-0 left-0 w-24 h-24 transform -translate-x-6 translate-y-6">
          <div className="w-full h-full rounded-full bg-white/5" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <div className="text-white">{icon}</div>
            </div>
            {trend && (
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                trendUp ? 'bg-green-400/20 text-green-100' : 'bg-red-400/20 text-red-100'
              }`}>
                <ArrowTrendingUp />
                {trend}
              </div>
            )}
          </div>
          <p className="text-white/80 text-sm font-medium mb-1">{label}</p>
          <p className="text-white text-3xl font-bold tracking-tight">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const statsQuery = useQuery({
    queryKey: ["super-admin", "stats"],
    queryFn: fetchPlatformStats,
  });

  const usersQuery = useQuery({
    queryKey: ["super-admin", "users-by-role"],
    queryFn: fetchUsersByRole,
  });

  const auditQuery = useQuery({
    queryKey: ["super-admin", "audit-logs"],
    queryFn: () => fetchAuditLogs(10),
  });

  const schoolsQuery = useQuery({
    queryKey: ["super-admin", "schools-recent"],
    queryFn: () => listSchools({ page: 1, page_size: 5 }),
  });

  const totalStudents = usersQuery.data?.find(u => u.role === "STUDENT")?.count ?? 0;
  const totalTeachers = usersQuery.data?.find(u => u.role === "TEACHER")?.count ?? 0;

  return (
    <div className="animate-fade-in-up">
      {/* Hero Section */}
      <div className="relative mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-accent via-[#7C3AED] to-accent-2 p-8">
        <div className="absolute inset-0 bg-grid-pattern opacity-10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 animate-pulse-soft" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#EC4899]/20 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2 animate-pulse-soft" style={{ animationDelay: '1s' }} />

        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm animate-bounce-in">
                <SparklesIcon />
              </div>
              <span className="text-white/80 text-sm font-medium px-3 py-1 bg-white/10 rounded-full backdrop-blur-sm">
                AI-Powered Platform
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Platform Dashboard</h1>
            <p className="text-white/70 max-w-lg">
              Real-time overview of all schools, users, and platform activity with intelligent insights
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="!bg-white/20 !text-white !border-white/30 hover:!bg-white/30 backdrop-blur-sm"
              onClick={() => {
                const exportData = [
                  { metric: "Total Schools", value: statsQuery.data?.total_schools ?? 0 },
                  { metric: "Active Schools", value: statsQuery.data?.active_schools ?? 0 },
                  { metric: "Total Users", value: statsQuery.data?.total_users ?? 0 },
                  { metric: "Students", value: totalStudents },
                  { metric: "Teachers", value: totalTeachers },
                ];
                exportDataToCsv(exportData, "platform-overview.csv");
              }}
            >
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </Button>
            <Link to="/super-admin/new">
              <Button className="!bg-white !text-accent-fg hover:!bg-white/90">
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add School
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 mb-8">
        <StatCard
          label="Total Schools"
          value={statsQuery.isLoading ? <Spinner className="!text-white" /> : statsQuery.data?.total_schools ?? 0}
          icon={<SchoolIcon />}
          gradient="bg-gradient-to-br from-accent to-[#4C1D95]"
          delay="0.1s"
          trend="+12%"
          trendUp
        />
        <StatCard
          label="Active Schools"
          value={statsQuery.isLoading ? <Spinner className="!text-white" /> : statsQuery.data?.active_schools ?? 0}
          icon={<ChartIcon />}
          gradient="bg-gradient-to-br from-emerald-600 to-[#047857]"
          delay="0.15s"
          trend="+8%"
          trendUp
        />
        <StatCard
          label="Total Users"
          value={statsQuery.isLoading ? <Spinner className="!text-white" /> : statsQuery.data?.total_users ?? 0}
          icon={<UsersIcon />}
          gradient="bg-gradient-to-br from-blue-600 to-[#1D4ED8]"
          delay="0.2s"
          trend="+24%"
          trendUp
        />
        <StatCard
          label="Students"
          value={usersQuery.isLoading ? <Spinner className="!text-white" /> : totalStudents}
          icon={<StudentIcon />}
          gradient="bg-gradient-to-br from-[#7C3AED] to-[#5B21B6]"
          delay="0.25s"
        />
        <StatCard
          label="Teachers"
          value={usersQuery.isLoading ? <Spinner className="!text-white" /> : totalTeachers}
          icon={<TeacherIcon />}
          gradient="bg-gradient-to-br from-[#DB2777] to-[#BE185D]"
          delay="0.3s"
        />
        <StatCard
          label="Inactive"
          value={statsQuery.isLoading ? <Spinner className="!text-white" /> : statsQuery.data?.inactive_schools ?? 0}
          icon={<SchoolIcon />}
          gradient="bg-gradient-to-br from-[#64748B] to-[#475569]"
          delay="0.35s"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6">
        {/* Users by Role */}
        <div className="animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
          <Card className="!p-0 overflow-hidden">
            <div className="p-5 border-b border-line bg-gradient-to-r from-surface-2 to-white dark:from-surface-2 dark:to-surface">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent/10 dark:bg-accent/20 rounded-xl">
                    <UsersIcon />
                  </div>
                  <h3 className="text-lg font-semibold text-ink dark:text-white">Users by Role</h3>
                </div>
                {usersQuery.data && usersQuery.data.length > 0 && (
                  <Button variant="secondary" onClick={() => exportDataToCsv(usersQuery.data!, "users-by-role.csv")}>
                    Export
                  </Button>
                )}
              </div>
            </div>
            <div className="p-5">
              {usersQuery.isLoading ? (
                <div className="flex h-48 items-center justify-center"><Spinner /></div>
              ) : usersQuery.data && usersQuery.data.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {usersQuery.data.map((item, idx) => (
                    <div
                      key={item.role}
                      className="animate-scale-in group relative p-4 bg-gradient-to-br from-surface-2 to-white dark:from-surface-2 dark:to-surface rounded-xl text-center border border-line hover:border-accent/50 transition-all duration-300 hover:shadow-lg hover:shadow-[#6D28D9]/10 cursor-default"
                      style={{ animationDelay: `${0.1 * idx}s` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-[#6D28D9]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-xl" />
                      <p className="relative text-3xl font-bold bg-gradient-to-r from-accent to-accent-2 bg-clip-text text-transparent">{item.count}</p>
                      <p className="relative text-xs text-ink-3 uppercase mt-2 font-medium tracking-wide">{item.role.replace("_", " ")}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-3">No user data available.</p>
              )}
            </div>
          </Card>
        </div>

        {/* Recent Schools */}
        <div className="animate-fade-in-up" style={{ animationDelay: "0.45s" }}>
          <Card className="!p-0 overflow-hidden">
            <div className="p-5 border-b border-line bg-gradient-to-r from-surface-2 to-white dark:from-surface-2 dark:to-surface">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl text-emerald-600">
                    <SchoolIcon />
                  </div>
                  <h3 className="text-lg font-semibold text-ink dark:text-white">Recent Schools</h3>
                </div>
                <Link to="/super-admin/schools">
                  <Button variant="secondary">View All</Button>
                </Link>
              </div>
            </div>
            <div className="p-5">
              {schoolsQuery.isLoading ? (
                <div className="flex h-48 items-center justify-center"><Spinner /></div>
              ) : schoolsQuery.data && schoolsQuery.data.items.length > 0 ? (
                <div className="space-y-3">
                  {schoolsQuery.data.items.map((school, idx) => (
                    <div
                      key={school.id}
                      className="animate-slide-in-right group flex items-center justify-between p-4 bg-gradient-to-r from-surface-2 to-white dark:from-surface-2 dark:to-surface rounded-xl border border-line hover:border-accent/50 transition-all duration-300 hover:shadow-lg hover:shadow-[#6D28D9]/10"
                      style={{ animationDelay: `${0.1 * idx}s` }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center text-white font-bold text-sm">
                          {school.name.charAt(0)}
                        </div>
                        <div>
                          <Link to={`/super-admin/${school.id}`} className="font-medium text-ink dark:text-white hover:text-accent-fg dark:hover:text-accent-fg transition-colors">
                            {school.name}
                          </Link>
                          <p className="text-xs text-ink-3 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {school.city ?? "—"}, {school.state ?? "—"}
                          </p>
                        </div>
                      </div>
                      <Badge tone={school.is_active ? "green" : "red"}>
                        {school.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-3">No schools registered yet.</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
        <Card className="!p-0 overflow-hidden">
          <div className="p-5 border-b border-line bg-gradient-to-r from-surface-2 to-white dark:from-surface-2 dark:to-surface">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 dark:bg-amber-500/20 rounded-xl text-amber-500">
                  <ActivityIcon />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-ink dark:text-white">Recent Activity</h3>
                  <p className="text-xs text-ink-3">Platform-wide audit trail</p>
                </div>
              </div>
              <Link to="/super-admin/audit">
                <Button variant="secondary">View All Logs</Button>
              </Link>
            </div>
          </div>
          <div className="p-5">
            {auditQuery.isLoading ? (
              <div className="flex h-40 items-center justify-center"><Spinner /></div>
            ) : auditQuery.data && auditQuery.data.length > 0 ? (
              <div className="space-y-1">
                {auditQuery.data.map((log, idx) => (
                  <div
                    key={log.id}
                    className="animate-fade-in-up group flex items-center justify-between py-4 px-4 -mx-4 hover:bg-surface-3 dark:hover:bg-[#231640] rounded-xl transition-colors cursor-default border-b border-line dark:border-[#2D1B4E]/50 last:border-0"
                    style={{ animationDelay: `${0.05 * idx}s` }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6D28D9]/20 to-[#8B5CF6]/20 dark:from-[#6D28D9]/30 dark:to-[#8B5CF6]/30 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink dark:text-white">{log.action}</p>
                        <p className="text-xs text-ink-3 flex items-center gap-2">
                          <span>{log.actor_name}</span>
                          <span className="w-1 h-1 rounded-full bg-[#7C6F95]" />
                          <span>{log.school_name}</span>
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-ink-3 font-medium">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-3">No recent activity.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
