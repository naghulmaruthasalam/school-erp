import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, ErrorText, Input, Label, PageHeader } from "../../../components/ui";
import { DataTable, type Column } from "../../../components/DataTable";
import { createClass, listAcademicYears, listClasses } from "./api";
import type { SchoolClass } from "./types";

export default function ClassList() {
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
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to create class."),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!academicYearId || !name) {
      setError("Academic year and name are required.");
      return;
    }
    createMutation.mutate({ academic_year_id: academicYearId, name, order: Number(order) || 0 });
  }

  const columns: Column<SchoolClass>[] = [
    { header: "Name", cell: (c) => c.name },
    { header: "Order", cell: (c) => c.order },
  ];

  return (
    <div>
      <PageHeader title="Classes" subtitle="Classes are scoped to an academic year." />

      <Card className="mb-6">
        <div className="mb-4">
          <Label htmlFor="cl-year">Academic Year</Label>
          <select
            id="cl-year"
            className="w-full max-w-xs rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            value={academicYearId}
            onChange={(e) => setAcademicYearId(e.target.value)}
          >
            <option value="" disabled>
              Select academic year
            </option>
            {(years ?? []).map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
                {y.is_current ? " (current)" : ""}
              </option>
            ))}
          </select>
        </div>

        <h2 className="mb-4 text-sm font-semibold text-ink">Create Class</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
          <div>
            <Label htmlFor="cl-name">Name</Label>
            <Input id="cl-name" placeholder="Class 9" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cl-order">Order</Label>
            <Input id="cl-order" type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
          </div>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating…" : "Create"}
          </Button>
        </form>
        <ErrorText>{error}</ErrorText>
      </Card>

      <DataTable columns={columns} rows={classes ?? []} isLoading={isLoading} rowKey={(c) => c.id} emptyLabel="No classes for this academic year yet." />
    </div>
  );
}
