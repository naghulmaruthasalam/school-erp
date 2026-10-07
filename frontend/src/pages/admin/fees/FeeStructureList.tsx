import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, ErrorText, Input, Label, PageHeader } from "../../../components/ui";
import FeesNav from "./FeesNav";
import { DataTable, type Column } from "../../../components/DataTable";
import { listAcademicYears, listClasses } from "../academics/api";
import { createFeeStructure, listFeeCategories, listFeeStructures } from "./api";
import { useLanguage } from "../../../i18n/LanguageContext";
import type { FeeFrequency, FeeStructure } from "./types";

const FREQUENCIES: FeeFrequency[] = ["ONE_TIME", "MONTHLY", "QUARTERLY", "ANNUAL"];

export default function FeeStructureList() {
  const { t, te, fmtNumber } = useLanguage();
  const queryClient = useQueryClient();
  const { data: years } = useQuery({ queryKey: ["academic-years"], queryFn: listAcademicYears });

  const [academicYearId, setAcademicYearId] = useState("");
  useEffect(() => {
    if (!academicYearId && years && years.length > 0) {
      setAcademicYearId(years.find((y) => y.is_current)?.id ?? years[0].id);
    }
  }, [years, academicYearId]);

  const { data: classes } = useQuery({
    queryKey: ["classes", academicYearId],
    queryFn: () => listClasses(academicYearId),
    enabled: !!academicYearId,
  });

  const [classId, setClassId] = useState("");

  const { data: categories } = useQuery({ queryKey: ["fee-categories"], queryFn: listFeeCategories });

  const { data: structures, isLoading } = useQuery({
    queryKey: ["fee-structures", academicYearId, classId],
    queryFn: () => listFeeStructures({ academic_year_id: academicYearId || undefined, class_id: classId || undefined }),
    enabled: !!academicYearId,
  });

  const [formClassId, setFormClassId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<FeeFrequency>("ANNUAL");
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: createFeeStructure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-structures", academicYearId, classId] });
      setAmount("");
      setError("");
    },
    onError: (err) => setError(err instanceof Error ? err.message : t("admin.feeStructures.createFailed")),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!academicYearId || !formClassId || !categoryId || !amount) {
      setError(t("admin.feeStructures.fieldsRequired"));
      return;
    }
    createMutation.mutate({
      academic_year_id: academicYearId,
      class_id: formClassId,
      category_id: categoryId,
      amount: Number(amount),
      frequency,
    });
  }

  const className = (id: string) => te("class", classes?.find((c) => c.id === id)?.name) || id;
  const categoryName = (id: string) => te("feeType", categories?.find((c) => c.id === id)?.name) || id;

  const columns: Column<FeeStructure>[] = [
    { header: t("admin.common.class"), cell: (s) => className(s.class_id) },
    { header: t("admin.common.category"), cell: (s) => categoryName(s.category_id) },
    { header: t("admin.common.amount"), cell: (s) => `₹${fmtNumber(s.amount)}` },
    { header: t("admin.feeStructures.frequency"), cell: (s) => t(`admin.frequency.${s.frequency}`) },
  ];

  return (
    <div>
      <PageHeader title={t("admin.feeStructures.title")} subtitle={t("admin.feeStructures.subtitle")} />
      <FeesNav />

      <Card className="mb-6">
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:max-w-lg">
          <div>
            <Label htmlFor="fs-year">{t("admin.common.academicYear")}</Label>
            <select
              id="fs-year"
              className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              value={academicYearId}
              onChange={(e) => {
                setAcademicYearId(e.target.value);
                setClassId("");
              }}
            >
              {(years ?? []).map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="fs-class-filter">{t("admin.feeStructures.classFilter")}</Label>
            <select
              id="fs-class-filter"
              className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="">{t("admin.common.allClasses")}</option>
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {te("class", c.name)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <h2 className="mb-4 text-sm font-semibold text-ink">{t("admin.feeStructures.createTitle")}</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-5 sm:items-end">
          <div>
            <Label htmlFor="fs-class">{t("admin.common.class")}</Label>
            <select
              id="fs-class"
              className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              value={formClassId}
              onChange={(e) => setFormClassId(e.target.value)}
            >
              <option value="">{t("admin.common.select")}</option>
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {te("class", c.name)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="fs-category">{t("admin.common.category")}</Label>
            <select
              id="fs-category"
              className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">{t("admin.common.select")}</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {te("feeType", c.name)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="fs-amount">{t("admin.common.amount")}</Label>
            <Input id="fs-amount" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="fs-frequency">{t("admin.feeStructures.frequency")}</Label>
            <select
              id="fs-frequency"
              className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as FeeFrequency)}
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {t(`admin.frequency.${f}`)}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? t("admin.common.creating") : t("admin.common.create")}
          </Button>
        </form>
        <ErrorText>{error}</ErrorText>
      </Card>

      <DataTable columns={columns} rows={structures ?? []} isLoading={isLoading} rowKey={(s) => s.id} emptyLabel={t("admin.feeStructures.empty")} />
    </div>
  );
}
