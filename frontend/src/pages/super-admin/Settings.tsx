import { useState } from "react";
import { Button, Card, Input, Label, Select } from "../../components/ui";
import { useLanguage } from "../../i18n/LanguageContext";

export default function Settings() {
  const { t } = useLanguage();
  const [platformName, setPlatformName] = useState("Capital Private School");
  const [supportEmail, setSupportEmail] = useState("info@capitalschool.om");
  const [supportPhone, setSupportPhone] = useState("+968 9980 1655");
  const [sessionTimeout, setSessionTimeout] = useState("30");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-ink dark:text-white">{t("superAdmin.settings.title")}</h1>
        <p className="mt-1 text-sm text-ink-2">
          {t("superAdmin.settings.subtitle")}
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* Branding */}
        <Card>
          <h3 className="text-lg font-semibold text-ink dark:text-white mb-4 pb-3 border-b border-line">
            {t("superAdmin.settings.branding")}
          </h3>
          <div className="space-y-4">
            <div>
              <Label>{t("superAdmin.settings.platformName")}</Label>
              <Input value={platformName} onChange={(e) => setPlatformName(e.target.value)} />
              <p className="text-xs text-ink-3 mt-1">{t("superAdmin.settings.platformNameHint")}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>{t("superAdmin.settings.supportEmail")}</Label>
                <Input type="email" dir="ltr" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
              </div>
              <div>
                <Label>{t("superAdmin.settings.supportPhone")}</Label>
                <Input dir="ltr" value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} />
              </div>
            </div>
          </div>
        </Card>

        {/* Security */}
        <Card>
          <h3 className="text-lg font-semibold text-ink dark:text-white mb-4 pb-3 border-b border-line">
            {t("superAdmin.settings.security")}
          </h3>
          <div className="space-y-4">
            <div>
              <Label>{t("superAdmin.settings.sessionTimeout")}</Label>
              <Select value={sessionTimeout} onChange={(e) => setSessionTimeout(e.target.value)}>
                <option value="15">{t("superAdmin.settings.minutes", { n: 15 })}</option>
                <option value="30">{t("superAdmin.settings.minutes", { n: 30 })}</option>
                <option value="60">{t("superAdmin.settings.oneHour")}</option>
                <option value="120">{t("superAdmin.settings.twoHours")}</option>
              </Select>
              <p className="text-xs text-ink-3 mt-1">{t("superAdmin.settings.timeoutHint")}</p>
            </div>
          </div>
        </Card>

        {/* Email Notifications */}
        <Card>
          <h3 className="text-lg font-semibold text-ink dark:text-white mb-4 pb-3 border-b border-line">
            {t("superAdmin.settings.adminNotifications")}
          </h3>
          <div className="space-y-3">
            {[
              { label: t("superAdmin.settings.notifNewSchool"), desc: t("superAdmin.settings.notifNewSchoolDesc"), checked: true },
              { label: t("superAdmin.settings.notifStatus"), desc: t("superAdmin.settings.notifStatusDesc"), checked: true },
              { label: t("superAdmin.settings.notifWeekly"), desc: t("superAdmin.settings.notifWeeklyDesc"), checked: true },
              { label: t("superAdmin.settings.notifAlerts"), desc: t("superAdmin.settings.notifAlertsDesc"), checked: true },
            ].map((item) => (
              <label key={item.label} className="flex items-start gap-3 p-4 bg-surface-3 dark:bg-surface rounded-lg cursor-pointer hover:bg-surface-3 dark:hover:bg-surface-3 border border-line">
                <input type="checkbox" defaultChecked={item.checked} className="mt-0.5 w-4 h-4 rounded border-line text-accent-fg focus:ring-accent/30" />
                <div>
                  <span className="text-sm font-medium text-ink dark:text-white">{item.label}</span>
                  <p className="text-xs text-ink-3">{item.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </Card>

        {/* API & Integrations */}
        <Card>
          <h3 className="text-lg font-semibold text-ink dark:text-white mb-4 pb-3 border-b border-line">
            {t("superAdmin.settings.integrations")}
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-surface-3 dark:bg-surface rounded-lg border border-line">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#16A34A] flex items-center justify-center text-white">✓</div>
                <div>
                  <p className="font-medium text-ink dark:text-white">AWS S3 Storage</p>
                  <p className="text-xs text-ink-3">{t("superAdmin.settings.s3Desc")}</p>
                </div>
              </div>
              <span className="text-xs font-medium text-emerald-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">{t("superAdmin.settings.connected")}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-surface-3 dark:bg-surface rounded-lg border border-line">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center text-white">AI</div>
                <div>
                  <p className="font-medium text-ink dark:text-white">{t("superAdmin.settings.aiAssistant")}</p>
                  <p className="text-xs text-ink-3">{t("superAdmin.settings.aiDesc")}</p>
                </div>
              </div>
              <span className="text-xs font-medium text-ink-3 bg-surface-3 dark:bg-surface px-2 py-1 rounded">{t("superAdmin.settings.optional")}</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-surface-3 dark:bg-surface rounded-lg border border-line">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#F59E0B] flex items-center justify-center text-white">₹</div>
                <div>
                  <p className="font-medium text-ink dark:text-white">PayU Payment Gateway</p>
                  <p className="text-xs text-ink-3">{t("superAdmin.settings.payuDesc")}</p>
                </div>
              </div>
              <span className="text-xs font-medium text-ink-3 bg-surface-3 dark:bg-surface px-2 py-1 rounded">{t("superAdmin.settings.configureEnv")}</span>
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3">
          <Button variant="secondary">{t("superAdmin.settings.reset")}</Button>
          <Button onClick={handleSave}>
            {saved ? t("superAdmin.settings.saved") : t("superAdmin.settings.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
