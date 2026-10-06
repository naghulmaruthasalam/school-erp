import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader } from "../../../components/ui";
import { DataTable, type Column } from "../../../components/DataTable";
import { createCalendarEvent, listAcademicYears, listCalendarEvents } from "./api";
import type { CalendarEvent, CalendarEventType } from "./types";

const EVENT_TYPES: CalendarEventType[] = ["HOLIDAY", "EXAM", "EVENT", "OTHER"];
const EVENT_TONES: Record<CalendarEventType, "gray" | "green" | "red" | "yellow"> = {
  HOLIDAY: "green",
  EXAM: "red",
  EVENT: "yellow",
  OTHER: "gray",
};

export default function CalendarView() {
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
    onError: (err) => setError(err instanceof Error ? err.message : "Failed to create event."),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!academicYearId || !title || !eventDate) {
      setError("Academic year, title and date are required.");
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
    { header: "Date", cell: (e) => e.event_date },
    { header: "Title", cell: (e) => e.title },
    { header: "Type", cell: (e) => <Badge tone={EVENT_TONES[e.event_type]}>{e.event_type}</Badge> },
    { header: "Description", cell: (e) => e.description ?? "—" },
  ];

  return (
    <div>
      <PageHeader title="Academic Calendar" subtitle="Holidays, exams and events for the academic year." />

      <Card className="mb-6">
        <div className="mb-4 max-w-xs">
          <Label htmlFor="cal-year">Academic Year</Label>
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

        <h2 className="mb-4 text-sm font-semibold text-ink">Add Event</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-5 sm:items-end">
          <div>
            <Label htmlFor="cal-title">Title</Label>
            <Input id="cal-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cal-date">Date</Label>
            <Input id="cal-date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="cal-type">Type</Label>
            <select
              id="cal-type"
              className="w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
              value={eventType}
              onChange={(e) => setEventType(e.target.value as CalendarEventType)}
            >
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-1">
            <Label htmlFor="cal-desc">Description</Label>
            <Input id="cal-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Adding…" : "Add Event"}
          </Button>
        </form>
        <ErrorText>{error}</ErrorText>
      </Card>

      <DataTable columns={columns} rows={sortedEvents} isLoading={isLoading} rowKey={(e) => e.id} emptyLabel="No calendar events yet." />
    </div>
  );
}
