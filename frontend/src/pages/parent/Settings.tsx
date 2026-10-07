import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, Card, Input, Label, PageHeader } from "../../components/ui";
import { api } from "../../api/client";
import { useTheme } from "../../theme/ThemeContext";
import { useLanguage } from "../../i18n/LanguageContext";

export default function ParentSettings() {
  const { t } = useLanguage();
  const { theme, setTheme } = useTheme();

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const updatePasswordMutation = useMutation({
    mutationFn: async (payload: typeof passwordForm) => {
      await api.post("/auth/change-password", payload);
    },
    onSuccess: () => {
      setPasswordSuccess(true);
      setPasswordError(null);
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
      setTimeout(() => setPasswordSuccess(false), 3000);
    },
    onError: () => {
      setPasswordError(t("parent.settings.changeFailed"));
      setPasswordSuccess(false);
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError(t("parent.settings.mismatch"));
      return;
    }
    if (passwordForm.new_password.length < 6) {
      setPasswordError(t("parent.settings.tooShort"));
      return;
    }

    updatePasswordMutation.mutate(passwordForm);
  };

  return (
    <div className="animate-fade-in-up max-w-2xl">
      <PageHeader title={t("navigation.settings")} subtitle={t("parent.settings.subtitle")} />

      <div className="space-y-6">
        {/* Appearance */}
        <Card className="!p-0 overflow-hidden">
          <div className="p-5 border-b border-line bg-gradient-to-r from-surface-2 to-white dark:from-surface-2 dark:to-surface">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent/10 dark:bg-accent/20 rounded-xl">
                <svg className="w-5 h-5 text-accent-fg dark:text-accent-fg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-ink dark:text-white">{t("parent.settings.appearance")}</h3>
            </div>
          </div>
          <div className="p-6">
            <Label>{t("settings.theme")}</Label>
            <div className="mt-3 flex gap-3">
              <button
                onClick={() => setTheme("light")}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  theme === "light"
                    ? "border-accent bg-surface-3"
                    : "border-line hover:border-accent/50"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className="font-medium text-ink dark:text-white">{t("parent.settings.light")}</span>
                </div>
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  theme === "dark"
                    ? "border-accent bg-surface-3"
                    : "border-line hover:border-accent/50"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5 text-accent-fg dark:text-accent-fg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  <span className="font-medium text-ink dark:text-white">{t("parent.settings.dark")}</span>
                </div>
              </button>
            </div>
          </div>
        </Card>

        {/* Change Password */}
        <Card className="!p-0 overflow-hidden">
          <div className="p-5 border-b border-line bg-gradient-to-r from-surface-2 to-white dark:from-surface-2 dark:to-surface">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 dark:bg-red-500/20 rounded-xl">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-ink dark:text-white">{t("parent.settings.changePassword")}</h3>
            </div>
          </div>
          <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
            <div>
              <Label>{t("parent.settings.currentPassword")}</Label>
              <Input
                type="password"
                value={passwordForm.current_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>{t("parent.settings.newPassword")}</Label>
              <Input
                type="password"
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>{t("parent.settings.confirmPassword")}</Label>
              <Input
                type="password"
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                required
              />
            </div>

            {passwordError && (
              <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
            )}
            {passwordSuccess && (
              <p className="text-sm text-green-600 dark:text-green-400">{t("parent.settings.changed")}</p>
            )}

            <Button type="submit" disabled={updatePasswordMutation.isPending}>
              {updatePasswordMutation.isPending ? t("parent.settings.updating") : t("parent.settings.update")}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
