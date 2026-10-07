import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button, Card, ErrorText, Input, Label, PageHeader } from "../../../components/ui";
import { DataTable, type Column } from "../../../components/DataTable";
import { createSubject, listSubjects } from "./api";
import type { Subject } from "./types";

export default function SubjectList() {
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
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to create subject."),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name) {
      setError("Name is required.");
      return;
    }
    const code = generateCode(name);
    createMutation.mutate({ name, code });
  }

  const columns: Column<Subject>[] = [
    { header: "Name", cell: (s) => s.name },
    { header: "Code", cell: (s) => s.code },
  ];

  return (
    <div>
      <PageHeader title="Subjects" subtitle="School-wide subject catalog." />

      <Card className="mb-6">
        <h2 className="mb-4 text-sm font-semibold text-ink">Create Subject</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
          <div>
            <Label htmlFor="sub-name">Name</Label>
            <Input id="sub-name" placeholder="Mathematics" value={name} onChange={(e) => setName(e.target.value)} />
            {name && <p className="mt-1 text-xs text-accent-fg">Code will be: {generateCode(name)}</p>}
          </div>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating…" : "Create"}
          </Button>
        </form>
        <ErrorText>{error}</ErrorText>
      </Card>

      <DataTable columns={columns} rows={subjects ?? []} isLoading={isLoading} rowKey={(s) => s.id} emptyLabel="No subjects yet." />
    </div>
  );
}
