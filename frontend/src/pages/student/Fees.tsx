import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Badge, Button, Card, ErrorText, PageHeader, StatTile } from "../../components/ui";
import { DataTable, type Column } from "../../components/DataTable";
import { useLanguage } from "../../i18n/LanguageContext";
import { fetchInvoices, initiatePayUPayment } from "./api";
import type { Invoice, InvoiceStatus, PayUInitiateResponse } from "./types";

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

const STATUS_TONE: Record<InvoiceStatus, "green" | "red" | "yellow" | "gray"> = {
  PENDING: "yellow",
  PARTIALLY_PAID: "yellow",
  PAID: "green",
  OVERDUE: "red",
  CANCELLED: "gray",
};

/** Builds a hidden HTML form and submits it — PayU's classic checkout is a
 * plain browser redirect via form POST to their hosted page, not a JS SDK
 * modal. The browser comes back here via PayU's surl/furl, which our backend
 * turns into a redirect with `?payment=success|failed` in the URL. */
function submitPayUForm(payu: PayUInitiateResponse) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = payu.action_url;

  const fields: Record<string, string> = {
    key: payu.key,
    txnid: payu.txnid,
    amount: payu.amount,
    productinfo: payu.productinfo,
    firstname: payu.firstname,
    email: payu.email,
    phone: payu.phone,
    surl: payu.surl,
    furl: payu.furl,
    hash: payu.hash,
  };

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}

function usePaymentReturnBanner() {
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState<"success" | "failed" | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("payment");
    if (result === "success" || result === "failed") {
      setBanner(result);
      queryClient.invalidateQueries({ queryKey: ["student", "invoices"] });
      const url = new URL(window.location.href);
      url.search = "";
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return banner;
}

function PayNowButton({ invoice }: { invoice: Invoice }) {
  const { t } = useLanguage();
  const [error, setError] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  async function handlePay() {
    setError("");
    setIsPaying(true);
    try {
      const payu = await initiatePayUPayment({
        invoice_id: invoice.id,
        amount: invoice.outstanding_amount,
        return_path: "/student/fees",
      });
      submitPayUForm(payu); // navigates the browser to PayU — nothing runs after this
    } catch {
      setError(t("student.fees.payError"));
      setIsPaying(false);
    }
  }

  return (
    <div>
      <Button onClick={handlePay} disabled={isPaying}>
        {isPaying ? t("student.fees.redirecting") : t("fees.payNow")}
      </Button>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

export default function StudentFees() {
  const { t, te, fmtDate } = useLanguage();
  const banner = usePaymentReturnBanner();

  const invoicesQuery = useQuery({
    queryKey: ["student", "invoices"],
    queryFn: () => fetchInvoices(),
  });

  const invoices = invoicesQuery.data?.items ?? [];
  const totalOutstanding = invoices.reduce((sum, inv) => sum + inv.outstanding_amount, 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.amount_paid, 0);

  const columns: Column<Invoice>[] = [
    { header: t("fees.dueDate"), cell: (row) => fmtDate(row.due_date) },
    { header: t("student.fees.total"), cell: (row) => formatCurrency(row.total_amount) },
    { header: t("fees.paid"), cell: (row) => formatCurrency(row.amount_paid) },
    { header: t("student.fees.outstanding"), cell: (row) => formatCurrency(row.outstanding_amount) },
    {
      header: t("fees.status"),
      cell: (row) => (
        <Badge tone={STATUS_TONE[row.status]}>
          {row.status === "PARTIALLY_PAID" ? t("fees.partiallyPaid") : te("status", row.status.replace("_", " "))}
        </Badge>
      ),
    },
    {
      header: "",
      cell: (row) =>
        row.outstanding_amount > 0 && row.status !== "CANCELLED" ? <PayNowButton invoice={row} /> : null,
    },
  ];

  return (
    <div>
      <PageHeader title={t("navigation.fees")} subtitle={t("student.fees.subtitle")} />

      {banner === "success" && (
        <Card className="mb-4 border-green-200 bg-green-50">
          <p className="text-sm text-green-700">{t("student.fees.paySuccess")}</p>
        </Card>
      )}
      {banner === "failed" && (
        <Card className="mb-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{t("student.fees.payFailed")}</p>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile label={t("student.fees.outstanding")} value={formatCurrency(totalOutstanding)} />
        <StatTile label={t("student.fees.paidToDate")} value={formatCurrency(totalPaid)} />
        <StatTile label={t("student.fees.invoices")} value={invoices.length} />
      </div>

      <DataTable
        columns={columns}
        rows={invoices}
        isLoading={invoicesQuery.isLoading}
        rowKey={(row) => row.id}
        emptyLabel={t("student.fees.empty")}
      />
    </div>
  );
}
