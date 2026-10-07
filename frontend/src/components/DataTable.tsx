import type { ReactNode } from "react";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

function SkeletonRow({ columns }: { columns: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 w-3/4 animate-shimmer" />
        </td>
      ))}
    </tr>
  );
}

export function DataTable<T>({
  columns,
  rows,
  isLoading,
  emptyLabel = "No records found.",
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  isLoading?: boolean;
  emptyLabel?: string;
  rowKey: (row: T) => string;
}) {
  return (
    <div className="glass overflow-hidden rounded-[22px]">
      <div className="overflow-x-auto">
        <table className="lg-table min-w-full">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.header}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <>
                <SkeletonRow columns={columns.length} />
                <SkeletonRow columns={columns.length} />
                <SkeletonRow columns={columns.length} />
              </>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="!py-10 text-center text-sm text-ink-3">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={rowKey(row)} className="animate-fade-in-up" style={{ animationDelay: `${Math.min(idx, 12) * 28}ms` }}>
                  {columns.map((col) => (
                    <td key={col.header} className={col.className ?? ""}>
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-ink-3">
      <span>
        Page <span className="font-semibold text-ink">{page}</span> of{" "}
        <span className="font-semibold text-ink">{totalPages}</span> ({total} total)
      </span>
      <div className="flex gap-2">
        <button className="lg-btn lg-btn-secondary !min-h-9 !px-4" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </button>
        <button className="lg-btn lg-btn-secondary !min-h-9 !px-4" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}
