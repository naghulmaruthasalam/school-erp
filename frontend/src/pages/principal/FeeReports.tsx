import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, Spinner } from "../../components/ui";
import { api } from "../../api/client";

interface FeeStats {
  total_expected: number;
  total_collected: number;
  total_pending: number;
  collection_percentage: number;
}

export default function FeeReports() {
  const statsQuery = useQuery({
    queryKey: ["fee-stats"],
    queryFn: async () => {
      try {
        const { data } = await api.get<FeeStats>("/fees/stats");
        return data;
      } catch {
        return { total_expected: 0, total_collected: 0, total_pending: 0, collection_percentage: 0 };
      }
    },
  });

  const stats = statsQuery.data || { total_expected: 0, total_collected: 0, total_pending: 0, collection_percentage: 0 };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Fee Reports" subtitle="View fee collection statistics and reports" />

      {statsQuery.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <p className="text-sm font-medium text-ink-2">Total Expected</p>
              <p className="text-2xl font-bold text-accent-fg dark:text-accent-fg mt-1">{formatCurrency(stats.total_expected)}</p>
            </Card>
            <Card>
              <p className="text-sm font-medium text-ink-2">Collected</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">{formatCurrency(stats.total_collected)}</p>
            </Card>
            <Card>
              <p className="text-sm font-medium text-ink-2">Pending</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{formatCurrency(stats.total_pending)}</p>
            </Card>
            <Card>
              <p className="text-sm font-medium text-ink-2">Collection Rate</p>
              <p className="text-2xl font-bold text-accent-fg dark:text-accent-fg mt-1">{stats.collection_percentage.toFixed(1)}%</p>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 mt-6">
            <Card>
              <h3 className="font-semibold text-ink dark:text-white mb-4">Collection by Month</h3>
              <div className="h-64 flex items-center justify-center text-ink-3">
                <p>Monthly collection chart will be displayed here</p>
              </div>
            </Card>
            <Card>
              <h3 className="font-semibold text-ink dark:text-white mb-4">Class-wise Collection</h3>
              <div className="h-64 flex items-center justify-center text-ink-3">
                <p>Class-wise collection chart will be displayed here</p>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
