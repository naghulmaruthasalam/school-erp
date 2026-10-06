import type { ButtonHTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";
import { useState } from "react";
import { clsx } from "clsx";

export function Button({
  className = "",
  variant = "primary",
  glow = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger"; glow?: boolean }) {
  const variants: Record<string, string> = {
    primary: "bg-gradient-to-r from-[#6D28D9] to-[#8B5CF6] text-white hover:from-[#5B21B6] hover:to-[#7C3AED] hover:shadow-xl hover:shadow-[#6D28D9]/30 disabled:from-[#6D28D9]/50 disabled:to-[#8B5CF6]/50",
    secondary: "bg-white text-[#6D28D9] border border-[#E5DDF5] hover:bg-[#F0E9FF] hover:border-[#8B5CF6] dark:bg-[#2D1B4E] dark:text-[#D8CCEA] dark:border-[#2D1B4E] dark:hover:bg-[#3D2B5E] dark:hover:border-[#8B5CF6]",
    danger: "bg-gradient-to-r from-[#DC2626] to-[#EF4444] text-white hover:from-[#B91C1C] hover:to-[#DC2626] hover:shadow-xl hover:shadow-red-500/30 disabled:from-red-300 disabled:to-red-400",
  };
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold",
        "transition-all duration-300 ease-out transform active:scale-95",
        "disabled:cursor-not-allowed disabled:transform-none",
        glow && "btn-glow",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full rounded-lg border px-3 py-2 text-sm transition-all duration-200",
        "border-[#E5DDF5] bg-white text-[#24113F] placeholder:text-[#7C6F95]",
        "focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20",
        "dark:border-[#2D1B4E] dark:bg-[#1B1230] dark:text-white dark:placeholder:text-[#7C6F95]",
        "dark:focus:border-[#8B5CF6] dark:focus:ring-[#8B5CF6]/20",
        className
      )}
      {...props}
    />
  );
}

export function PasswordInput({ className = "", ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="relative">
      <input
        type={showPassword ? "text" : "password"}
        className={clsx(
          "w-full rounded-lg border px-3 py-2 pr-10 text-sm transition-all duration-200",
          "border-violet-300 bg-white text-violet-900 placeholder:text-violet-400",
          "focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20",
          "dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-400",
          "dark:focus:border-violet-400 dark:focus:ring-violet-400/20",
          className
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        disabled={props.disabled}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-violet-600 hover:text-violet-700 dark:text-white dark:hover:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {showPassword ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
      </button>
    </div>
  );
}

export function Label({ className = "", ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={clsx(
        "mb-1 block text-sm font-medium",
        "text-[#24113F] dark:text-[#D8CCEA]",
        className
      )}
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
  gradient = false
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
        "rounded-xl border p-5 shadow-sm",
        gradient
          ? "bg-gradient-to-br from-white via-white to-[#F7F5FF] border-[#E5DDF5] dark:from-[#1B1230] dark:via-[#1B1230] dark:to-[#2D1B4E]"
          : "bg-white border-[#E5DDF5] dark:bg-[#1B1230] dark:border-[#2D1B4E]",
        "transition-all duration-300 ease-out",
        animate && "hover:shadow-xl hover:shadow-[#6D28D9]/15 hover:border-[#8B5CF6]/30 hover:-translate-y-1 dark:hover:border-[#8B5CF6]/40 dark:hover:shadow-[#8B5CF6]/20",
        onClick && "cursor-pointer active:scale-[0.98]",
        className
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
    <div className="mb-6 flex items-start justify-between animate-page-enter">
      <div>
        <h1 className="text-2xl font-bold text-[#24113F] dark:text-white tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-[#4B4260] dark:text-[#D8CCEA]">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {actions || children}
      </div>
    </div>
  );
}

export function Spinner({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "h-4 w-4 border-2",
    md: "h-5 w-5 border-2",
    lg: "h-8 w-8 border-3"
  };
  return (
    <div
      className={clsx(
        "animate-spin rounded-full spinner-gradient",
        sizes[size],
        className
      )}
    />
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="text-sm text-red-600 dark:text-red-400">{children}</p>;
}

export function StatTile({
  label,
  value,
  hint,
  trend,
  trendUp,
  icon,
  color = "purple"
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  trend?: string;
  trendUp?: boolean;
  icon?: ReactNode;
  color?: "purple" | "blue" | "green" | "pink" | "orange"
}) {
  const colors = {
    purple: "from-[#6D28D9] to-[#8B5CF6]",
    blue: "from-[#0EA5E9] to-[#38BDF8]",
    green: "from-[#10B981] to-[#34D399]",
    pink: "from-[#EC4899] to-[#F472B6]",
    orange: "from-[#F97316] to-[#FB923C]"
  };
  return (
    <Card className="group relative overflow-hidden" gradient>
      <div className={clsx(
        "absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 -mr-8 -mt-8 bg-gradient-to-br",
        colors[color]
      )} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-[#4B4260] dark:text-[#D8CCEA]">{label}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className={clsx(
              "text-3xl font-bold bg-gradient-to-r bg-clip-text text-transparent count-animate",
              colors[color]
            )}>
              {value}
            </p>
            {trend && (
              <span className={clsx(
                "text-xs font-semibold px-2 py-1 rounded-full animate-pulse",
                trendUp
                  ? "text-[#16A34A] bg-green-100 dark:text-green-400 dark:bg-green-500/20"
                  : "text-[#DC2626] bg-red-100 dark:text-red-400 dark:bg-red-500/20"
              )}>
                {trendUp ? "↑" : "↓"} {trend}
              </span>
            )}
          </div>
          {hint && <p className="mt-2 text-xs text-[#7C6F95] dark:text-[#7C6F95]">{hint}</p>}
        </div>
        {icon && (
          <div className={clsx(
            "p-3 rounded-xl bg-gradient-to-br text-white animate-float",
            colors[color]
          )}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

export function Badge({
  children,
  tone = "gray",
  className = "",
  pulse = false
}: {
  children: ReactNode;
  tone?: "gray" | "green" | "red" | "yellow" | "violet" | "blue" | "pink";
  className?: string;
  pulse?: boolean;
}) {
  const tones: Record<string, string> = {
    gray: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-gray-300",
    green: "bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 dark:from-green-500/20 dark:to-emerald-500/20 dark:text-green-400",
    red: "bg-gradient-to-r from-red-100 to-rose-100 text-red-700 dark:from-red-500/20 dark:to-rose-500/20 dark:text-red-400",
    yellow: "bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-700 dark:from-yellow-500/20 dark:to-amber-500/20 dark:text-yellow-400",
    violet: "bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700 dark:from-violet-500/20 dark:to-purple-500/20 dark:text-violet-400",
    blue: "bg-gradient-to-r from-blue-100 to-cyan-100 text-blue-700 dark:from-blue-500/20 dark:to-cyan-500/20 dark:text-blue-400",
    pink: "bg-gradient-to-r from-pink-100 to-rose-100 text-pink-700 dark:from-pink-500/20 dark:to-rose-500/20 dark:text-pink-400",
  };
  return (
    <span className={clsx(
      "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 hover:scale-105",
      tones[tone],
      pulse && "animate-pulse",
      className
    )}>
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
    <select
      className={clsx(
        "w-full rounded-lg border px-3 py-2 text-sm transition-all duration-200",
        "border-[#E5DDF5] bg-white text-[#24113F]",
        "focus:border-[#6D28D9] focus:outline-none focus:ring-2 focus:ring-[#6D28D9]/20",
        "dark:border-[#2D1B4E] dark:bg-[#1B1230] dark:text-white",
        "dark:focus:border-[#8B5CF6] dark:focus:ring-[#8B5CF6]/20",
        className
      )}
      {...props}
    >
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
  if (!open) return null;

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className={clsx(
        "relative w-full bg-white dark:bg-slate-800 rounded-2xl shadow-2xl animate-fade-in-up overflow-hidden",
        sizeClasses[size]
      )}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
