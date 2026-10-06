import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Select, Spinner } from "../../components/ui";
import { api } from "../../api/client";
import {
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  FileText,
  Send,
  X
} from "lucide-react";

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  review_notes: string | null;
  created_at: string;
}

interface LeaveResponse {
  items: LeaveRequest[];
  total: number;
}

interface LeaveSummary {
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  total: number;
}

async function fetchMyLeaves() {
  const res = await api.get<LeaveResponse>("/leave?page_size=50");
  return res.data;
}

async function fetchLeaveSummary() {
  const res = await api.get<LeaveSummary>("/leave/summary");
  return res.data;
}

async function createLeave(data: {
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
}) {
  const res = await api.post("/leave", data);
  return res.data;
}

async function cancelLeave(leaveId: string) {
  await api.post(`/leave/${leaveId}/cancel`);
}

const leaveTypeConfig: Record<string, { label: string; color: string }> = {
  SICK: { label: "Sick Leave", color: "from-red-500 to-rose-500" },
  CASUAL: { label: "Casual Leave", color: "from-blue-500 to-cyan-500" },
  EMERGENCY: { label: "Emergency", color: "from-amber-500 to-orange-500" },
  VACATION: { label: "Vacation", color: "from-green-500 to-emerald-500" },
  OTHER: { label: "Other", color: "from-violet-500 to-purple-500" },
};

const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; bg: string }> = {
  APPROVED: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-100 dark:bg-green-500/20" },
  REJECTED: { icon: XCircle, color: "text-red-600", bg: "bg-red-100 dark:bg-red-500/20" },
  PENDING: { icon: Clock, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-500/20" },
  CANCELLED: { icon: X, color: "text-ink-2", bg: "bg-surface-3 dark:bg-gray-500/20" },
};

export default function TeacherLeaveRequest() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [leaveType, setLeaveType] = useState("CASUAL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const { data: leaves, isLoading } = useQuery({
    queryKey: ["teacher", "leaves"],
    queryFn: fetchMyLeaves,
  });

  const { data: summary } = useQuery({
    queryKey: ["teacher", "leave-summary"],
    queryFn: fetchLeaveSummary,
  });

  const createMutation = useMutation({
    mutationFn: createLeave,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "leaves"] });
      queryClient.invalidateQueries({ queryKey: ["teacher", "leave-summary"] });
      setShowForm(false);
      setLeaveType("CASUAL");
      setStartDate("");
      setEndDate("");
      setReason("");
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || "Failed to submit leave request");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: cancelLeave,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teacher", "leaves"] });
      queryClient.invalidateQueries({ queryKey: ["teacher", "leave-summary"] });
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!startDate || !endDate || !reason) {
      setError("All fields are required");
      return;
    }
    createMutation.mutate({ leave_type: leaveType, start_date: startDate, end_date: endDate, reason });
  }

  return (
    <div className="animate-page-enter">
      <PageHeader
        title="Leave Requests"
        subtitle="Request and track your leave applications."
        actions={
          !showForm && (
            <Button onClick={() => setShowForm(true)} glow>
              <Plus className="w-4 h-4" />
              Request Leave
            </Button>
          )
        }
      />

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Pending", value: summary.pending, icon: Clock, color: "from-amber-500 to-orange-500" },
            { label: "Approved", value: summary.approved, icon: CheckCircle, color: "from-green-500 to-emerald-500" },
            { label: "Rejected", value: summary.rejected, icon: XCircle, color: "from-red-500 to-rose-500" },
            { label: "Total", value: summary.total, icon: FileText, color: "from-violet-500 to-purple-500" },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className="p-5 rounded-2xl bg-surface border border-line hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <p className="text-3xl font-bold text-ink dark:text-white">{stat.value}</p>
              <p className="text-sm text-ink-3">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Leave Request Form */}
      {showForm && (
        <Card className="mb-6 relative overflow-hidden" gradient>
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-accent/10 to-accent-2/10 rounded-full -mr-16 -mt-16" />

          <h3 className="text-xl font-bold text-ink dark:text-white mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center">
              <Plus className="w-5 h-5 text-white" />
            </div>
            New Leave Request
          </h3>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-accent-fg" />
                  Leave Type
                </Label>
                <Select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="rounded-xl"
                >
                  {Object.entries(leaveTypeConfig).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-accent-fg" />
                  Start Date
                </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="rounded-xl"
                />
              </div>
              <div>
                <Label className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-accent-fg" />
                  End Date
                </Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="rounded-xl"
                />
              </div>
            </div>
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-accent-fg" />
                Reason
              </Label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Briefly describe your reason for leave"
                required
                rows={3}
                className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink dark:text-white focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all resize-none"
              />
            </div>
            {error && <ErrorText>{error}</ErrorText>}
            <div className="flex gap-3">
              <Button type="submit" disabled={createMutation.isPending} glow>
                {createMutation.isPending ? (
                  <>
                    <Spinner size="sm" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Request
                  </>
                )}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Leave History */}
      {isLoading ? (
        <Card className="py-12 flex justify-center">
          <Spinner size="lg" />
        </Card>
      ) : !leaves?.items?.length ? (
        <Card className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-accent/10 to-accent-2/10 flex items-center justify-center animate-float">
            <Calendar className="w-10 h-10 text-accent-fg" />
          </div>
          <h3 className="text-xl font-bold text-ink dark:text-white mb-2">No Leave Requests</h3>
          <p className="text-ink-3 max-w-md mx-auto mb-6">
            You haven't submitted any leave requests yet.
          </p>
          <Button onClick={() => setShowForm(true)} glow>
            <Plus className="w-4 h-4" />
            Create Your First Request
          </Button>
        </Card>
      ) : (
        <Card>
          <h3 className="text-lg font-bold text-ink dark:text-white mb-4">Leave History</h3>
          <div className="space-y-4">
            {leaves.items.map((leave, i) => {
              const typeConfig = leaveTypeConfig[leave.leave_type] || leaveTypeConfig.OTHER;
              const status = statusConfig[leave.status] || statusConfig.PENDING;
              const StatusIcon = status.icon;

              return (
                <div
                  key={leave.id}
                  className="p-4 rounded-xl border border-line hover:bg-surface-3 dark:hover:bg-surface-3 transition-all flex items-center gap-4"
                  style={{ animationDelay: `${i * 0.05}s` }}
                >
                  {/* Type Badge */}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${typeConfig.color} flex items-center justify-center flex-shrink-0`}>
                    <Calendar className="w-6 h-6 text-white" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-ink dark:text-white">{typeConfig.label}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {leave.status}
                      </span>
                    </div>
                    <p className="text-sm text-ink-3">
                      {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-ink-2 mt-1 truncate">{leave.reason}</p>
                    {leave.review_notes && (
                      <p className="text-xs text-ink-3 mt-1 italic">Note: {leave.review_notes}</p>
                    )}
                  </div>

                  {/* Actions */}
                  {leave.status === "PENDING" && (
                    <Button
                      variant="secondary"
                      onClick={() => cancelMutation.mutate(leave.id)}
                      disabled={cancelMutation.isPending}
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
