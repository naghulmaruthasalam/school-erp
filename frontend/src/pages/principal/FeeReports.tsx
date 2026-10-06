import { useQuery } from "@tanstack/react-query";
import { Card, ErrorText, PageHeader, Spinner } from "../../components/ui";
import { ClassFeeBarChart, FeeCollectionBarChart } from "../../components/Charts";
import { api } from "../../api/client";
import { fetchFeeCollection } from "./api";

interface FeeStats {
  total_expected: number;
  total_collected: number;
  total_pending: number;
  collection_percentage: number;
}

interface ClassFees {
  name: string;
  billed: number;
  collected: number;
  pending: number;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);

export default function FeeReports() {
  const statsQuery = useQuery({
    queryKey: ["fee-stats"],
    queryFn: async () => (await api.get<FeeStats>("/fees/stats")).data,
  });
  const monthlyQuery = useQuery({ queryKey: ["fee-collection", 6], queryFn: () => fetchFeeCollection(6) });
  const classQuery = useQuery({
    queryKey: ["fee-by-class"],
    queryFn: async () => (await api.get<ClassFees[]>("/analytics/fee-by-class")).data,
  });

  const stats = statsQuery.data;

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Fee Reports" subtitle="View fee collection statistics and reports" />

      {statsQuery.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : statsQuery.isError || !stats ? (
        <ErrorText>Fee statistics could not be loaded. Please refresh to try again.</ErrorText>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <p className="text-sm font-medium text-ink-3">Total Expected</p>
              <p className="tabular mt-1 text-2xl font-semibold text-ink">{formatCurrency(stats.total_expected)}</p>
            </Card>
            <Card>
              <p className="text-sm font-medium text-ink-3">Collected</p>
              <p className="tabular mt-1 text-2xl font-semibold text-green-600 dark:text-green-400">{formatCurrency(stats.total_collected)}</p>
            </Card>
            <Card>
              <p className="text-sm font-medium text-ink-3">Pending</p>
              <p className="tabular mt-1 text-2xl font-semibold text-red-600 dark:text-red-400">{formatCurrency(stats.total_pending)}</p>
            </Card>
            <Card>
              <p className="text-sm font-medium text-ink-3">Collection Rate</p>
              <p className="tabular mt-1 text-2xl font-semibold text-accent-fg">{stats.collection_percentage.toFixed(1)}%</p>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card>
              <h3 className="mb-4 font-semibold text-ink">Collection by Month</h3>
              {monthlyQuery.isLoading ? (
                <div className="flex h-64 items-center justify-center"><Spinner /></div>
              ) : monthlyQuery.data && monthlyQuery.data.length > 0 ? (
                <FeeCollectionBarChart data={monthlyQuery.data} height={260} />
              ) : (
                <p className="flex h-64 items-center justify-center text-sm text-ink-3">No payments recorded yet.</p>
              )}
            </Card>
            <Card>
              <h3 className="mb-4 font-semibold text-ink">Class-wise Collection</h3>
              {classQuery.isLoading ? (
                <div className="flex h-64 items-center justify-center"><Spinner /></div>
              ) : classQuery.data && classQuery.data.length > 0 ? (
                <ClassFeeBarChart data={classQuery.data} height={260} />
              ) : (
                <p className="flex h-64 items-center justify-center text-sm text-ink-3">No invoices raised yet.</p>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
