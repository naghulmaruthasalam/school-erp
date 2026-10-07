import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, Input, Select } from "../../components/ui";
import { DataTable, Pagination } from "../../components/DataTable";
import { listSchools, updateSchool, exportDataToCsv } from "./api";
import type { School } from "./types";
import { useLanguage } from "../../i18n/LanguageContext";

const PAGE_SIZE = 10;

export default function SchoolList() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const schoolsQuery = useQuery({
    queryKey: ["super-admin", "schools", page, statusFilter],
    queryFn: () => listSchools({ page, page_size: PAGE_SIZE }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      updateSchool(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin", "schools"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin", "stats"] });
    },
  });

  const filteredSchools = (schoolsQuery.data?.items ?? []).filter((school) => {
    const matchesSearch = search === "" ||
      school.name.toLowerCase().includes(search.toLowerCase()) ||
      school.code.toLowerCase().includes(search.toLowerCase()) ||
      (school.city?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "active" && school.is_active) ||
      (statusFilter === "inactive" && !school.is_active);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink dark:text-white">{t("superAdmin.schools.title")}</h1>
          <p className="mt-1 text-sm text-ink-2">
            {t("superAdmin.schools.subtitle")}
          </p>
        </div>
        <Link to="/super-admin/new">
          <Button>{t("superAdmin.schools.addNew")}</Button>
        </Link>
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder={t("superAdmin.schools.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">{t("superAdmin.schools.allStatus")}</option>
              <option value="active">{t("superAdmin.common.active")}</option>
              <option value="inactive">{t("superAdmin.common.inactive")}</option>
            </Select>
          </div>
          <Button
            variant="secondary"
            onClick={() => exportDataToCsv(schoolsQuery.data?.items ?? [], "schools-export.csv")}
            disabled={!schoolsQuery.data?.items?.length}
          >
            {t("superAdmin.common.exportCsv")}
          </Button>
        </div>
      </Card>

      <Card>
        <DataTable<School>
          columns={[
            {
              header: t("superAdmin.detail.schoolName"),
              cell: (row) => (
                <Link to={`/super-admin/${row.id}`} className="font-medium text-accent-fg hover:underline">
                  {row.name}
                </Link>
              ),
            },
            { header: t("superAdmin.schools.code"), cell: (row) => <span className="font-mono text-sm">{row.code}</span> },
            { header: t("superAdmin.detail.city"), cell: (row) => row.city ?? "—" },
            { header: t("superAdmin.detail.state"), cell: (row) => row.state ?? "—" },
            { header: t("profile.email"), cell: (row) => (row.email ? <span dir="ltr">{row.email}</span> : "—") },
            { header: t("profile.phone"), cell: (row) => (row.phone ? <span dir="ltr">{row.phone}</span> : "—") },
            {
              header: t("fees.status"),
              cell: (row) => (
                <Badge tone={row.is_active ? "green" : "red"}>
                  {row.is_active ? t("superAdmin.common.active") : t("superAdmin.common.inactive")}
                </Badge>
              ),
            },
            {
              header: t("superAdmin.common.actions"),
              cell: (row) => (
                <div className="flex gap-2">
                  <Link to={`/super-admin/${row.id}`}>
                    <Button variant="secondary" className="text-xs px-2 py-1">{t("common.view")}</Button>
                  </Link>
                  <Button
                    variant={row.is_active ? "danger" : "primary"}
                    className="text-xs px-2 py-1"
                    onClick={() => toggleStatusMutation.mutate({ id: row.id, is_active: !row.is_active })}
                    disabled={toggleStatusMutation.isPending}
                  >
                    {row.is_active ? t("superAdmin.schools.deactivate") : t("superAdmin.schools.activate")}
                  </Button>
                </div>
              ),
            },
          ]}
          rows={filteredSchools}
          isLoading={schoolsQuery.isLoading}
          rowKey={(row) => row.id}
          emptyLabel={t("superAdmin.schools.empty")}
        />
        <div className="mt-4">
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={schoolsQuery.data?.total ?? 0}
            onPageChange={setPage}
          />
        </div>
      </Card>
    </div>
  );
}
