import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, PageHeader, Spinner, Badge } from "../../components/ui";
import { api } from "../../api/client";
import { useLanguage } from "../../i18n/LanguageContext";

interface CalendarEvent {
  id: string;
  title: string;
  event_type: string;
  event_date: string;
  description?: string | null;
}

export default function SchoolCalendar() {
  const { t, fmtDate } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  const eventsQuery = useQuery({
    queryKey: ["calendar-events", selectedMonth],
    queryFn: async () => {
      try {
        const [year, month] = selectedMonth.split("-").map(Number);
        const lastDay = new Date(year, month, 0).getDate();
        const { data } = await api.get<CalendarEvent[]>("/academics/calendar", {
          params: { start_date: `${selectedMonth}-01`, end_date: `${selectedMonth}-${String(lastDay).padStart(2, "0")}` },
        });
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

  const formatDate = (date: string) => fmtDate(date, { day: "numeric", month: "short" });
  const typeLabel = (type: string) => {
    const key = `principal.calendar.types.${type}`;
    const label = t(key);
    return label === key ? type : label;
  };

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={t("principal.calendar.title")} subtitle={t("principal.calendar.subtitle")} />

      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-ink-2">{t("principal.calendar.month")}</label>
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
                    <Badge tone={eventTypeColors[event.event_type] || "gray"}>{typeLabel(event.event_type)}</Badge>
                  </div>
                  {event.description && (
                    <p className="text-sm text-ink-2">{event.description}</p>
                  )}
                </div>
                <div className="text-end">
                  <p className="text-sm font-medium text-accent-fg dark:text-accent-fg">
                    {formatDate(event.event_date)}
                  </p>
                </div>
              </div>
            </Card>
          ))}
          {eventsQuery.data?.length === 0 && (
            <Card>
              <p className="text-center text-ink-3 py-8">{t("principal.calendar.empty")}</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
