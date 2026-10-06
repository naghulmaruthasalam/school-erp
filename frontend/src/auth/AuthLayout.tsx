import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Logo from "../components/Logo";
import type { RoleTheme } from "../theme/roles";

/** Shared visual shell for every auth page (login, forgot/reset password,
 * register): a role-tinted gradient background with slow floating blobs,
 * and a card with a rotating gradient "moving outline" matching the role's
 * colors. Falls back to the default indigo theme when no role is known yet
 * (e.g. the register/landing pages). */
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
  const glowStyle = {
    "--glow-from": theme.glowFrom,
    "--glow-to": theme.glowTo,
  } as CSSProperties;

  return (
    <div
      className={`relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br ${theme.from} ${theme.to} px-4 py-12`}
    >
      <div className="pointer-events-none absolute -left-16 -top-16 h-72 w-72 rounded-full bg-white/10 blur-3xl animate-float-slow" />
      <div
        className="pointer-events-none absolute -bottom-20 -right-10 h-80 w-80 rounded-full bg-white/10 blur-3xl animate-float-slow"
        style={{ animationDelay: "2.5s" }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-6 h-40 w-40 -translate-x-1/2 rounded-full bg-white/10 blur-2xl animate-float"
        style={{ animationDelay: "1s" }}
      />

      <div className="relative z-10 w-full max-w-sm animate-fade-in-up">
        <div className="glow-border animate-pop-in" style={glowStyle}>
          <div className="glow-border-inner p-8">
            <div className="mb-6 flex flex-col items-center text-center">
              <Logo size={40} showWordmark={false} className="mb-3" />
              <div className={`mb-2 animate-float`}>
                {IconOverride ? (
                  <IconOverride className="w-10 h-10 text-violet-700" strokeWidth={1.5} />
                ) : (
                  <theme.Icon className="w-10 h-10 text-violet-700" strokeWidth={1.5} />
                )}
              </div>
              <h1 className="text-lg font-semibold text-violet-900">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-violet-600">{subtitle}</p>}
            </div>
            {children}
          </div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-white/90">{footer}</div>}
      </div>
    </div>
  );
}
