import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Card, PageHeader, Select, Spinner } from "../../components/ui";
import { DataTable, Pagination } from "../../components/DataTable";
import { api } from "../../api/client";
import { useLanguage } from "../../i18n/LanguageContext";

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
  const { t, te, fmtDate } = useLanguage();
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
        title={t("admin.leave.title")}
        subtitle={t("admin.leave.subtitle")}
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
              <option value="">{t("admin.leave.allStatus")}</option>
              <option value="PENDING">{t("admin.statusLabel.PENDING")}</option>
              <option value="APPROVED">{t("admin.statusLabel.APPROVED")}</option>
              <option value="REJECTED">{t("admin.statusLabel.REJECTED")}</option>
              <option value="CANCELLED">{t("admin.statusLabel.CANCELLED")}</option>
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
              <option value="">{t("admin.leave.allTypes")}</option>
              <option value="student">{t("admin.leave.students")}</option>
              <option value="teacher">{t("admin.leave.teachers")}</option>
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
              { header: t("admin.leave.requester"), cell: (row) => row.requester_name },
              {
                header: t("admin.common.type"),
                cell: (row) => (
                  <Badge tone="violet">
                    {row.requester_type === "student" ? t("admin.leave.student") : t("admin.leave.teacher")}
                  </Badge>
                ),
              },
              { header: t("admin.leave.leaveType"), cell: (row) => te("leaveType", row.leave_type) },
              {
                header: t("admin.leave.duration"),
                cell: (row) => (
                  <span>
                    {fmtDate(row.start_date)} -{" "}
                    {fmtDate(row.end_date)}
                  </span>
                ),
              },
              {
                header: t("admin.leave.reason"),
                cell: (row) => (
                  <span className="max-w-[200px] truncate block" title={row.reason}>
                    {row.reason}
                  </span>
                ),
              },
              {
                header: t("admin.common.status"),
                cell: (row) => <Badge tone={getStatusTone(row.status)}>{te("status", row.status)}</Badge>,
              },
              {
                header: t("admin.common.actions"),
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
                        {t("admin.leave.approve")}
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() =>
                          reviewMutation.mutate({ leaveId: row.id, action: "reject" })
                        }
                        disabled={reviewMutation.isPending}
                      >
                        {t("admin.leave.reject")}
                      </Button>
                    </div>
                  ) : (
                    <span className="text-accent-fg">—</span>
                  ),
              },
            ]}
            rows={data?.items ?? []}
            rowKey={(row) => row.id}
            emptyLabel={t("admin.leave.empty")}
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
