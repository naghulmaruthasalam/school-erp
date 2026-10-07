import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader } from "../../../components/ui";
import { DataTable, type Column } from "../../../components/DataTable";
import { createAcademicYear, listAcademicYears, setCurrentAcademicYear } from "./api";
import { useLanguage } from "../../../i18n/LanguageContext";
import type { AcademicYear } from "./types";

export default function AcademicYearList() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: years, isLoading } = useQuery({ queryKey: ["academic-years"], queryFn: listAcademicYears });

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: createAcademicYear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
      setName("");
      setStartDate("");
      setEndDate("");
      setIsCurrent(false);
      setError("");
    },
    onError: (err) => setError(err instanceof Error ? err.message : t("admin.years.createFailed")),
  });

  const setCurrentMutation = useMutation({
    mutationFn: setCurrentAcademicYear,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["academic-years"] }),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name || !startDate || !endDate) {
      setError(t("admin.years.fieldsRequired"));
      return;
    }
    createMutation.mutate({ name, start_date: startDate, end_date: endDate, is_current: isCurrent });
  }

  const columns: Column<AcademicYear>[] = [
    { header: t("admin.common.name"), cell: (y) => y.name },
    { header: t("admin.common.startDate"), cell: (y) => y.start_date },
    { header: t("admin.common.endDate"), cell: (y) => y.end_date },
    { header: t("admin.common.status"), cell: (y) => (y.is_current ? <Badge tone="green">{t("admin.common.current")}</Badge> : <Badge>{t("admin.common.inactive")}</Badge>) },
    {
      header: t("admin.common.actions"),
      cell: (y) =>
        !y.is_current && (
          <Button
            variant="secondary"
            className="px-2! py-1! text-xs"
            disabled={setCurrentMutation.isPending}
            onClick={() => setCurrentMutation.mutate(y.id)}
          >
            {t("admin.years.setCurrent")}
          </Button>
        ),
    },
  ];

  return (
    <div>
      <PageHeader title={t("admin.years.title")} subtitle={t("admin.years.subtitle")} />

      <Card className="mb-6">
        <h2 className="mb-4 text-sm font-semibold text-ink">{t("admin.years.createTitle")}</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end">
          <div>
            <Label htmlFor="ay-name">{t("admin.common.name")}</Label>
            <Input id="ay-name" placeholder="2027-2028" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ay-start">{t("admin.common.startDate")}</Label>
            <Input id="ay-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ay-end">{t("admin.common.endDate")}</Label>
            <Input id="ay-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" checked={isCurrent} onChange={(e) => setIsCurrent(e.target.checked)} />
              {t("admin.years.setAsCurrent")}
            </label>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? t("admin.common.creating") : t("admin.common.create")}
            </Button>
          </div>
        </form>
        <ErrorText>{error}</ErrorText>
      </Card>

      <DataTable columns={columns} rows={years ?? []} isLoading={isLoading} rowKey={(y) => y.id} emptyLabel={t("admin.years.empty")} />
    </div>
  );
}
