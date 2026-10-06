import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader } from "../../../components/ui";
import { DataTable, type Column } from "../../../components/DataTable";
import {
  createFeeAssignment,
  createInvoice,
  listFeeAssignments,
  listFeeCategories,
  listFeeStructures,
  listInvoices,
  searchStudents,
} from "./api";
import type { FeeAssignment, Invoice, InvoiceStatus, StudentLite } from "./types";

const STATUS_TONES: Record<InvoiceStatus, "gray" | "green" | "red" | "yellow"> = {
  PENDING: "yellow",
  PARTIALLY_PAID: "yellow",
  PAID: "green",
  OVERDUE: "red",
  CANCELLED: "gray",
};

export default function FeeOverview() {
  const queryClient = useQueryClient();

  const [nameInput, setNameInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ["student-search", searchTerm],
    queryFn: () => searchStudents(searchTerm),
    enabled: searchTerm.length > 0,
  });

  const [student, setStudent] = useState<StudentLite | null>(null);

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    setSearchTerm(nameInput.trim());
  }

  const { data: assignments } = useQuery({
    queryKey: ["fee-assignments", student?.id],
    queryFn: () => listFeeAssignments(student!.id),
    enabled: !!student,
  });

  const { data: structures } = useQuery({
    queryKey: ["fee-structures", student?.academic_year_id, student?.class_id],
    queryFn: () => listFeeStructures({ academic_year_id: student!.academic_year_id, class_id: student!.class_id }),
    enabled: !!student,
  });

  const { data: categories } = useQuery({ queryKey: ["fee-categories"], queryFn: listFeeCategories });

  const { data: invoicesPage, isLoading: invoicesLoading } = useQuery({
    queryKey: ["invoices", student?.id],
    queryFn: () => listInvoices({ student_id: student!.id, page_size: 50 }),
    enabled: !!student,
  });

  // Assign fee structure form
  const [feeStructureId, setFeeStructureId] = useState("");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  const [assignError, setAssignError] = useState("");

  const assignMutation = useMutation({
    mutationFn: createFeeAssignment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fee-assignments", student?.id] });
      setFeeStructureId("");
      setDiscountAmount("0");
      setDiscountReason("");
      setAssignError("");
    },
    onError: (err) => setAssignError(err instanceof Error ? err.message : "Failed to assign fee structure."),
  });

  function handleAssign(e: FormEvent) {
    e.preventDefault();
    if (!student || !feeStructureId) {
      setAssignError("Select a fee structure.");
      return;
    }
    assignMutation.mutate({
      student_id: student.id,
      fee_structure_id: feeStructureId,
      discount_amount: Number(discountAmount) || 0,
      discount_reason: discountReason || null,
    });
  }

  // Invoice creation
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [invoiceError, setInvoiceError] = useState("");

  const invoiceMutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices", student?.id] });
      setSelectedAssignmentIds([]);
      setDueDate("");
      setInvoiceError("");
    },
    onError: (err) => setInvoiceError(err instanceof Error ? err.message : "Failed to create invoice."),
  });

  function toggleAssignment(id: string) {
    setSelectedAssignmentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleCreateInvoice() {
    if (!student || selectedAssignmentIds.length === 0 || !dueDate) {
      setInvoiceError("Select at least one fee assignment and a due date.");
      return;
    }
    invoiceMutation.mutate({
      student_id: student.id,
      academic_year_id: student.academic_year_id,
      fee_assignment_ids: selectedAssignmentIds,
      due_date: dueDate,
    });
  }

  const categoryName = (id: string) => categories?.find((c) => c.id === id)?.name ?? id;
  const structureLabel = (id: string) => {
    const s = structures?.find((st) => st.id === id);
    return s ? `${categoryName(s.category_id)} · ₹${s.amount.toLocaleString()} (${s.frequency})` : id;
  };

  const assignmentColumns: Column<FeeAssignment>[] = [
    {
      header: "",
      cell: (a) => (
        <input type="checkbox" checked={selectedAssignmentIds.includes(a.id)} onChange={() => toggleAssignment(a.id)} />
      ),
    },
    { header: "Fee Structure", cell: (a) => structureLabel(a.fee_structure_id) },
    { header: "Discount", cell: (a) => (a.discount_amount > 0 ? `₹${a.discount_amount.toLocaleString()}` : "—") },
    { header: "Final Amount", cell: (a) => `₹${a.final_amount.toLocaleString()}` },
  ];

  const invoiceColumns: Column<Invoice>[] = [
    { header: "Due Date", cell: (i) => i.due_date },
    { header: "Total", cell: (i) => `₹${i.total_amount.toLocaleString()}` },
    { header: "Paid", cell: (i) => `₹${i.amount_paid.toLocaleString()}` },
    { header: "Outstanding", cell: (i) => `₹${i.outstanding_amount.toLocaleString()}` },
    { header: "Status", cell: (i) => <Badge tone={STATUS_TONES[i.status]}>{i.status}</Badge> },
    {
      header: "",
      cell: (i) => (
        <Link to={`/admin/fees/invoices/${i.id}`} className="text-violet-600 hover:underline">
          View
        </Link>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Fee Overview" subtitle="Look up a student to assign fees, raise invoices and track payments." />

      <Card className="mb-6">
        <h2 className="mb-4 text-sm font-semibold text-violet-900">Find Student</h2>
        <form onSubmit={handleSearch} className="flex items-end gap-4">
          <div className="flex-1 max-w-sm">
            <Label htmlFor="student-search">Student Name</Label>
            <Input
              id="student-search"
              placeholder="Kiran Kumar"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={isSearching}>
            {isSearching ? "Searching…" : "Search"}
          </Button>
        </form>

        {searchTerm && (
          <div className="mt-4 space-y-1">
            {(searchResults ?? []).length === 0 && !isSearching && (
              <p className="text-sm text-violet-400">No students found.</p>
            )}
            {(searchResults ?? []).map((s) => (
              <button
                key={s.id}
                onClick={() => setStudent(s)}
                className={`block w-full rounded-md border px-3 py-2 text-left text-sm ${
                  student?.id === s.id ? "border-indigo-500 bg-violet-50" : "border-violet-200 hover:bg-violet-50"
                }`}
              >
                {s.full_name} <span className="text-violet-400">({s.admission_no})</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {student && (
        <>
          <Card className="mb-6">
            <h2 className="mb-4 text-sm font-semibold text-violet-900">
              Assign Fee Structure — {student.full_name}
            </h2>
            <form onSubmit={handleAssign} className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end">
              <div className="sm:col-span-2">
                <Label htmlFor="assign-structure">Fee Structure</Label>
                <select
                  id="assign-structure"
                  className="w-full rounded-md border border-violet-300 px-3 py-2 text-sm text-violet-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  value={feeStructureId}
                  onChange={(e) => setFeeStructureId(e.target.value)}
                >
                  <option value="">Select</option>
                  {(structures ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {structureLabel(s.id)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="assign-discount">Discount</Label>
                <Input
                  id="assign-discount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="assign-reason">Discount Reason</Label>
                <Input id="assign-reason" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} />
              </div>
              <Button type="submit" disabled={assignMutation.isPending}>
                {assignMutation.isPending ? "Assigning…" : "Assign"}
              </Button>
            </form>
            <ErrorText>{assignError}</ErrorText>

            <div className="mt-4">
              <DataTable
                columns={assignmentColumns}
                rows={assignments ?? []}
                rowKey={(a) => a.id}
                emptyLabel="No fee assignments for this student yet."
              />
            </div>

            <div className="mt-4 flex items-end gap-4">
              <div>
                <Label htmlFor="invoice-due-date">Invoice Due Date</Label>
                <Input id="invoice-due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <Button
                variant="secondary"
                onClick={handleCreateInvoice}
                disabled={invoiceMutation.isPending || selectedAssignmentIds.length === 0}
              >
                {invoiceMutation.isPending ? "Creating…" : "Create Invoice From Selected"}
              </Button>
            </div>
            <ErrorText>{invoiceError}</ErrorText>
          </Card>

          <Card>
            <h2 className="mb-4 text-sm font-semibold text-violet-900">Invoices — {student.full_name}</h2>
            <DataTable
              columns={invoiceColumns}
              rows={invoicesPage?.items ?? []}
              isLoading={invoicesLoading}
              rowKey={(i) => i.id}
              emptyLabel="No invoices yet."
            />
          </Card>
        </>
      )}
    </div>
  );
}
