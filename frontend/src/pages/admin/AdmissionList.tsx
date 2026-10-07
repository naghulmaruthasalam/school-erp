import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Label, PageHeader } from "../../components/ui";
import { DataTable, Pagination, type Column } from "../../components/DataTable";
import { listAdmissions } from "./api";
import { useClasses } from "./hooks";
import { useLanguage } from "../../i18n/LanguageContext";
import type { Admission, AdmissionStatus } from "./types";

const STATUS_OPTIONS: AdmissionStatus[] = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "CONVERTED"];

const STATUS_TONE: Record<AdmissionStatus, "gray" | "green" | "red" | "yellow"> = {
  SUBMITTED: "yellow",
  UNDER_REVIEW: "yellow",
  APPROVED: "green",
  REJECTED: "red",
  CONVERTED: "green",
};

const PAGE_SIZE = 20;

export default function AdmissionList() {
  const { t, te, fmtDate } = useLanguage();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AdmissionStatus | "">("");

  const { data: classes } = useClasses();
  const classNameById = useMemo(() => {
    const map = new Map<string, string>();
    (classes ?? []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [classes]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "admissions", { page, status }],
    queryFn: () => listAdmissions({ page, page_size: PAGE_SIZE, status: status || undefined }),
  });

  const columns: Column<Admission>[] = [
    {
      header: t("admin.admissions.applicant"),
      cell: (a) => (
        <Link to={`/admin/admissions/${a.id}`} className="font-medium text-accent-fg hover:underline">
          {a.applicant_first_name} {a.applicant_last_name}
        </Link>
      ),
    },
    { header: t("admin.admissions.applyingFor"), cell: (a) => te("class", classNameById.get(a.applying_for_class_id)) || "—" },
    { header: t("admin.admissions.guardian"), cell: (a) => `${a.guardian_name} (${a.guardian_phone})` },
    { header: t("admin.common.status"), cell: (a) => <Badge tone={STATUS_TONE[a.status]}>{te("status", a.status)}</Badge> },
    { header: t("admin.admissions.submitted"), cell: (a) => fmtDate(a.created_at) },
  ];

  return (
    <div>
      <PageHeader
        title={t("admin.admissions.title")}
        subtitle={t("admin.admissions.subtitle")}
        actions={
          <Link to="/admin/admissions/new">
            <Button>{t("admin.admissions.newAdmission")}</Button>
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <Label>{t("admin.common.status")}</Label>
          <select
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink dark:text-slate-100 focus:border-violet-500 dark:focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as AdmissionStatus | "");
            }}
          >
            <option value="">{t("admin.admissions.allStatuses")}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {te("status", s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        isLoading={isLoading}
        rowKey={(a) => a.id}
        emptyLabel={t("admin.admissions.empty")}
      />
      <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} />
    </div>
  );
}
