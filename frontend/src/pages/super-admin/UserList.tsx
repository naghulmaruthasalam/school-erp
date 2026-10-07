import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Badge, Button, Card, Input, Select, Spinner } from "../../components/ui";
import { DataTable, Pagination } from "../../components/DataTable";
import { api } from "../../api/client";
import { exportDataToCsv } from "./api";

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  school_id: string | null;
  school_name: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string | null;
}

interface UsersResponse {
  items: User[];
  total: number;
  page: number;
  page_size: number;
}

const PAGE_SIZE = 15;

async function fetchUsers(params: { page: number; search?: string; role?: string }) {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    page_size: String(PAGE_SIZE),
  });
  if (params.search) searchParams.set("search", params.search);
  if (params.role) searchParams.set("role", params.role);

  const res = await api.get<UsersResponse>(`/users?${searchParams}`);
  return res.data;
}

const ROLE_COLORS: Record<string, "violet" | "green" | "yellow" | "gray"> = {
  SUPER_ADMIN: "violet",
  SCHOOL_ADMIN: "green",
  PRINCIPAL: "green",
  TEACHER: "yellow",
  PARENT: "gray",
  STUDENT: "gray",
};

export default function UserList() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["super-admin", "users", page, search, roleFilter],
    queryFn: () => fetchUsers({ page, search: search || undefined, role: roleFilter || undefined }),
  });

  const roles = [
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "TEACHER",
    "PARENT",
    "STUDENT",
  ];

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink dark:text-white">User Directory</h1>
          <p className="mt-1 text-sm text-ink-2">
            View all users registered across the platform
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={() => exportDataToCsv(
            (data?.items ?? []).map(u => ({
              name: u.full_name,
              email: u.email,
              role: u.role,
              school: u.school_name || "Platform",
              status: u.is_active ? "Active" : "Inactive",
              last_login: u.last_login_at || "Never",
            })),
            "users-export.csv"
          )}
          disabled={!data?.items?.length}
        >
          Export CSV
        </Button>
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[250px]">
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="w-48">
            <Select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Roles</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r.replace("_", " ")}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <>
            <DataTable<User>
              columns={[
                {
                  header: "User",
                  cell: (row) => (
                    <div>
                      <p className="font-medium text-ink dark:text-white">{row.full_name}</p>
                      <p className="text-xs text-ink-3">{row.email}</p>
                    </div>
                  ),
                },
                {
                  header: "Role",
                  cell: (row) => (
                    <Badge tone={ROLE_COLORS[row.role] || "gray"}>
                      {row.role.replace("_", " ")}
                    </Badge>
                  ),
                },
                {
                  header: "School",
                  cell: (row) => (
                    <span className="text-sm text-ink-2">
                      {row.school_name || <span className="text-accent-fg">Platform</span>}
                    </span>
                  ),
                },
                {
                  header: "Status",
                  cell: (row) => (
                    <Badge tone={row.is_active ? "green" : "red"}>
                      {row.is_active ? "Active" : "Inactive"}
                    </Badge>
                  ),
                },
                {
                  header: "Last Login",
                  cell: (row) => (
                    <span className="text-sm text-ink-3">
                      {row.last_login_at
                        ? new Date(row.last_login_at).toLocaleDateString()
                        : "Never"}
                    </span>
                  ),
                },
                {
                  header: "Joined",
                  cell: (row) => (
                    <span className="text-sm text-ink-3">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleDateString()
                        : "—"}
                    </span>
                  ),
                },
              ]}
              rows={data?.items ?? []}
              rowKey={(row) => row.id}
              emptyLabel="No users found."
            />
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-ink-3">
                Showing {((page - 1) * PAGE_SIZE) + 1} - {Math.min(page * PAGE_SIZE, data?.total ?? 0)} of {data?.total ?? 0} users
              </p>
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={data?.total ?? 0}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
