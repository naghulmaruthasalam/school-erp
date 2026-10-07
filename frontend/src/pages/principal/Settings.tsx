import { Card, PageHeader } from "../../components/ui";
import { useAuthStore } from "../../auth/store";
import { useLanguage } from "../../i18n/LanguageContext";

export default function Settings() {
  const { t } = useLanguage();
  const user = useAuthStore((s) => s.user);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={t("navigation.settings")} subtitle={t("principal.settings.subtitle")} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="font-semibold text-ink dark:text-white mb-4">{t("principal.settings.accountInfo")}</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-ink-3">{t("principal.common.name")}</p>
              <p className="text-ink dark:text-white">{user?.full_name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-ink-3">{t("common.email")}</p>
              <p className="text-ink dark:text-white" dir="ltr">{user?.email}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-ink-3">{t("principal.profile.role")}</p>
              <p className="text-ink dark:text-white">{t("roles.principal")}</p>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold text-ink dark:text-white mb-4">{t("principal.settings.preferences")}</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-ink dark:text-white">{t("principal.settings.emailNotifications")}</p>
                <p className="text-sm text-ink-3">{t("principal.settings.emailNotificationsDesc")}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent/30 rounded-full peer dark:bg-surface-3 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-surface after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-accent"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-ink dark:text-white">{t("principal.settings.pushNotifications")}</p>
                <p className="text-sm text-ink-3">{t("principal.settings.pushNotificationsDesc")}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-accent/30 rounded-full peer dark:bg-surface-3 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-surface after:border-line after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-accent"></div>
              </label>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
