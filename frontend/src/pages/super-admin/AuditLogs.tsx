import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, Input, Select, Spinner } from "../../components/ui";
import { fetchAuditLogs, exportDataToCsv } from "./api";

function getActionColor(action: string): string {
  if (action.includes("created") || action.includes("approved")) return "bg-[#16A34A]";
  if (action.includes("deleted") || action.includes("rejected") || action.includes("deactivated")) return "bg-[#DC2626]";
  if (action.includes("updated") || action.includes("reactivated")) return "bg-[#F59E0B]";
  return "bg-accent";
}

function getActionIcon(action: string): string {
  if (action.includes("login")) return "🔐";
  if (action.includes("created")) return "✨";
  if (action.includes("updated")) return "✏️";
  if (action.includes("deleted")) return "🗑️";
  if (action.includes("approved")) return "✅";
  if (action.includes("rejected")) return "❌";
  if (action.includes("school")) return "🏫";
  if (action.includes("student")) return "🎓";
  if (action.includes("teacher")) return "👨‍🏫";
  return "📋";
}

export default function AuditLogs() {
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(100);

  const auditQuery = useQuery({
    queryKey: ["super-admin", "audit-logs", limit],
    queryFn: () => fetchAuditLogs(limit),
  });

  const filteredLogs = (auditQuery.data ?? []).filter((log) => {
    if (search === "") return true;
    const searchLower = search.toLowerCase();
    return (
      log.action.toLowerCase().includes(searchLower) ||
      log.actor_name.toLowerCase().includes(searchLower) ||
      log.school_name.toLowerCase().includes(searchLower) ||
      (log.entity_type?.toLowerCase().includes(searchLower) ?? false)
    );
  });

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink dark:text-white">Audit Logs</h1>
          <p className="mt-1 text-sm text-ink-2">
            Track all platform activities and system events
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => exportDataToCsv(
            (auditQuery.data ?? []).map(log => ({
              timestamp: log.created_at || "",
              action: log.action,
              actor: log.actor_name,
              actor_email: log.actor_email || "",
              school: log.school_name,
              entity_type: log.entity_type || "",
            })),
            "audit-logs-export.csv"
          )}
          disabled={!auditQuery.data?.length}
        >
          Export Logs
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[250px]">
            <Input
              placeholder="Search by action, actor, school, or entity..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Select value={String(limit)} onChange={(e) => setLimit(Number(e.target.value))}>
              <option value="50">Last 50</option>
              <option value="100">Last 100</option>
              <option value="250">Last 250</option>
              <option value="500">Last 500</option>
            </Select>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-surface rounded-xl border border-line">
          <p className="text-2xl font-bold text-accent-fg dark:text-accent-fg">{auditQuery.data?.length ?? 0}</p>
          <p className="text-xs text-ink-3">Total Events</p>
        </div>
        <div className="p-4 bg-surface rounded-xl border border-line">
          <p className="text-2xl font-bold text-emerald-600">
            {(auditQuery.data ?? []).filter(l => l.action.includes("created")).length}
          </p>
          <p className="text-xs text-ink-3">Create Events</p>
        </div>
        <div className="p-4 bg-surface rounded-xl border border-line">
          <p className="text-2xl font-bold text-amber-500">
            {(auditQuery.data ?? []).filter(l => l.action.includes("updated")).length}
          </p>
          <p className="text-xs text-ink-3">Update Events</p>
        </div>
        <div className="p-4 bg-surface rounded-xl border border-line">
          <p className="text-2xl font-bold text-red-600">
            {(auditQuery.data ?? []).filter(l => l.action.includes("deleted") || l.action.includes("deactivated")).length}
          </p>
          <p className="text-xs text-ink-3">Delete/Deactivate</p>
        </div>
      </div>

      {/* Logs List */}
      <Card>
        {auditQuery.isLoading ? (
          <div className="flex h-60 items-center justify-center"><Spinner /></div>
        ) : filteredLogs.length > 0 ? (
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-4 p-4 bg-surface-3 dark:bg-surface-2 rounded-xl border border-line hover:border-[#6D28D9]/30 transition-colors"
              >
                <div className={`w-10 h-10 rounded-lg ${getActionColor(log.action)} flex items-center justify-center text-white text-lg shrink-0`}>
                  {getActionIcon(log.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-ink dark:text-white">{log.action}</p>
                      <p className="text-sm text-ink-3 mt-0.5">
                        by <span className="font-medium text-ink-2">{log.actor_name}</span>
                        {log.actor_email && <span className="text-ink-3"> ({log.actor_email})</span>}
                      </p>
                    </div>
                    <span className="text-xs text-ink-3 whitespace-nowrap">
                      {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs px-2 py-1 bg-accent/10 text-accent-fg rounded-full">
                      {log.school_name}
                    </span>
                    {log.entity_type && (
                      <span className="text-xs px-2 py-1 bg-[#E5DDF5] dark:bg-surface-3 text-ink-2 rounded-full">
                        {log.entity_type}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-surface-3 flex items-center justify-center text-3xl">
              📋
            </div>
            <p className="text-ink-3">No audit logs available yet.</p>
            <p className="text-xs text-ink-3 mt-1">Logs will appear here as platform activities occur.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
