import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, ErrorText, Input, Label, PageHeader } from "../../../components/ui";
import { DataTable, type Column } from "../../../components/DataTable";
import { createClass, listAcademicYears, listClasses } from "./api";
import { useLanguage } from "../../../i18n/LanguageContext";
import type { SchoolClass } from "./types";

export default function ClassList() {
  const { t, te } = useLanguage();
  const queryClient = useQueryClient();
  const { data: years } = useQuery({ queryKey: ["academic-years"], queryFn: listAcademicYears });

  const [academicYearId, setAcademicYearId] = useState("");

  useEffect(() => {
    if (!academicYearId && years && years.length > 0) {
      setAcademicYearId(years.find((y) => y.is_current)?.id ?? years[0].id);
    }
  }, [years, academicYearId]);

  const { data: classes, isLoading } = useQuery({
    queryKey: ["classes", academicYearId],
    queryFn: () => listClasses(academicYearId),
    enabled: !!academicYearId,
  });

  const [name, setName] = useState("");
  const [order, setOrder] = useState("0");
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: createClass,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes", academicYearId] });
      setName("");
      setOrder("0");
      setError("");
    },
    onError: (err) => setError(err instanceof Error ? err.message : t("admin.classes.createFailed")),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!academicYearId || !name) {
      setError(t("admin.classes.yearNameRequired"));
      return;
    }
    createMutation.mutate({ academic_year_id: academicYearId, name, order: Number(order) || 0 });
  }

  const columns: Column<SchoolClass>[] = [
    { header: t("admin.common.name"), cell: (c) => te("class", c.name) },
    { header: t("admin.common.order"), cell: (c) => c.order },
  ];

  return (
    <div>
      <PageHeader title={t("admin.classes.title")} subtitle={t("admin.classes.subtitle")} />

      <Card className="mb-6">
        <div className="mb-4">
          <Label htmlFor="cl-year">{t("admin.common.academicYear")}</Label>
          <select
            id="cl-year"
            className="w-full max-w-xs rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
          >
            <option value="" disabled>
              {t("admin.common.selectAcademicYear")}
            </option>
            {(years ?? []).map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
                {y.is_current ? t("admin.classes.currentSuffix") : ""}
              </option>
            ))}
          </select>
        </div>

        <h2 className="mb-4 text-sm font-semibold text-ink">{t("admin.classes.createTitle")}</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
          <div>
            <Label htmlFor="cl-name">{t("admin.common.name")}</Label>
            <Input id="cl-name" placeholder={t("admin.classes.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cl-order">{t("admin.common.order")}</Label>
            <Input id="cl-order" type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
          </div>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? t("admin.common.creating") : t("admin.common.create")}
          </Button>
        </form>
        <ErrorText>{error}</ErrorText>
      </Card>

      <DataTable columns={columns} rows={classes ?? []} isLoading={isLoading} rowKey={(c) => c.id} emptyLabel={t("admin.classes.empty")} />
    </div>
  );
}
