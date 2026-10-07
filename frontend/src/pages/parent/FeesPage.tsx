import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Badge, Card, ErrorText, PageHeader, Spinner } from "../../components/ui";
import { DataTable } from "../../components/DataTable";
import { Button } from "../../components/ui";
import { fetchInvoices, initiatePayUPayment } from "./api";
import { formatDisplayDate } from "./dates";
import { useSelectedChild } from "./SelectedChildContext";
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
        <PageHeader title="Fees" />
        <p className="text-sm text-accent-fg">Select a child above to view fees.</p>
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
      setPayError("Could not start the payment. Online payments may not be configured for this school yet — please pay at the school office.");
      setPayingInvoiceId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Fees"
        subtitle={`Invoices for ${child.full_name}. Total outstanding: ₹${totalOutstanding.toFixed(2)}.`}
      />

      {invoicesQuery.error && <ErrorText>Could not load invoices.</ErrorText>}
      {payError && <ErrorText>{payError}</ErrorText>}
      {banner === "success" && (
        <Card className="mb-4 border-green-200 bg-green-50">
          <p className="text-sm text-green-700">Payment successful — thank you!</p>
        </Card>
      )}
      {banner === "failed" && (
        <Card className="mb-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-700">Payment was not completed. Please try again.</p>
        </Card>
      )}

      {invoicesQuery.isLoading ? (
        <Spinner />
      ) : (
        <DataTable<InvoiceOut>
          columns={[
            { header: "Due Date", cell: (r) => formatDisplayDate(r.due_date) },
            { header: "Total Amount", cell: (r) => `₹${r.total_amount.toFixed(2)}` },
            { header: "Paid", cell: (r) => `₹${r.amount_paid.toFixed(2)}` },
            { header: "Outstanding", cell: (r) => `₹${r.outstanding_amount.toFixed(2)}` },
            { header: "Status", cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status.replace("_", " ")}</Badge> },
            {
              header: "",
              cell: (r) =>
                r.outstanding_amount > 0 && r.status !== "CANCELLED" ? (
                  <Button onClick={() => handlePayNow(r)} disabled={payingInvoiceId === r.id}>
                    {payingInvoiceId === r.id ? "Redirecting…" : "Pay Now"}
                  </Button>
                ) : null,
            },
          ]}
          rows={invoices}
          isLoading={invoicesQuery.isLoading}
          rowKey={(r) => r.id}
          emptyLabel="No invoices found for this child."
        />
      )}
    </div>
  );
}
