import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";
import { useEffect, useState } from "react";
import { clsx } from "clsx";

export function Button({
  className = "",
  variant = "primary",
  glow = false,
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger"; glow?: boolean; size?: "sm" | "md" | "lg" | string }) {
  const variants: Record<string, string> = {
    primary: "lg-btn-primary",
    secondary: "lg-btn-secondary",
    danger: "lg-btn-danger",
  };
  return (
    <button
      className={clsx("lg-btn", variants[variant], size === "sm" && "!min-h-9 !px-4 !text-[13px]", size === "lg" && "!min-h-12 !px-7 !text-base", glow && "animate-glow-pulse", className)}
      {...props}
    />
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx("lg-field", className)} {...props} />;
}

export function PasswordInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="relative">
      <input
        type={showPassword ? "text" : "password"}
        className={clsx("lg-field pe-11", className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        disabled={props.disabled}
        aria-label={showPassword ? "Hide password" : "Show password"}
        className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-3 transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        {showPassword ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
      </button>
    </div>
  );
}

export function Label({ className = "", ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={clsx("mb-1.5 block text-[13px] font-medium tracking-tight text-ink-2", className)}
      {...props}
    />
  );
}

export function Card({
  children,
  className = "",
  animate = true,
  style,
  onClick,
  gradient = false,
}: {
  children: ReactNode;
  className?: string;
  animate?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
  gradient?: boolean;
}) {
  return (
    <div
      className={clsx(
        "glass p-5",
        gradient && "glass-tinted",
        animate && "glass-lift",
        onClick && "cursor-pointer active:scale-[0.985]",
        className,
      )}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 animate-page-enter">
      <div className="min-w-0">
        <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-3">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">{actions || children}</div>
    </div>
  );
}

export function Spinner({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-4 w-4", md: "h-5 w-5", lg: "h-8 w-8" };
  return <div className={clsx("spinner-gradient", sizes[size], className)} />;
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="text-sm font-medium text-red-600 dark:text-red-400">{children}</p>;
}

const TONES: Record<string, [string, string]> = {
  purple: ["var(--accent)", "var(--accent-2)"],
  blue: ["#0a84ff", "#5ac8fa"],
  green: ["#30c25a", "#34d3a0"],
  pink: ["#ff4f8b", "#ff8aa9"],
  orange: ["#ff9f0a", "#ffc24a"],
};

export function StatTile({
  label,
  value,
  hint,
  trend,
  trendUp,
  icon,
  color = "purple",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: string;
  trendUp?: boolean;
  icon?: ReactNode;
  color?: "purple" | "blue" | "green" | "pink" | "orange";
}) {
  const [a, b] = TONES[color];
  return (
    <Card className="group relative overflow-hidden">
      <div
        className="pointer-events-none absolute -end-10 -top-10 h-32 w-32 rounded-full opacity-[0.16] blur-2xl transition-opacity duration-500 group-hover:opacity-30"
        style={{ background: a }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink-3">{label}</p>
          <div className="mt-2 flex flex-wrap items-baseline gap-2">
            <p className="tabular text-[1.9rem] font-semibold leading-none tracking-tight text-ink count-animate">{value}</p>
            {trend && (
              <span
                className="lg-chip"
                style={{ ["--chip" as string]: trendUp ? "#30c25a" : "#ff453a" }}
              >
                {trendUp ? "↑" : "↓"} {trend}
              </span>
            )}
          </div>
          {hint && <p className="mt-2 text-xs text-ink-3">{hint}</p>}
        </div>
        {icon && (
          <div className="lg-icon" style={{ ["--tone-a" as string]: a, ["--tone-b" as string]: b }}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

const BADGE_COLORS: Record<string, string> = {
  gray: "#8e8e93",
  green: "#30c25a",
  red: "#ff453a",
  yellow: "#ffb21a",
  amber: "#ff9f0a",
  violet: "var(--accent)",
  blue: "#0a84ff",
  pink: "#ff4f8b",
};

export function Badge({
  children,
  tone = "gray",
  className = "",
  pulse = false,
}: {
  children: ReactNode;
  tone?: "gray" | "green" | "red" | "yellow" | "amber" | "violet" | "blue" | "pink";
  className?: string;
  pulse?: boolean;
}) {
  return (
    <span
      className={clsx("lg-chip", pulse && "animate-pulse", className)}
      style={{ ["--chip" as string]: BADGE_COLORS[tone] }}
    >
      {children}
    </span>
  );
}

export function Select({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select className={clsx("lg-field", className)} {...props}>
      {children}
    </select>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const sizeClasses = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-xl" };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div
        className="fixed inset-0 animate-fade-in bg-slate-900/30 backdrop-blur-md dark:bg-black/50"
        onClick={onClose}
      />
      <div
        className={clsx(
          "glass-strong relative w-full overflow-hidden rounded-[28px] animate-[sheet-up_0.45s_var(--ease)_both]",
          sizeClasses[size],
        )}
      >
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-3 text-ink-3 transition-all hover:scale-105 hover:text-ink"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 pb-6">{children}</div>
      </div>
    </div>
  );
}
