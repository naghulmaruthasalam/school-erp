import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Card, PageHeader, Select, Spinner } from "../../components/ui";
import { DataTable, Pagination } from "../../components/DataTable";
import { api } from "../../api/client";

interface LeaveRequest {
  id: string;
  requester_type: string;
  requester_id: string;
  requester_name: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: string;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
}

interface LeaveResponse {
  items: LeaveRequest[];
  total: number;
  page: number;
  page_size: number;
}

const PAGE_SIZE = 15;

async function fetchLeaves(params: { page: number; status?: string; requester_type?: string }) {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    page_size: String(PAGE_SIZE),
  });
  if (params.status) searchParams.set("status", params.status);
  if (params.requester_type) searchParams.set("requester_type", params.requester_type);

  const res = await api.get<LeaveResponse>(`/leave?${searchParams}`);
  return res.data;
}

async function reviewLeave(leaveId: string, action: string, notes?: string) {
  await api.post(`/leave/${leaveId}/review`, { action, notes });
}

export default function LeaveList() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "leaves", page, statusFilter, typeFilter],
    queryFn: () =>
      fetchLeaves({
        page,
        status: statusFilter || undefined,
        requester_type: typeFilter || undefined,
      }),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ leaveId, action }: { leaveId: string; action: string }) =>
      reviewLeave(leaveId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "leaves"] });
    },
  });

  const getStatusTone = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "green";
      case "REJECTED":
        return "red";
      case "CANCELLED":
        return "gray";
      default:
        return "yellow";
    }
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Leave Management"
        subtitle="Manage leave requests from students and teachers."
      />

      <Card className="mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="w-48">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
          </div>
          <div className="w-48">
            <Select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Types</option>
              <option value="student">Students</option>
              <option value="teacher">Teachers</option>
            </Select>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <>
          <DataTable<LeaveRequest>
            columns={[
              { header: "Requester", cell: (row) => row.requester_name },
              {
                header: "Type",
                cell: (row) => (
                  <Badge tone="violet">
                    {row.requester_type === "student" ? "Student" : "Teacher"}
                  </Badge>
                ),
              },
              { header: "Leave Type", cell: (row) => row.leave_type },
              {
                header: "Duration",
                cell: (row) => (
                  <span>
                    {new Date(row.start_date).toLocaleDateString()} -{" "}
                    {new Date(row.end_date).toLocaleDateString()}
                  </span>
                ),
              },
              {
                header: "Reason",
                cell: (row) => (
                  <span className="max-w-[200px] truncate block" title={row.reason}>
                    {row.reason}
                  </span>
                ),
              },
              {
                header: "Status",
                cell: (row) => <Badge tone={getStatusTone(row.status)}>{row.status}</Badge>,
              },
              {
                header: "Actions",
                cell: (row) =>
                  row.status === "PENDING" ? (
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        onClick={() =>
                          reviewMutation.mutate({ leaveId: row.id, action: "approve" })
                        }
                        disabled={reviewMutation.isPending}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() =>
                          reviewMutation.mutate({ leaveId: row.id, action: "reject" })
                        }
                        disabled={reviewMutation.isPending}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <span className="text-accent-fg">—</span>
                  ),
              },
            ]}
            rows={data?.items ?? []}
            rowKey={(row) => row.id}
            emptyLabel="No leave requests found."
          />
          <div className="mt-4">
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={data?.total ?? 0}
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
