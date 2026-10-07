import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Spinner, StatTile } from "../../../components/ui";
import { DataTable } from "../../../components/DataTable";
import { getInvoice, initiateRefund, listInvoicePayments, recordManualPayment } from "./api";
import { useLanguage } from "../../../i18n/LanguageContext";
import type { InvoiceStatus, Payment, PaymentMethod, PaymentStatus } from "./types";

const STATUS_TONES: Record<InvoiceStatus, "gray" | "green" | "red" | "yellow"> = {
  PENDING: "yellow",
  PARTIALLY_PAID: "yellow",
  PAID: "green",
  OVERDUE: "red",
  CANCELLED: "gray",
};

const PAYMENT_STATUS_TONES: Record<PaymentStatus, "gray" | "green" | "red" | "yellow"> = {
  CREATED: "gray",
  SUCCESS: "green",
  FAILED: "red",
  REFUND_PENDING: "yellow",
  REFUNDED: "gray",
  REFUND_FAILED: "red",
};

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "CHEQUE", "BANK_TRANSFER"];

function RefundButton({ payment, invoiceId }: { payment: Payment; invoiceId: string }) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(payment.amount));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const refundMutation = useMutation({
    mutationFn: () => initiateRefund({ payment_id: payment.id, amount: Number(amount), reason: reason || null }),
    onSuccess: () => {
      setOpen(false);
      setError("");
      queryClient.invalidateQueries({ queryKey: ["invoice-payments", invoiceId] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : t("admin.invoice.refundFailed")),
  });

  if (payment.method !== "PAYU" || payment.status !== "SUCCESS") return null;

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t("admin.invoice.refund")}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-violet-50 p-3">
      <Label htmlFor={`refund-amount-${payment.id}`}>{t("admin.invoice.refundAmount")}</Label>
      <Input
        id={`refund-amount-${payment.id}`}
        type="number"
        min={0}
        max={payment.amount}
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <Label htmlFor={`refund-reason-${payment.id}`}>{t("admin.invoice.reasonOptional")}</Label>
      <Input id={`refund-reason-${payment.id}`} value={reason} onChange={(e) => setReason(e.target.value)} />
      <ErrorText>{error}</ErrorText>
      <div className="flex gap-2">
        <Button
          variant="danger"
          onClick={() => refundMutation.mutate()}
          disabled={refundMutation.isPending || !amount || Number(amount) <= 0}
        >
          {refundMutation.isPending ? t("admin.invoice.initiating") : t("admin.invoice.confirmRefund")}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          {t("admin.common.cancel")}
        </Button>
      </div>
    </div>
  );
}

export default function InvoiceDetail() {
  const { t, te, fmtDate, fmtNumber } = useLanguage();
  const optLabel = (prefix: string, v: string) => {
    const k = `${prefix}.${v}`;
    const r = t(k);
    return r === k ? v : r;
  };
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => getInvoice(id!),
    enabled: !!id,
  });

  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ["invoice-payments", id],
    queryFn: () => listInvoicePayments(id!),
    enabled: !!id,
  });

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const paymentMutation = useMutation({
    mutationFn: () => recordManualPayment(id!, { amount: Number(amount), method, note: note || null }),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setAmount("");
      setNote("");
      setError("");
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-payments", id] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : t("admin.invoice.recordFailed")),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setError(t("admin.invoice.invalidAmount"));
      return;
    }
    paymentMutation.mutate();
  }

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!invoice) {
    return <p className="text-sm text-accent-fg">{t("admin.invoice.notFound")}</p>;
  }

  return (
    <div>
      <PageHeader
        title={t("admin.invoice.title", { id: invoice.id.slice(-8).toUpperCase() })}
        subtitle={t("admin.invoice.dueDate", { date: fmtDate(invoice.due_date) })}
        actions={
          <Link to="/admin/fees" className="text-sm text-accent-fg hover:underline">
            {t("admin.invoice.backToOverview")}
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label={t("admin.invoice.totalAmount")} value={`₹${fmtNumber(invoice.total_amount)}`} />
        <StatTile label={t("admin.invoice.amountPaid")} value={`₹${fmtNumber(invoice.amount_paid)}`} />
        <StatTile label={t("admin.invoice.outstanding")} value={`₹${fmtNumber(invoice.outstanding_amount)}`} />
        <StatTile label={t("admin.common.status")} value={<Badge tone={STATUS_TONES[invoice.status]}>{te("status", invoice.status)}</Badge>} />
      </div>

      <Card>
        <h2 className="mb-4 text-sm font-semibold text-ink">{t("admin.invoice.recordManual")}</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end">
          <div>
            <Label htmlFor="pay-amount">{t("admin.common.amount")}</Label>
            <Input
              id="pay-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pay-method">{t("admin.common.method")}</Label>
            <select
              id="pay-method"
              className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {optLabel("admin.paymentMethod", m)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="pay-note">{t("admin.common.note")}</Label>
            <Input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <Button type="submit" disabled={paymentMutation.isPending || invoice.status === "CANCELLED"}>
            {paymentMutation.isPending ? t("admin.invoice.recording") : t("admin.invoice.recordPayment")}
          </Button>
        </form>
        <ErrorText>{error}</ErrorText>
        <p className="mt-3 text-xs text-accent-fg">
          {t("admin.invoice.receiptNote")}
        </p>
      </Card>

      <Card className="mt-6">
        <h2 className="mb-4 text-sm font-semibold text-ink">{t("admin.invoice.paymentsTitle")}</h2>
        <DataTable<Payment>
          columns={[
            { header: t("admin.common.method"), cell: (p) => optLabel("admin.paymentMethod", p.method) },
            { header: t("admin.common.amount"), cell: (p) => `₹${fmtNumber(p.amount)}` },
            {
              header: t("admin.common.status"),
              cell: (p) => <Badge tone={PAYMENT_STATUS_TONES[p.status]}>{optLabel("admin.paymentStatus", p.status)}</Badge>,
            },
            { header: t("admin.invoice.paidAt"), cell: (p) => (p.paid_at ? fmtDate(p.paid_at, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—") },
            { header: "", cell: (p) => <RefundButton payment={p} invoiceId={id!} /> },
          ]}
          rows={payments ?? []}
          isLoading={paymentsLoading}
          rowKey={(p) => p.id}
          emptyLabel={t("admin.invoice.noPayments")}
        />
        <p className="mt-3 text-xs text-accent-fg">
          {t("admin.invoice.refundNote", { status: t("admin.paymentStatus.REFUND_PENDING") })}
        </p>
      </Card>
    </div>
  );
}
