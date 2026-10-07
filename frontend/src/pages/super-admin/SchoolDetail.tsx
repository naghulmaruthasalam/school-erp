import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, Card, Spinner } from "../../components/ui";
import { getSchool } from "./api";
import { api } from "../../api/client";
import { useLanguage } from "../../i18n/LanguageContext";

interface SchoolStats {
  total_students: number;
  total_teachers: number;
  total_parents: number;
  total_admissions: number;
  active_classes: number;
}

async function fetchSchoolStats(schoolId: string): Promise<SchoolStats> {
  try {
    const { data } = await api.get<SchoolStats>(`/schools/${schoolId}/stats`);
    return data;
  } catch {
    return { total_students: 0, total_teachers: 0, total_parents: 0, total_admissions: 0, active_classes: 0 };
  }
}

function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between py-3 border-b border-line last:border-0">
      <span className="text-sm text-ink-3">{label}</span>
      <span className="text-sm font-medium text-ink dark:text-white" dir="auto">{value || "—"}</span>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="p-4 bg-surface-3 dark:bg-surface rounded-xl border border-line">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center text-white text-lg">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-accent-fg dark:text-accent-fg">{value}</p>
          <p className="text-xs text-ink-3">{label}</p>
        </div>
      </div>
    </div>
  );
}

export default function SchoolDetail() {
  const { t, fmtDate } = useLanguage();
  const { id } = useParams<{ id: string }>();

  const schoolQuery = useQuery({
    queryKey: ["super-admin", "school", id],
    queryFn: () => getSchool(id as string),
    enabled: Boolean(id),
  });

  const statsQuery = useQuery({
    queryKey: ["super-admin", "school-stats", id],
    queryFn: () => fetchSchoolStats(id as string),
    enabled: Boolean(id),
  });

  if (schoolQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (schoolQuery.isError || !schoolQuery.data) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{t("superAdmin.detail.loadError")}</p>
        <Link to="/super-admin/schools">
          <Button variant="secondary">{t("superAdmin.detail.back")}</Button>
        </Link>
      </div>
    );
  }

  const school = schoolQuery.data;
  const stats = statsQuery.data;

  return (
    <div className="animate-fade-in-up">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center text-white text-2xl font-bold">
            {school.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-ink dark:text-white">{school.name}</h1>
              <Badge tone={school.is_active ? "green" : "red"}>
                {school.is_active ? t("superAdmin.common.active") : t("superAdmin.common.inactive")}
              </Badge>
            </div>
            <p className="text-sm text-ink-3">{t("superAdmin.detail.schoolCodeLabel")} <span className="font-mono font-medium text-accent-fg">{school.code}</span></p>
          </div>
        </div>
        <Link to="/super-admin/schools">
          <Button variant="secondary">{t("superAdmin.detail.back")}</Button>
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <StatCard label={t("superAdmin.dashboard.students")} value={stats?.total_students ?? 0} icon="👨‍🎓" />
        <StatCard label={t("superAdmin.dashboard.teachers")} value={stats?.total_teachers ?? 0} icon="👨‍🏫" />
        <StatCard label={t("superAdmin.detail.parents")} value={stats?.total_parents ?? 0} icon="👨‍👩‍👧" />
        <StatCard label={t("superAdmin.detail.admissions")} value={stats?.total_admissions ?? 0} icon="📝" />
        <StatCard label={t("superAdmin.detail.classes")} value={stats?.active_classes ?? 0} icon="🏫" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Information */}
        <Card>
          <h3 className="text-lg font-semibold text-ink dark:text-white mb-4 pb-3 border-b border-line">
            {t("superAdmin.detail.schoolInfo")}
          </h3>
          <div className="space-y-1">
            <InfoRow label={t("superAdmin.detail.schoolName")} value={school.name} />
            <InfoRow label={t("superAdmin.detail.schoolCode")} value={school.code} />
            <InfoRow label={t("profile.email")} value={school.email} />
            <InfoRow label={t("profile.phone")} value={school.phone} />
            <InfoRow label={t("superAdmin.detail.yearStarts")} value={t("superAdmin.detail.monthN", { n: school.academic_year_start_month })} />
          </div>
        </Card>

        {/* Address */}
        <Card>
          <h3 className="text-lg font-semibold text-ink dark:text-white mb-4 pb-3 border-b border-line">
            {t("superAdmin.detail.addressDetails")}
          </h3>
          <div className="space-y-1">
            <InfoRow label={t("profile.address")} value={school.address} />
            <InfoRow label={t("superAdmin.detail.city")} value={school.city} />
            <InfoRow label={t("superAdmin.detail.state")} value={school.state} />
            <InfoRow label={t("superAdmin.detail.country")} value={school.country} />
            <InfoRow label={t("superAdmin.detail.postalCode")} value={school.postal_code} />
          </div>
        </Card>

        {/* System Information */}
        <Card>
          <h3 className="text-lg font-semibold text-ink dark:text-white mb-4 pb-3 border-b border-line">
            {t("superAdmin.detail.systemInfo")}
          </h3>
          <div className="space-y-1">
            <InfoRow label={t("fees.status")} value={school.is_active ? t("superAdmin.common.active") : t("superAdmin.common.inactive")} />
            <InfoRow label={t("superAdmin.detail.created")} value={fmtDate(school.created_at)} />
            <InfoRow label={t("superAdmin.detail.lastUpdated")} value={fmtDate(school.updated_at)} />
            <InfoRow label={t("superAdmin.detail.schoolId")} value={school.id} />
          </div>
        </Card>

        {/* Quick Actions */}
        <Card>
          <h3 className="text-lg font-semibold text-ink dark:text-white mb-4 pb-3 border-b border-line">
            {t("superAdmin.detail.platformActions")}
          </h3>
          <div className="space-y-3">
            <div className="p-4 bg-surface-3 dark:bg-surface rounded-lg border border-line">
              <p className="text-sm font-medium text-ink dark:text-white">{t("superAdmin.detail.schoolStatus")}</p>
              <p className="text-xs text-ink-3 mb-3">
                {school.is_active
                  ? t("superAdmin.detail.activeDesc")
                  : t("superAdmin.detail.inactiveDesc")}
              </p>
              <Badge tone={school.is_active ? "green" : "red"}>
                {school.is_active ? t("superAdmin.detail.operational") : t("superAdmin.detail.suspended")}
              </Badge>
            </div>
            <div className="p-4 bg-surface-3 rounded-lg">
              <p className="text-xs text-ink-3">
                <strong>{t("superAdmin.detail.noteLabel")}</strong> {t("superAdmin.detail.note")}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
