import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button, Card, ErrorText, Input, Label, PageHeader } from "../../../components/ui";
import FeesNav from "./FeesNav";
import { DataTable, type Column } from "../../../components/DataTable";
import { createFeeCategory, listFeeCategories } from "./api";
import type { FeeCategory } from "./types";

export default function FeeCategoryList() {
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
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to create fee category."),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name) {
      setError("Name is required.");
      return;
    }
    createMutation.mutate({ name, description: description || null });
  }

  const columns: Column<FeeCategory>[] = [
    { header: "Name", cell: (c) => c.name },
    { header: "Description", cell: (c) => c.description ?? "—" },
  ];

  return (
    <div>
      <PageHeader title="Fee Categories" subtitle="Tuition, transport, hostel, etc." />
      <FeesNav />

      <Card className="mb-6">
        <h2 className="mb-4 text-sm font-semibold text-ink">Create Fee Category</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
          <div>
            <Label htmlFor="fc-name">Name</Label>
            <Input id="fc-name" placeholder="Tuition Fee" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="fc-desc">Description</Label>
            <Input id="fc-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating…" : "Create"}
          </Button>
        </form>
        <ErrorText>{error}</ErrorText>
      </Card>

      <DataTable columns={columns} rows={categories ?? []} isLoading={isLoading} rowKey={(c) => c.id} emptyLabel="No fee categories yet." />
    </div>
  );
}
