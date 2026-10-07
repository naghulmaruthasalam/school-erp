import { Badge, Card, PageHeader } from "../../components/ui";
import { useAuthStore } from "../../auth/store";
import { useLanguage } from "../../i18n/LanguageContext";

function Field({ label, value, dir }: { label: string; value: string | null | undefined; dir?: "ltr" | "rtl" }) {
  return (
    <div className="animate-fade-in-up">
      <p className="text-xs font-medium uppercase tracking-wide text-accent-fg dark:text-accent-fg">{label}</p>
      <p className="mt-0.5 text-sm text-ink dark:text-white" dir={dir}>{value || "—"}</p>
    </div>
  );
}

export default function ParentProfile() {
  const { t } = useLanguage();
  const user = useAuthStore((s) => s.user);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={t("navigation.myProfile")} subtitle={t("parent.profile.subtitle")} />

      <div className="space-y-6">
        {/* Profile Header Card */}
        <Card className="!p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 p-6">
            <div className="flex items-center gap-6">
              {/* Profile Photo */}
              <div className="relative">
                <div className="w-24 h-24 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border-4 border-white/30 overflow-hidden">
                  <span className="text-4xl font-bold text-white">
                    {user?.full_name?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
                <div className="absolute -bottom-1 -end-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>

              {/* Profile Info */}
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-white mb-1">{user?.full_name}</h2>
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1 bg-white/20 rounded-full backdrop-blur-sm">
                    <p className="text-sm font-medium text-white">{t("parent.profile.role")}</p>
                  </div>
                  <Badge tone="green">{t("parent.profile.active")}</Badge>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Account Information */}
        <Card className="!p-0 overflow-hidden">
          <div className="p-5 border-b border-line bg-gradient-to-r from-surface-2 to-white dark:from-surface-2 dark:to-surface">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 dark:bg-accent/20 rounded-xl">
                <svg className="w-5 h-5 text-accent-fg dark:text-accent-fg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-ink dark:text-white">{t("parent.profile.accountInfo")}</h3>
            </div>
          </div>
          <div className="p-6 grid grid-cols-2 gap-6 sm:grid-cols-3">
            <Field label={t("parent.profile.fullName")} value={user?.full_name} />
            <Field label={t("common.email")} value={user?.email} dir="ltr" />
            <Field label={t("parent.profile.roleLabel")} value={t("parent.profile.role")} />
          </div>
        </Card>

        {/* Info Note */}
        <Card className="!bg-surface-3 dark:!bg-surface !border-[#6D28D9]/20">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-accent/10 rounded-xl">
              <svg className="w-5 h-5 text-accent-fg dark:text-accent-fg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-ink dark:text-white">{t("parent.profile.linkedChildren")}</p>
              <p className="text-sm text-ink-3 mt-1">
                {t("parent.profile.linkedChildrenNote")}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
