import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, ErrorText, Input, Label, PageHeader } from "../../../components/ui";
import { DataTable, type Column } from "../../../components/DataTable";
import { createSection, listAcademicYears, listClasses, listSections, listTeachersLite } from "./api";
import { useLanguage } from "../../../i18n/LanguageContext";
import type { Section } from "./types";

export default function SectionList() {
  const { t, te } = useLanguage();
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
    onError: (err) => setError(err instanceof Error ? err.message : t("admin.sections.createFailed")),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!classId || !name) {
      setError(t("admin.sections.classNameRequired"));
      return;
    }
    createMutation.mutate({
      class_id: classId,
      name,
      room_no: roomNo || null,
      class_teacher_id: classTeacherId || null,
    });
  }

  const teacherName = (id: string | null) => (id ? teachers?.find((tc) => tc.id === id)?.full_name ?? id : "—");

  const columns: Column<Section>[] = [
    { header: t("admin.common.name"), cell: (s) => te("section", s.name) },
    { header: t("admin.common.roomNo"), cell: (s) => s.room_no ?? "—" },
    { header: t("admin.common.classTeacher"), cell: (s) => teacherName(s.class_teacher_id) },
  ];

  return (
    <div>
      <PageHeader title={t("admin.sections.title")} subtitle={t("admin.sections.subtitle")} />

      <Card className="mb-6">
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:max-w-lg">
          <div>
            <Label htmlFor="sec-year">{t("admin.common.academicYear")}</Label>
            <select
              id="sec-year"
              className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
            >
              <option value="" disabled>
                {t("admin.common.selectAcademicYear")}
              </option>
              {(years ?? []).map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="sec-class">{t("admin.common.class")}</Label>
            <select
              id="sec-class"
              className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="" disabled>
                {t("admin.common.selectClass")}
              </option>
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {te("class", c.name)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <h2 className="mb-4 text-sm font-semibold text-ink">{t("admin.sections.createTitle")}</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end">
          <div>
            <Label htmlFor="sec-name">{t("admin.common.name")}</Label>
            <Input id="sec-name" placeholder="A" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="sec-room">{t("admin.common.roomNo")}</Label>
            <Input id="sec-room" placeholder="101" value={roomNo} onChange={(e) => setRoomNo(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="sec-teacher">{t("admin.common.classTeacher")}</Label>
            <select
              id="sec-teacher"
              className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              value={classTeacherId}
              onChange={(e) => setClassTeacherId(e.target.value)}
            >
              <option value="">{t("admin.common.none")}</option>
              {(teachers ?? []).map((tc) => (
                <option key={tc.id} value={tc.id}>
                  {tc.full_name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? t("admin.common.creating") : t("admin.common.create")}
          </Button>
        </form>
        <ErrorText>{error}</ErrorText>
      </Card>

      <DataTable columns={columns} rows={sections ?? []} isLoading={isLoading} rowKey={(s) => s.id} emptyLabel={t("admin.sections.empty")} />
    </div>
  );
}
