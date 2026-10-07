import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, Input, Select } from "../../components/ui";
import { DataTable, Pagination } from "../../components/DataTable";
import { listSchools, updateSchool, exportDataToCsv } from "./api";
import type { School } from "./types";

const PAGE_SIZE = 10;

export default function SchoolList() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const schoolsQuery = useQuery({
    queryKey: ["super-admin", "schools", page, statusFilter],
    queryFn: () => listSchools({ page, page_size: PAGE_SIZE }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      updateSchool(id, { is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin", "schools"] });
      queryClient.invalidateQueries({ queryKey: ["super-admin", "stats"] });
    },
  });

  const filteredSchools = (schoolsQuery.data?.items ?? []).filter((school) => {
    const matchesSearch = search === "" ||
      school.name.toLowerCase().includes(search.toLowerCase()) ||
      school.code.toLowerCase().includes(search.toLowerCase()) ||
      (school.city?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "active" && school.is_active) ||
      (statusFilter === "inactive" && !school.is_active);
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="animate-fade-in-up">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-ink dark:text-white">Schools Management</h1>
          <p className="mt-1 text-sm text-ink-2">
            Manage all registered schools on the platform
          </p>
        </div>
        <Link to="/super-admin/new">
          <Button>+ Add New School</Button>
        </Link>
      </div>

      <Card className="mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="Search by name, code, or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
          <Button
            variant="secondary"
            onClick={() => exportDataToCsv(schoolsQuery.data?.items ?? [], "schools-export.csv")}
            disabled={!schoolsQuery.data?.items?.length}
          >
            Export CSV
          </Button>
        </div>
      </Card>

      <Card>
        <DataTable<School>
          columns={[
            {
              header: "School Name",
              cell: (row) => (
                <Link to={`/super-admin/${row.id}`} className="font-medium text-accent-fg hover:underline">
                  {row.name}
                </Link>
              ),
            },
            { header: "Code", cell: (row) => <span className="font-mono text-sm">{row.code}</span> },
            { header: "City", cell: (row) => row.city ?? "—" },
            { header: "State", cell: (row) => row.state ?? "—" },
            { header: "Email", cell: (row) => row.email ?? "—" },
            { header: "Phone", cell: (row) => row.phone ?? "—" },
            {
              header: "Status",
              cell: (row) => (
                <Badge tone={row.is_active ? "green" : "red"}>
                  {row.is_active ? "Active" : "Inactive"}
                </Badge>
              ),
            },
            {
              header: "Actions",
              cell: (row) => (
                <div className="flex gap-2">
                  <Link to={`/super-admin/${row.id}`}>
                    <Button variant="secondary" className="text-xs px-2 py-1">View</Button>
                  </Link>
                  <Button
                    variant={row.is_active ? "danger" : "primary"}
                    className="text-xs px-2 py-1"
                    onClick={() => toggleStatusMutation.mutate({ id: row.id, is_active: !row.is_active })}
                    disabled={toggleStatusMutation.isPending}
                  >
                    {row.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              ),
            },
          ]}
          rows={filteredSchools}
          isLoading={schoolsQuery.isLoading}
          rowKey={(row) => row.id}
          emptyLabel="No schools found."
        />
        <div className="mt-4">
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={schoolsQuery.data?.total ?? 0}
            onPageChange={setPage}
          />
        </div>
      </Card>
    </div>
  );
}
