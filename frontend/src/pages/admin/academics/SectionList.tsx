import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, ErrorText, Input, Label, PageHeader } from "../../../components/ui";
import { DataTable, type Column } from "../../../components/DataTable";
import { createSection, listAcademicYears, listClasses, listSections, listTeachersLite } from "./api";
import type { Section } from "./types";

export default function SectionList() {
  const queryClient = useQueryClient();
  const { data: years } = useQuery({ queryKey: ["academic-years"], queryFn: listAcademicYears });

  const [academicYearId, setAcademicYearId] = useState("");
  useEffect(() => {
    if (!academicYearId && years && years.length > 0) {
      setAcademicYearId(years.find((y) => y.is_current)?.id ?? years[0].id);
    }
  }, [years, academicYearId]);

  const { data: classes } = useQuery({
    queryKey: ["classes", academicYearId],
    queryFn: () => listClasses(academicYearId),
    enabled: !!academicYearId,
  });

  const [classId, setClassId] = useState("");
  useEffect(() => {
    if (classes && classes.length > 0 && !classes.some((c) => c.id === classId)) {
      setClassId(classes[0].id);
    } else if (classes && classes.length === 0) {
      setClassId("");
    }
  }, [classes, classId]);

  const { data: sections, isLoading } = useQuery({
    queryKey: ["sections", classId],
    queryFn: () => listSections(classId),
    enabled: !!classId,
  });

  const { data: teachers } = useQuery({ queryKey: ["teachers-lite"], queryFn: () => listTeachersLite() });

  const [name, setName] = useState("");
  const [roomNo, setRoomNo] = useState("");
  const [classTeacherId, setClassTeacherId] = useState("");
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: createSection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections", classId] });
      setName("");
      setRoomNo("");
      setClassTeacherId("");
      setError("");
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to create section."),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!classId || !name) {
      setError("Class and name are required.");
      return;
    }
    createMutation.mutate({
      class_id: classId,
      name,
      room_no: roomNo || null,
      class_teacher_id: classTeacherId || null,
    });
  }

  const teacherName = (id: string | null) => (id ? teachers?.find((t) => t.id === id)?.full_name ?? id : "—");

  const columns: Column<Section>[] = [
    { header: "Name", cell: (s) => s.name },
    { header: "Room No.", cell: (s) => s.room_no ?? "—" },
    { header: "Class Teacher", cell: (s) => teacherName(s.class_teacher_id) },
  ];

  return (
    <div>
      <PageHeader title="Sections" subtitle="Sections are scoped to a class." />

      <Card className="mb-6">
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:max-w-lg">
          <div>
            <Label htmlFor="sec-year">Academic Year</Label>
            <select
              id="sec-year"
              className="w-full rounded-md border border-violet-300 px-3 py-2 text-sm text-violet-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
            >
              <option value="" disabled>
                Select academic year
              </option>
              {(years ?? []).map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="sec-class">Class</Label>
            <select
              id="sec-class"
              className="w-full rounded-md border border-violet-300 px-3 py-2 text-sm text-violet-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="" disabled>
                Select class
              </option>
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <h2 className="mb-4 text-sm font-semibold text-violet-900">Create Section</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end">
          <div>
            <Label htmlFor="sec-name">Name</Label>
            <Input id="sec-name" placeholder="A" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="sec-room">Room No.</Label>
            <Input id="sec-room" placeholder="101" value={roomNo} onChange={(e) => setRoomNo(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="sec-teacher">Class Teacher</Label>
            <select
              id="sec-teacher"
              className="w-full rounded-md border border-violet-300 px-3 py-2 text-sm text-violet-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              value={classTeacherId}
              onChange={(e) => setClassTeacherId(e.target.value)}
            >
              <option value="">None</option>
              {(teachers ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating…" : "Create"}
          </Button>
        </form>
        <ErrorText>{error}</ErrorText>
      </Card>

      <DataTable columns={columns} rows={sections ?? []} isLoading={isLoading} rowKey={(s) => s.id} emptyLabel="No sections for this class yet." />
    </div>
  );
}
