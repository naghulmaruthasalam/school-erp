import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";

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
  emptyLabel,
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  isLoading?: boolean;
  emptyLabel?: string;
  rowKey: (row: T) => string;
}) {
  const { t } = useLanguage();
  return (
    <div className="glass overflow-hidden rounded-[22px]">
      <div className="overflow-x-auto">
        <table className="lg-table min-w-full">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.header} className="text-start">{col.header}</th>
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
                  {emptyLabel ?? t("shell.dataTable.noRecords")}
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
  const { t, fmtNumber } = useLanguage();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-ink-3">
      <span>
        {t("shell.dataTable.page")} <span className="font-semibold text-ink">{fmtNumber(page)}</span> {t("shell.dataTable.of")}{" "}
        <span className="font-semibold text-ink">{fmtNumber(totalPages)}</span> ({t("shell.dataTable.total", { n: fmtNumber(total) })})
      </span>
      <div className="flex gap-2">
        <button className="lg-btn lg-btn-secondary !min-h-9 !px-4" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
          {t("shell.dataTable.previous")}
        </button>
        <button className="lg-btn lg-btn-secondary !min-h-9 !px-4" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          {t("shell.dataTable.next")}
          <ChevronRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
