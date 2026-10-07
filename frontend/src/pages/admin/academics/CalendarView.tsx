import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader } from "../../../components/ui";
import { DataTable, type Column } from "../../../components/DataTable";
import { createCalendarEvent, listAcademicYears, listCalendarEvents } from "./api";
import { useLanguage } from "../../../i18n/LanguageContext";
import type { CalendarEvent, CalendarEventType } from "./types";

const EVENT_TYPES: CalendarEventType[] = ["HOLIDAY", "EXAM", "EVENT", "OTHER"];
const EVENT_TONES: Record<CalendarEventType, "gray" | "green" | "red" | "yellow"> = {
  HOLIDAY: "green",
  EXAM: "red",
  EVENT: "yellow",
  OTHER: "gray",
};

export default function CalendarView() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: years } = useQuery({ queryKey: ["academic-years"], queryFn: listAcademicYears });

  const [academicYearId, setAcademicYearId] = useState("");
  useEffect(() => {
    if (!academicYearId && years && years.length > 0) {
      setAcademicYearId(years.find((y) => y.is_current)?.id ?? years[0].id);
    }
  }, [years, academicYearId]);

  const { data: events, isLoading } = useQuery({
    queryKey: ["calendar", academicYearId],
    queryFn: () => listCalendarEvents(academicYearId),
    enabled: !!academicYearId,
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventType, setEventType] = useState<CalendarEventType>("EVENT");
  const [error, setError] = useState("");

  const createMutation = useMutation({
    mutationFn: createCalendarEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar", academicYearId] });
      setTitle("");
      setDescription("");
      setEventDate("");
      setEventType("EVENT");
      setError("");
    },
    onError: (err) => setError(err instanceof Error ? err.message : t("admin.calendarView.createFailed")),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!academicYearId || !title || !eventDate) {
      setError(t("admin.calendarView.fieldsRequired"));
      return;
    }
    createMutation.mutate({
      academic_year_id: academicYearId,
      title,
      description: description || null,
      event_date: eventDate,
      event_type: eventType,
    });
  }

  const sortedEvents = [...(events ?? [])].sort((a, b) => a.event_date.localeCompare(b.event_date));

  const columns: Column<CalendarEvent>[] = [
    { header: t("admin.common.date"), cell: (e) => e.event_date },
    { header: t("admin.common.title"), cell: (e) => e.title },
    { header: t("admin.common.type"), cell: (e) => <Badge tone={EVENT_TONES[e.event_type]}>{t(`admin.eventType.${e.event_type}`)}</Badge> },
    { header: t("admin.common.description"), cell: (e) => e.description ?? "—" },
  ];

  return (
    <div>
      <PageHeader title={t("admin.calendarView.title")} subtitle={t("admin.calendarView.subtitle")} />

      <Card className="mb-6">
        <div className="mb-4 max-w-xs">
          <Label htmlFor="cal-year">{t("admin.common.academicYear")}</Label>
          <select
            id="cal-year"
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

        <h2 className="mb-4 text-sm font-semibold text-ink">{t("admin.calendarView.addEvent")}</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-5 sm:items-end">
          <div>
            <Label htmlFor="cal-title">{t("admin.common.title")}</Label>
            <Input id="cal-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cal-date">{t("admin.common.date")}</Label>
            <Input id="cal-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cal-type">{t("admin.common.type")}</Label>
            <select
              id="cal-type"
              className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              value={eventType}
              onChange={(e) => setEventType(e.target.value as CalendarEventType)}
            >
              {EVENT_TYPES.map((et) => (
                <option key={et} value={et}>
                  {t(`admin.eventType.${et}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-1">
            <Label htmlFor="cal-desc">{t("admin.common.description")}</Label>
            <Input id="cal-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? t("admin.calendarView.adding") : t("admin.calendarView.addEvent")}
          </Button>
        </form>
        <ErrorText>{error}</ErrorText>
      </Card>

      <DataTable columns={columns} rows={sortedEvents} isLoading={isLoading} rowKey={(e) => e.id} emptyLabel={t("admin.calendarView.empty")} />
    </div>
  );
}
