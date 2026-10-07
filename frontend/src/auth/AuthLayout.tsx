import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Logo from "../components/Logo";
import type { RoleTheme } from "../theme/roles";
import { ThemeToggle, useRoleAccent } from "../theme/ThemeContext";
import { useLanguage } from "../i18n/LanguageContext";

/** Shared visual shell for every auth page (forgot/reset password, register):
 * the role-tinted liquid-glass wallpaper with a single centred glass card. */
export default function AuthLayout({
  theme,
  title,
  subtitle,
  IconOverride,
  children,
  footer,
}: {
  theme: RoleTheme;
  title: string;
  subtitle?: string;
  IconOverride?: LucideIcon;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useRoleAccent(theme.role);
  const { t } = useLanguage();
  const HeaderIcon = IconOverride ?? theme.Icon;

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="absolute end-4 top-4">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-sm animate-fade-in-up">
        <div className="glass-strong animate-pop-in !rounded-[32px] p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="lg-icon mb-4 !h-14 !w-14 !rounded-[20px]">
              <HeaderIcon className="h-7 w-7" strokeWidth={1.7} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-ink-3">{subtitle}</p>}
          </div>
          {children}
        </div>
        <div className="mt-5 flex items-center justify-center gap-2 text-ink-3">
          <Logo size={18} showWordmark={false} />
          <span className="text-xs font-medium">{t("shell.brand.name")}</span>
        </div>
        {footer && <div className="mt-3 text-center text-sm text-ink-2">{footer}</div>}
      </div>
    </div>
  );
}
