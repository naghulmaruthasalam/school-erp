import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Badge, Card, ErrorText, PageHeader, Spinner } from "../../components/ui";
import { DataTable } from "../../components/DataTable";
import { Button } from "../../components/ui";
import { fetchInvoices, initiatePayUPayment } from "./api";
import { formatDisplayDate } from "./dates";
import { useSelectedChild } from "./SelectedChildContext";
import { useLanguage } from "../../i18n/LanguageContext";
import type { InvoiceOut, InvoiceStatus, PayUInitiateResponse } from "./types";

const STATUS_TONE: Record<InvoiceStatus, "green" | "red" | "yellow" | "gray"> = {
  PAID: "green",
  PENDING: "yellow",
  PARTIALLY_PAID: "yellow",
  OVERDUE: "red",
  CANCELLED: "gray",
};

/** Builds a hidden HTML form and submits it — PayU's classic checkout is a
 * plain browser redirect via form POST to their hosted page, not a JS SDK
 * modal, so this navigates the whole page away (the user comes back via
 * PayU's surl/furl, which our backend turns into a redirect to this page
 * with `?payment=success|failed` in the URL). */
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

function usePaymentReturnBanner(queryKeyPrefix: unknown[]) {
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState<"success" | "failed" | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("payment");
    if (result === "success" || result === "failed") {
      setBanner(result);
      queryClient.invalidateQueries({ queryKey: queryKeyPrefix });
      // Strip the query string so a page refresh doesn't re-show the banner.
      const url = new URL(window.location.href);
      url.search = "";
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return banner;
}

export default function FeesPage() {
  const { t, te } = useLanguage();
  const { selectedChild, selectedChildId } = useSelectedChild();
  const [payingInvoiceId, setPayingInvoiceId] = useState<string | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const banner = usePaymentReturnBanner(["parent", "invoices", selectedChildId]);

  const invoicesQuery = useQuery({
    queryKey: ["parent", "invoices", selectedChildId],
    queryFn: () => fetchInvoices({ student_id: selectedChildId as string, page_size: 200 }),
    enabled: !!selectedChildId,
  });

  if (!selectedChild) {
    return (
      <div>
        <PageHeader title={t("navigation.fees")} />
        <p className="text-sm text-accent-fg">{t("parent.fees.selectChild")}</p>
      </div>
    );
  }

  const child = selectedChild;
  const invoices = Array.isArray(invoicesQuery.data?.items) ? invoicesQuery.data.items : [];
  const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.outstanding_amount ?? 0), 0);

  async function handlePayNow(invoice: InvoiceOut) {
    setPayError(null);
    setPayingInvoiceId(invoice.id);
    try {
      const payu = await initiatePayUPayment({
        invoice_id: invoice.id,
        amount: invoice.outstanding_amount,
        return_path: "/parent/fees",
      });
      submitPayUForm(payu); // navigates the browser to PayU — nothing runs after this
    } catch {
      setPayError(t("parent.fees.payFailed"));
      setPayingInvoiceId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title={t("navigation.fees")}
        subtitle={t("parent.fees.subtitle", { name: child.full_name, total: `₹${totalOutstanding.toFixed(2)}` })}
      />

      {invoicesQuery.error && <ErrorText>{t("parent.fees.loadError")}</ErrorText>}
      {payError && <ErrorText>{payError}</ErrorText>}
      {banner === "success" && (
        <Card className="mb-4 border-green-200 bg-green-50">
          <p className="text-sm text-green-700">{t("parent.fees.paymentSuccess")}</p>
        </Card>
      )}
      {banner === "failed" && (
        <Card className="mb-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">{t("parent.fees.paymentFailed")}</p>
        </Card>
      )}

      {invoicesQuery.isLoading ? (
        <Spinner />
      ) : (
        <DataTable<InvoiceOut>
          columns={[
            { header: t("parent.fees.dueDate"), cell: (r) => formatDisplayDate(r.due_date) },
            { header: t("parent.fees.totalAmount"), cell: (r) => `₹${r.total_amount.toFixed(2)}` },
            { header: t("parent.fees.paid"), cell: (r) => `₹${r.amount_paid.toFixed(2)}` },
            { header: t("parent.fees.outstanding"), cell: (r) => `₹${r.outstanding_amount.toFixed(2)}` },
            { header: t("parent.fees.status"), cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{te("status", r.status.replace("_", " "))}</Badge> },
            {
              header: "",
              cell: (r) =>
                r.outstanding_amount > 0 && r.status !== "CANCELLED" ? (
                  <Button onClick={() => handlePayNow(r)} disabled={payingInvoiceId === r.id}>
                    {payingInvoiceId === r.id ? t("parent.fees.redirecting") : t("parent.fees.payNow")}
                  </Button>
                ) : null,
            },
          ]}
          rows={invoices}
          isLoading={invoicesQuery.isLoading}
          rowKey={(r) => r.id}
          emptyLabel={t("parent.fees.empty")}
        />
      )}
    </div>
  );
}
