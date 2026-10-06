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
          <label className="text-sm font-medium text-[#4B4260] dark:text-[#D8CCEA]">Month:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-lg border border-[#E5DDF5] dark:border-[#2D1B4E] bg-white dark:bg-[#1B1230] px-3 py-2 text-[#24113F] dark:text-white focus:border-[#6D28D9] focus:outline-none"
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
                    <h3 className="font-semibold text-[#24113F] dark:text-white">{event.title}</h3>
                    <Badge tone={eventTypeColors[event.event_type] || "gray"}>{event.event_type}</Badge>
                  </div>
                  {event.description && (
                    <p className="text-sm text-[#4B4260] dark:text-[#D8CCEA]">{event.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-[#6D28D9] dark:text-[#8B5CF6]">
                    {formatDate(event.start_date)}
                    {event.end_date !== event.start_date && ` - ${formatDate(event.end_date)}`}
                  </p>
                </div>
              </div>
            </Card>
          ))}
          {eventsQuery.data?.length === 0 && (
            <Card>
              <p className="text-center text-[#7C6F95] py-8">No events scheduled for this month.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
