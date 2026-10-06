import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, Spinner, Badge } from "../../components/ui";
import { api } from "../../api/client";

interface CalendarEvent {
  id: string;
  title: string;
  event_type: string;
  start_date: string;
  end_date: string;
  description?: string;
}

export default function SchoolCalendar() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const eventsQuery = useQuery({
    queryKey: ["calendar-events", selectedMonth],
    queryFn: async () => {
      try {
        const { data } = await api.get<CalendarEvent[]>(`/calendar/events?month=${selectedMonth}`);
        return data;
      } catch {
        return [];
      }
    },
  });

  const eventTypeColors: Record<string, "violet" | "green" | "red" | "yellow"> = {
    HOLIDAY: "red",
    EXAM: "violet",
    EVENT: "green",
    MEETING: "yellow",
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="School Calendar" subtitle="View upcoming events, holidays, and exams" />

      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-ink-2">Month:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-ink dark:text-white focus:border-accent focus:outline-none"
          />
        </div>
      </Card>

      {eventsQuery.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="space-y-4">
          {eventsQuery.data?.map((event) => (
            <Card key={event.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-ink dark:text-white">{event.title}</h3>
                    <Badge tone={eventTypeColors[event.event_type] || "gray"}>{event.event_type}</Badge>
                  </div>
                  {event.description && (
                    <p className="text-sm text-ink-2">{event.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-accent-fg dark:text-accent-fg">
                    {formatDate(event.start_date)}
                    {event.end_date !== event.start_date && ` - ${formatDate(event.end_date)}`}
                  </p>
                </div>
              </div>
            </Card>
          ))}
          {eventsQuery.data?.length === 0 && (
            <Card>
              <p className="text-center text-ink-3 py-8">No events scheduled for this month.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
