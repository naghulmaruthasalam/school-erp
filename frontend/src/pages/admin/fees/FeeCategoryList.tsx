import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button, Card, ErrorText, Input, Label, PageHeader } from "../../../components/ui";
import FeesNav from "./FeesNav";
import { DataTable, type Column } from "../../../components/DataTable";
import { createFeeCategory, listFeeCategories } from "./api";
import { useLanguage } from "../../../i18n/LanguageContext";
import type { FeeCategory } from "./types";

export default function FeeCategoryList() {
  const { t, te } = useLanguage();
  const queryClient = useQueryClient();
  const { data: categories, isLoading } = useQuery({ queryKey: ["fee-categories"], queryFn: listFeeCategories });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: createFeeCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-categories"] });
      setName("");
      setDescription("");
      setError("");
    },
    onError: (err) => setError(err instanceof Error ? err.message : t("admin.feeCategories.createFailed")),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name) {
      setError(t("admin.common.nameRequired"));
      return;
    }
    createMutation.mutate({ name, description: description || null });
  }

  const columns: Column<FeeCategory>[] = [
    { header: t("admin.common.name"), cell: (c) => te("feeType", c.name) },
    { header: t("admin.common.description"), cell: (c) => c.description ?? "—" },
  ];

  return (
    <div>
      <PageHeader title={t("admin.feeCategories.title")} subtitle={t("admin.feeCategories.subtitle")} />
      <FeesNav />

      <Card className="mb-6">
        <h2 className="mb-4 text-sm font-semibold text-ink">{t("admin.feeCategories.createTitle")}</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
          <div>
            <Label htmlFor="fc-name">{t("admin.common.name")}</Label>
            <Input id="fc-name" placeholder={t("admin.feeCategories.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="fc-desc">{t("admin.common.description")}</Label>
            <Input id="fc-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? t("admin.common.creating") : t("admin.common.create")}
          </Button>
        </form>
        <ErrorText>{error}</ErrorText>
      </Card>

      <DataTable columns={columns} rows={categories ?? []} isLoading={isLoading} rowKey={(c) => c.id} emptyLabel={t("admin.feeCategories.empty")} />
    </div>
  );
}
