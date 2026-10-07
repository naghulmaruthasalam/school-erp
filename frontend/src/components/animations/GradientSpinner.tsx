interface GradientSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "w-6 h-6",
  md: "w-10 h-10",
  lg: "w-16 h-16",
};

const innerSizeMap = {
  sm: "inset-1",
  md: "inset-1.5",
  lg: "inset-2.5",
};

export function GradientSpinner({ size = "md", className = "" }: GradientSpinnerProps) {
  return (
    <div
      className={`relative rounded-full animate-spin-slow ${sizeMap[size]} ${className}`}
      style={{
        background: "conic-gradient(from 0deg, transparent, #8b5cf6, #c084fc, #8b5cf6)",
      }}
    >
      <div
        className={`absolute ${innerSizeMap[size]} rounded-full bg-surface`}
      />
    </div>
  );
}
