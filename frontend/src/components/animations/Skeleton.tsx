interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  className?: string;
  dark?: boolean;
}

export function Skeleton({
  width = "100%",
  height = 20,
  circle = false,
  className = "",
  dark = false,
}: SkeletonProps) {
  return (
    <div
      className={`${dark ? "skeleton-dark" : "skeleton"} ${className}`}
      style={{
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        borderRadius: circle ? "50%" : undefined,
      }}
    />
  );
}

export function SkeletonCard({ dark = false }: { dark?: boolean }) {
  return (
    <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton width={40} height={40} circle dark={dark} />
        <div className="flex-1">
          <Skeleton width="60%" height={16} dark={dark} className="mb-2" />
          <Skeleton width="40%" height={12} dark={dark} />
        </div>
      </div>
      <Skeleton height={12} dark={dark} className="mb-2" />
      <Skeleton height={12} dark={dark} className="mb-2" />
      <Skeleton width="80%" height={12} dark={dark} />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4, dark = false }: { rows?: number; cols?: number; dark?: boolean }) {
  return (
    <div className="w-full">
      <div className="flex gap-4 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} width={`${100 / cols}%`} height={14} dark={dark} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 py-3">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton key={colIdx} width={`${100 / cols}%`} height={12} dark={dark} />
          ))}
        </div>
      ))}
    </div>
  );
}
