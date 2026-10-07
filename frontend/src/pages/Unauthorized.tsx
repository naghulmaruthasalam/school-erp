import { Link } from "react-router-dom";
import { ROLE_HOME, useAuthStore } from "../auth/store";
import { useLanguage } from "../i18n/LanguageContext";

export default function Unauthorized() {
  const user = useAuthStore((s) => s.user);
  const { t } = useLanguage();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-strong animate-pop-in w-full max-w-sm !rounded-[32px] p-10 text-center">
        <p className="text-gradient text-7xl font-semibold tracking-tight">403</p>
        <p className="mt-3 text-base font-medium text-ink">{t("shell.unauthorized.title")}</p>
        <p className="mt-1 text-sm text-ink-3">{t("shell.unauthorized.message")}</p>
        <Link to={user ? ROLE_HOME[user.role] : "/login"} className="lg-btn lg-btn-primary mt-7">
          {t("shell.unauthorized.back")}
        </Link>
      </div>
    </div>
  );
}
