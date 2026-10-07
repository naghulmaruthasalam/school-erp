import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button, Card, ErrorText, Input, Label, PageHeader } from "../../../components/ui";
import { DataTable, type Column } from "../../../components/DataTable";
import { createSubject, listSubjects } from "./api";
import { useLanguage } from "../../../i18n/LanguageContext";
import type { Subject } from "./types";

export default function SubjectList() {
  const { t, te } = useLanguage();
  const queryClient = useQueryClient();
  const { data: subjects, isLoading } = useQuery({ queryKey: ["subjects"], queryFn: listSubjects });

  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function generateCode(subjectName: string): string {
    return subjectName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  }

  const createMutation = useMutation({
    mutationFn: createSubject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      setName("");
      setError("");
    },
    onError: (err) => setError(err instanceof Error ? err.message : t("admin.subjects.createFailed")),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name) {
      setError(t("admin.common.nameRequired"));
      return;
    }
    const code = generateCode(name);
    createMutation.mutate({ name, code });
  }

  const columns: Column<Subject>[] = [
    { header: t("admin.common.name"), cell: (s) => te("subject", s.name) },
    { header: t("admin.common.code"), cell: (s) => s.code },
  ];

  return (
    <div>
      <PageHeader title={t("admin.subjects.title")} subtitle={t("admin.subjects.subtitle")} />

      <Card className="mb-6">
        <h2 className="mb-4 text-sm font-semibold text-ink">{t("admin.subjects.createTitle")}</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
          <div>
            <Label htmlFor="sub-name">{t("admin.common.name")}</Label>
            <Input id="sub-name" placeholder={t("admin.subjects.namePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
            {name && <p className="mt-1 text-xs text-accent-fg">{t("admin.subjects.codeWillBe", { code: generateCode(name) })}</p>}
          </div>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? t("admin.common.creating") : t("admin.common.create")}
          </Button>
        </form>
        <ErrorText>{error}</ErrorText>
      </Card>

      <DataTable columns={columns} rows={subjects ?? []} isLoading={isLoading} rowKey={(s) => s.id} emptyLabel={t("admin.subjects.empty")} />
    </div>
  );
}
