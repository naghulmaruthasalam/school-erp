import { Card, PageHeader } from "../../components/ui";
import Logo from "../../components/Logo";
import { useLanguage } from "../../i18n/LanguageContext";

export default function About() {
  const { t, fmtNumber } = useLanguage();
  return (
    <div className="animate-fade-in-up">
      <PageHeader title={t("navigation.about")} subtitle={t("shell.about.subtitle")} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center gap-4 mb-6">
            <Logo size={64} showWordmark={false} />
            <div>
              <h2 className="text-xl font-bold text-ink dark:text-white">{t("shell.brand.name")}</h2>
              <p className="text-sm text-ink-3">{t("shell.about.platformVersion", { v: "1.0.0" })}</p>
            </div>
          </div>

          <p className="text-ink-2 mb-4">
            {t("shell.about.platformDesc")}
          </p>

          <div className="border-t border-line pt-4 mt-4">
            <h3 className="font-semibold text-ink dark:text-white mb-3">{t("shell.about.platformFeatures")}</h3>
            <ul className="space-y-2 text-sm text-ink-2">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                {t("shell.about.sa.multiSchool")}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                {t("shell.about.sa.users")}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                {t("shell.about.sa.analytics")}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                {t("shell.about.sa.audit")}
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-accent"></span>
                {t("shell.about.sa.onboarding")}
              </li>
            </ul>
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold text-ink dark:text-white mb-4">{t("shell.about.contact")}</h3>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-ink-3">{t("common.email")}</p>
              <p dir="ltr" className="text-ink dark:text-white text-start">info@capitalschool.om</p>
            </div>
            <div>
              <p className="text-sm font-medium text-ink-3">{t("shell.about.addressLabel")}</p>
              <p className="text-ink dark:text-white">{t("shell.about.address")}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-ink-3">{t("shell.about.phone")}</p>
              <p dir="ltr" className="text-ink dark:text-white text-start">+968 9980 1655</p>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-line">
            <p className="text-xs text-ink-3">
              &copy; {fmtNumber(new Date().getFullYear(), { useGrouping: false })} {t("shell.about.rights", { name: t("shell.brand.name") })}
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
