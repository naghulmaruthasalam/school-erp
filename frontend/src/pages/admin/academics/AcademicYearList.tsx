import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader } from "../../../components/ui";
import { DataTable, type Column } from "../../../components/DataTable";
import { createAcademicYear, listAcademicYears, setCurrentAcademicYear } from "./api";
import type { AcademicYear } from "./types";

export default function AcademicYearList() {
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
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to create academic year."),
  });

  const setCurrentMutation = useMutation({
    mutationFn: setCurrentAcademicYear,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["academic-years"] }),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name || !startDate || !endDate) {
      setError("Name, start date and end date are required.");
      return;
    }
    createMutation.mutate({ name, start_date: startDate, end_date: endDate, is_current: isCurrent });
  }

  const columns: Column<AcademicYear>[] = [
    { header: "Name", cell: (y) => y.name },
    { header: "Start Date", cell: (y) => y.start_date },
    { header: "End Date", cell: (y) => y.end_date },
    { header: "Status", cell: (y) => (y.is_current ? <Badge tone="green">Current</Badge> : <Badge>Inactive</Badge>) },
    {
      header: "Actions",
      cell: (y) =>
        !y.is_current && (
          <Button
            variant="secondary"
            className="px-2! py-1! text-xs"
            disabled={setCurrentMutation.isPending}
            onClick={() => setCurrentMutation.mutate(y.id)}
          >
            Set Current
          </Button>
        ),
    },
  ];

  return (
    <div>
      <PageHeader title="Academic Years" subtitle="Create and manage academic years for your school." />

      <Card className="mb-6">
        <h2 className="mb-4 text-sm font-semibold text-ink">Create Academic Year</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end">
          <div>
            <Label htmlFor="ay-name">Name</Label>
            <Input id="ay-name" placeholder="2027-2028" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ay-start">Start Date</Label>
            <Input id="ay-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ay-end">End Date</Label>
            <Input id="ay-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" checked={isCurrent} onChange={(e) => setIsCurrent(e.target.checked)} />
              Set as current
            </label>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </div>
        </form>
        <ErrorText>{error}</ErrorText>
      </Card>

      <DataTable columns={columns} rows={years ?? []} isLoading={isLoading} rowKey={(y) => y.id} emptyLabel="No academic years yet." />
    </div>
  );
}
