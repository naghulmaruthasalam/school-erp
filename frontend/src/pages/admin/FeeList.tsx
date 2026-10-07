import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, PageHeader, Spinner, Badge, StatTile } from "../../components/ui";
import FeesNav from "./fees/FeesNav";
import { api } from "../../api/client";
import { fetchPendingFees } from "./api";
import type { PageResponse } from "../../types/common";

interface Invoice {
  id: string;
  student_id: string;
  student_name: string;
  invoice_number: string;
  total_amount: number;
  paid_amount: number;
  due_date: string;
  status: string;
}

interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  transaction_id: string | null;
}

export default function FeeList() {
  const [activeTab, setActiveTab] = useState<"invoices" | "payments">("invoices");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const summaryQuery = useQuery({ queryKey: ["fee-summary"], queryFn: fetchPendingFees });

  const invoicesQuery = useQuery({
    queryKey: ["invoices", statusFilter],
    queryFn: async () => {
      const { data } = await api.get<PageResponse<Invoice>>("/fees/invoices", {
        params: statusFilter ? { status: statusFilter } : undefined,
      });
      return data;
    },
  });

  const paymentsQuery = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data } = await api.get<PageResponse<Payment>>("/payments");
      return data;
    },
    enabled: activeTab === "payments",
  });

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Fee Management" subtitle="Invoices, payments, and collection tracking" />
      <FeesNav />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile
          label="Total Due"
          value={summaryQuery.isLoading ? <Spinner /> : `₹${((summaryQuery.data?.total_due ?? 0) / 1000).toFixed(0)}K`}
        />
        <StatTile
          label="Total Collected"
          value={summaryQuery.isLoading ? <Spinner /> : `₹${((summaryQuery.data?.total_paid ?? 0) / 1000).toFixed(0)}K`}
        />
        <StatTile
          label="Pending"
          value={summaryQuery.isLoading ? <Spinner /> : `₹${((summaryQuery.data?.total_pending ?? 0) / 1000).toFixed(0)}K`}
        />
        <StatTile
          label="Overdue Invoices"
          value={summaryQuery.isLoading ? <Spinner /> : summaryQuery.data?.overdue_count ?? 0}
          hint="Need follow-up"
        />
      </div>

      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab("invoices")}
            className={`px-4 py-2 rounded-lg font-medium ${activeTab === "invoices" ? "bg-violet-600 text-white" : "text-accent-fg"}`}
          >
            Invoices
          </button>
          <button
            onClick={() => setActiveTab("payments")}
            className={`px-4 py-2 rounded-lg font-medium ${activeTab === "payments" ? "bg-violet-600 text-white" : "text-accent-fg"}`}
          >
            Payments
          </button>
          {activeTab === "invoices" && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="ml-auto rounded-lg border border-line px-3 py-2 text-sm focus:border-violet-500"
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIALLY_PAID">Partially paid</option>
              <option value="PAID">Paid</option>
              <option value="OVERDUE">Overdue</option>
            </select>
          )}
        </div>
      </Card>

      {activeTab === "invoices" && (
        invoicesQuery.isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <div className="space-y-3">
            {invoicesQuery.data?.items.map((inv) => (
              <Card key={inv.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-accent-fg">{inv.invoice_number}</span>
                      <Badge tone={inv.status === "PAID" ? "green" : inv.status === "OVERDUE" ? "red" : inv.status === "CANCELLED" ? "gray" : "yellow"}>{inv.status}</Badge>
                    </div>
                    <p className="font-medium text-ink">{inv.student_name}</p>
                    <p className="text-xs text-accent-fg">Due: {new Date(inv.due_date).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <Link to={`/admin/fees/invoices/${inv.id}`} className="text-xs font-medium text-accent-fg hover:underline">View / record payment</Link>
                    <p className="text-lg font-semibold text-ink">₹{inv.total_amount.toLocaleString()}</p>
                    <p className="text-sm text-green-600">Paid: ₹{inv.paid_amount.toLocaleString()}</p>
                    {inv.total_amount - inv.paid_amount > 0 && (
                      <p className="text-sm text-red-600">Due: ₹{(inv.total_amount - inv.paid_amount).toLocaleString()}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            {invoicesQuery.data?.items.length === 0 && (
              <Card><p className="text-center text-accent-fg py-8">No invoices found.</p></Card>
            )}
          </div>
        )
      )}

      {activeTab === "payments" && (
        paymentsQuery.isLoading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : (
          <div className="space-y-3">
            {paymentsQuery.data?.items.map((p) => (
              <Card key={p.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-ink">₹{p.amount.toLocaleString()}</p>
                    <p className="text-sm text-accent-fg">{p.payment_method}</p>
                    {p.transaction_id && <p className="text-xs text-accent-fg">Txn: {p.transaction_id}</p>}
                  </div>
                  <p className="text-sm text-accent-fg">{new Date(p.payment_date).toLocaleDateString()}</p>
                </div>
              </Card>
            ))}
            {paymentsQuery.data?.items.length === 0 && (
              <Card><p className="text-center text-accent-fg py-8">No payments found.</p></Card>
            )}
          </div>
        )
      )}
    </div>
  );
}
