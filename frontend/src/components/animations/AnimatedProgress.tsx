import { useEffect, useState } from "react";

interface AnimatedProgressProps {
  value: number;
  max?: number;
  color?: "violet" | "green" | "amber" | "red" | "cyan";
  showLabel?: boolean;
  striped?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const colorClasses = {
  violet: "bg-gradient-to-r from-violet-500 to-purple-500",
  green: "bg-gradient-to-r from-green-500 to-emerald-500",
  amber: "bg-gradient-to-r from-amber-500 to-orange-500",
  red: "bg-gradient-to-r from-red-500 to-rose-500",
  cyan: "bg-gradient-to-r from-cyan-500 to-blue-500",
};

const sizeClasses = {
  sm: "h-2",
  md: "h-3",
  lg: "h-4",
};

export function AnimatedProgress({
  value,
  max = 100,
  color = "violet",
  showLabel = false,
  striped = false,
  size = "md",
  className = "",
}: AnimatedProgressProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const percentage = Math.min((value / max) * 100, 100);

  useEffect(() => {
    const timer = setTimeout(() => setDisplayValue(percentage), 100);
    return () => clearTimeout(timer);
  }, [percentage]);

  return (
    <div className={`w-full ${className}`}>
      <div className={`w-full bg-gray-200 dark:bg-surface-3 rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full transition-all duration-700 ease-out ${
            striped ? "progress-striped" : ""
          }`}
          style={{ width: `${displayValue}%` }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 text-xs text-ink-2 dark:text-ink-3 text-end animate-count-up">
          {Math.round(displayValue)}%
        </div>
      )}
    </div>
  );
}
