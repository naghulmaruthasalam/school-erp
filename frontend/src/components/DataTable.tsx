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
          <div className="h-4 w-3/4 rounded animate-shimmer" />
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
    <div className="overflow-x-auto rounded-lg border border-violet-200 bg-violet-50/50 shadow-sm transition-shadow hover:shadow-md">
      <table className="min-w-full divide-y divide-violet-200 text-sm">
        <thead className="bg-violet-100/50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.header}
                className="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-violet-600"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-violet-100">
          {isLoading ? (
            <>
              <SkeletonRow columns={columns.length} />
              <SkeletonRow columns={columns.length} />
              <SkeletonRow columns={columns.length} />
            </>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-violet-400">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr
                key={rowKey(row)}
                className="hover:bg-violet-100/50 transition-colors duration-150 animate-fade-in-up"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                {columns.map((col) => (
                  <td key={col.header} className={`px-4 py-2.5 text-violet-800 ${col.className ?? ""}`}>
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
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
    <div className="mt-3 flex items-center justify-between text-sm text-violet-600">
      <span>
        Page <span className="font-medium text-violet-800">{page}</span> of{" "}
        <span className="font-medium text-violet-800">{totalPages}</span> ({total} total)
      </span>
      <div className="flex gap-2">
        <button
          className="rounded-md border border-violet-300 px-3 py-1.5 bg-violet-50 transition-all duration-200 hover:bg-violet-100 hover:border-violet-400 active:scale-95 disabled:opacity-40 disabled:hover:bg-violet-50 disabled:active:scale-100"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </button>
        <button
          className="rounded-md border border-violet-300 px-3 py-1.5 bg-violet-50 transition-all duration-200 hover:bg-violet-100 hover:border-violet-400 active:scale-95 disabled:opacity-40 disabled:hover:bg-violet-50 disabled:active:scale-100"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
