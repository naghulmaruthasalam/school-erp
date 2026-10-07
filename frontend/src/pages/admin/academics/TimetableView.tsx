import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Card, ErrorText, Input, Label, PageHeader } from "../../../components/ui";
import {
  createTimetableSlot,
  listAcademicYears,
  listClasses,
  listSections,
  listSubjects,
  listTeachersLite,
  listTimetableSlots,
} from "./api";
import { DAY_LABELS } from "./types";
import { useLanguage } from "../../../i18n/LanguageContext";

export default function TimetableView() {
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

  const { data: sections } = useQuery({
    queryKey: ["sections", classId],
    queryFn: () => listSections(classId),
    enabled: !!classId,
  });

  const [sectionId, setSectionId] = useState("");
  useEffect(() => {
    if (sections && sections.length > 0 && !sections.some((s) => s.id === sectionId)) {
      setSectionId(sections[0].id);
    } else if (sections && sections.length === 0) {
      setSectionId("");
    }
  }, [sections, sectionId]);

  const { data: slots, isLoading } = useQuery({
    queryKey: ["timetable", sectionId],
    queryFn: () => listTimetableSlots(sectionId),
    enabled: !!sectionId,
  });

  const { data: subjects } = useQuery({ queryKey: ["subjects"], queryFn: listSubjects });
  const { data: teachers } = useQuery({ queryKey: ["teachers-lite"], queryFn: () => listTeachersLite() });

  const [dayOfWeek, setDayOfWeek] = useState("0");
  const [periodNumber, setPeriodNumber] = useState("1");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: createTimetableSlot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timetable", sectionId] });
      setPeriodNumber("1");
      setStartTime("");
      setEndTime("");
      setError("");
    },
    onError: (err) => setError(err instanceof Error ? err.message : t("admin.timetableView.createFailed")),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!sectionId || !startTime || !endTime || !subjectId || !teacherId) {
      setError(t("admin.timetableView.allRequired"));
      return;
    }
    createMutation.mutate({
      section_id: sectionId,
      day_of_week: Number(dayOfWeek),
      period_number: Number(periodNumber) || 1,
      start_time: startTime,
      end_time: endTime,
      subject_id: subjectId,
      teacher_id: teacherId,
    });
  }

  const subjectName = (id: string) => te("subject", subjects?.find((s) => s.id === id)?.name) || id;
  const teacherName = (id: string) => teachers?.find((tc) => tc.id === id)?.full_name ?? id;

  const slotsByDay = DAY_LABELS.map((_, dayIndex) =>
    (slots ?? [])
      .filter((s) => s.day_of_week === dayIndex)
      .sort((a, b) => a.period_number - b.period_number),
  );

  return (
    <div>
      <PageHeader title={t("admin.timetableView.title")} subtitle={t("admin.timetableView.subtitle")} />

      <Card className="mb-6">
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3 sm:max-w-2xl">
          <div>
            <Label htmlFor="tt-year">{t("admin.common.academicYear")}</Label>
            <select
              id="tt-year"
              className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
            >
              {(years ?? []).map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="tt-class">{t("admin.common.class")}</Label>
            <select
              id="tt-class"
              className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              {(classes ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {te("class", c.name)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="tt-section">{t("admin.common.section")}</Label>
            <select
              id="tt-section"
              className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
            >
              {(sections ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {te("section", s.name)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <h2 className="mb-4 text-sm font-semibold text-ink">{t("admin.common.addSlot")}</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7 sm:items-end">
          <div>
            <Label htmlFor="tt-day">{t("admin.common.day")}</Label>
            <select
              id="tt-day"
              className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(e.target.value)}
            >
              {DAY_LABELS.map((label, idx) => (
                <option key={label} value={idx}>
                  {te("weekday", label)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="tt-period">{t("admin.common.period")}</Label>
            <Input id="tt-period" type="number" min={1} value={periodNumber} onChange={(e) => setPeriodNumber(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="tt-start">{t("admin.timetableView.start")}</Label>
            <Input id="tt-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="tt-end">{t("admin.timetableView.end")}</Label>
            <Input id="tt-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="tt-subject">{t("admin.common.subject")}</Label>
            <select
              id="tt-subject"
              className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="">{t("admin.common.select")}</option>
              {(subjects ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {te("subject", s.name)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="tt-teacher">{t("admin.common.teacher")}</Label>
            <select
              id="tt-teacher"
              className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
            >
              <option value="">{t("admin.common.select")}</option>
              {(teachers ?? []).map((tc) => (
                <option key={tc.id} value={tc.id}>
                  {tc.full_name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={createMutation.isPending || !sectionId}>
            {createMutation.isPending ? t("admin.common.adding") : t("admin.common.addSlot")}
          </Button>
        </form>
        <ErrorText>{error}</ErrorText>
      </Card>

      {isLoading ? (
        <p className="text-sm text-accent-fg">{t("admin.timetableView.loading")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {DAY_LABELS.map((label, dayIndex) => (
            <Card key={label}>
              <h3 className="mb-3 text-sm font-semibold text-ink">{te("weekday", label)}</h3>
              {slotsByDay[dayIndex].length === 0 ? (
                <p className="text-xs text-accent-fg">{t("admin.timetableView.noPeriods")}</p>
              ) : (
                <ul className="space-y-2">
                  {slotsByDay[dayIndex].map((slot) => (
                    <li key={slot.id} className="rounded-md border border-line bg-violet-50 px-3 py-2 text-xs">
                      <p className="font-medium text-ink">
                        {t("admin.timetableView.periodLine", { n: slot.period_number, start: slot.start_time, end: slot.end_time })}
                      </p>
                      <p className="text-accent-fg">
                        {subjectName(slot.subject_id)} · {teacherName(slot.teacher_id)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
