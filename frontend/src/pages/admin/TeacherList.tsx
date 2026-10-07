import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Input, Label, PageHeader } from "../../components/ui";
import { DataTable, Pagination, type Column } from "../../components/DataTable";
import { listTeachers } from "./api";
import { useLanguage } from "../../i18n/LanguageContext";
import type { Teacher, TeacherStatus } from "./types";

const STATUS_OPTIONS: TeacherStatus[] = ["ACTIVE", "ON_LEAVE", "INACTIVE"];

const STATUS_TONE: Record<TeacherStatus, "gray" | "green" | "red" | "yellow"> = {
  ACTIVE: "green",
  ON_LEAVE: "yellow",
  INACTIVE: "gray",
};

const PAGE_SIZE = 20;

export default function TeacherList() {
  const { t, te } = useLanguage();
  const [page, setPage] = useState(1);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<TeacherStatus | "">("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "teachers", { page, name, status }],
    queryFn: () =>
      listTeachers({
        page,
        page_size: PAGE_SIZE,
        name: name || undefined,
        status: status || undefined,
      }),
  });

  const columns: Column<Teacher>[] = [
    { header: t("admin.common.employeeNo"), cell: (t) => t.employee_no },
    {
      header: t("admin.common.name"),
      cell: (t) => (
        <Link to={`/admin/teachers/${t.id}`} className="font-medium text-accent-fg hover:underline">
          {t.full_name}
        </Link>
      ),
    },
    { header: t("admin.common.phone"), cell: (x) => x.phone },
    { header: t("common.email"), cell: (x) => x.email ?? "—" },
    { header: t("admin.common.status"), cell: (x) => <Badge tone={STATUS_TONE[x.status]}>{te("status", x.status)}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title={t("admin.teachers.title")}
        subtitle={t("admin.teachers.subtitle")}
        actions={
          <Link to="/admin/teachers/new">
            <Button>{t("admin.teachers.newTeacher")}</Button>
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label>{t("admin.common.name")}</Label>
          <Input
            placeholder={t("admin.common.searchByName")}
            value={name}
            onChange={(e) => {
              setPage(1);
              setName(e.target.value);
            }}
          />
        </div>
        <div>
          <Label>{t("admin.common.status")}</Label>
          <select
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink dark:text-slate-100 focus:border-violet-500 dark:focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as TeacherStatus | "");
            }}
          >
            <option value="">{t("admin.common.allStatuses")}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {te("status", s)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataTable columns={columns} rows={data?.items ?? []} isLoading={isLoading} rowKey={(t) => t.id} emptyLabel={t("admin.teachers.empty")} />
      <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} />
    </div>
  );
}
