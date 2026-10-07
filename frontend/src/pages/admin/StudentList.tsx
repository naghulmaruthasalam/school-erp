import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Input, Label, PageHeader } from "../../components/ui";
import { DataTable, Pagination, type Column } from "../../components/DataTable";
import { listStudents } from "./api";
import { useClasses, useSections } from "./hooks";
import type { Student, StudentStatus } from "./types";

const STATUS_OPTIONS: StudentStatus[] = ["ACTIVE", "INACTIVE", "TRANSFERRED", "GRADUATED", "ALUMNI"];

const STATUS_TONE: Record<StudentStatus, "gray" | "green" | "red" | "yellow"> = {
  ACTIVE: "green",
  INACTIVE: "gray",
  TRANSFERRED: "yellow",
  GRADUATED: "yellow",
  ALUMNI: "gray",
};

const PAGE_SIZE = 20;

export default function StudentList() {
  const [page, setPage] = useState(1);
  const [name, setName] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [status, setStatus] = useState<StudentStatus | "">("");

  const { data: classes } = useClasses();
  const { data: sections } = useSections(classId || undefined);

  const classNameById = useMemo(() => {
    const map = new Map<string, string>();
    (classes ?? []).forEach((c) => map.set(c.id, c.name));
    return map;
  }, [classes]);

  const sectionNameById = useMemo(() => {
    const map = new Map<string, string>();
    (sections ?? []).forEach((s) => map.set(s.id, s.name));
    return map;
  }, [sections]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "students", { page, name, classId, sectionId, status }],
    queryFn: () =>
      listStudents({
        page,
        page_size: PAGE_SIZE,
        name: name || undefined,
        class_id: classId || undefined,
        section_id: sectionId || undefined,
        status: status || undefined,
      }),
  });

  const columns: Column<Student>[] = [
    { header: "Admission No", cell: (s) => s.admission_no },
    {
      header: "Name",
      cell: (s) => (
        <Link to={`/admin/students/${s.id}`} className="font-medium text-accent-fg hover:underline">
          {s.full_name}
        </Link>
      ),
    },
    { header: "Class / Section", cell: (s) => `${classNameById.get(s.class_id) ?? "—"} - ${sectionNameById.get(s.section_id) ?? "—"}` },
    { header: "Roll No", cell: (s) => s.roll_number ?? "—" },
    { header: "Status", cell: (s) => <Badge tone={STATUS_TONE[s.status]}>{s.status}</Badge> },
  ];

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle="Manage student records, enrollment status and class assignments."
        actions={
          <Link to="/admin/students/new">
            <Button>New Student</Button>
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <Label>Name</Label>
          <Input
            placeholder="Search by name"
            value={name}
            onChange={(e) => {
              setPage(1);
              setName(e.target.value);
            }}
          />
        </div>
        <div>
          <Label>Class</Label>
          <select
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink dark:text-slate-100 focus:border-violet-500 dark:focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
            value={classId}
            onChange={(e) => {
              setPage(1);
              setClassId(e.target.value);
              setSectionId("");
            }}
          >
            <option value="">All classes</option>
            {(classes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Section</Label>
          <select
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink dark:text-slate-100 focus:border-violet-500 dark:focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
            value={sectionId}
            onChange={(e) => {
              setPage(1);
              setSectionId(e.target.value);
            }}
            disabled={!classId}
          >
            <option value="">All sections</option>
            {(sections ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Status</Label>
          <select
            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink dark:text-slate-100 focus:border-violet-500 dark:focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-500"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as StudentStatus | "");
            }}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <DataTable columns={columns} rows={data?.items ?? []} isLoading={isLoading} rowKey={(s) => s.id} emptyLabel="No students found." />
      <Pagination page={page} pageSize={PAGE_SIZE} total={data?.total ?? 0} onPageChange={setPage} />
    </div>
  );
}
