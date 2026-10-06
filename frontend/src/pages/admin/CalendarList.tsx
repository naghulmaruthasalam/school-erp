import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, PageHeader, Spinner, Badge } from "../../components/ui";
import { api } from "../../api/client";
import { fetchAcademicYears } from "./api";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_type: string;
  academic_year_id: string;
}

const EVENT_TYPES = [
  { value: "HOLIDAY", label: "Holiday", color: "bg-red-100 text-red-700" },
  { value: "EXAM", label: "Exam", color: "bg-yellow-100 text-yellow-700" },
  { value: "MEETING", label: "Meeting", color: "bg-blue-100 text-blue-700" },
  { value: "EVENT", label: "Event", color: "bg-green-100 text-green-700" },
  { value: "OTHER", label: "Other", color: "bg-gray-100 text-gray-700" },
];

export default function CalendarList() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    event_date: "",
    event_type: "EVENT",
    academic_year_id: "",
  });

  const yearsQuery = useQuery({ queryKey: ["academic-years"], queryFn: fetchAcademicYears });

  const eventsQuery = useQuery({
    queryKey: ["calendar-events", selectedYear],
    queryFn: async () => {
      const { data } = await api.get<CalendarEvent[]>("/academics/calendar", {
        params: selectedYear ? { academic_year_id: selectedYear } : undefined,
      });
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const { data } = await api.post("/academics/calendar", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      setShowForm(false);
      setForm({ title: "", description: "", event_date: "", event_type: "EVENT", academic_year_id: "" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/academics/calendar/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    },
  });

  const groupedEvents = (eventsQuery.data || []).reduce((acc, event) => {
    const month = new Date(event.event_date).toLocaleString("default", { month: "long", year: "numeric" });
    if (!acc[month]) acc[month] = [];
    acc[month].push(event);
    return acc;
  }, {} as Record<string, CalendarEvent[]>);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Academic Calendar" subtitle="Holidays, events, and important dates">
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "Add Event"}</Button>
      </PageHeader>

      <Card className="mb-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-violet-700">Academic Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500"
          >
            <option value="">All Years</option>
            {yearsQuery.data?.map((y) => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>
        </div>
      </Card>

      {showForm && (
        <Card className="mb-6">
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-medium text-violet-700 mb-1">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-violet-700 mb-1">Date</label>
                <input
                  type="date"
                  value={form.event_date}
                  onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                  className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-violet-700 mb-1">Type</label>
                <select
                  value={form.event_type}
                  onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                  className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-violet-700 mb-1">Academic Year</label>
                <select
                  value={form.academic_year_id}
                  onChange={(e) => setForm({ ...form, academic_year_id: e.target.value })}
                  className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500"
                  required
                >
                  <option value="">-- Select --</option>
                  {yearsQuery.data?.map((y) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-violet-700 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500"
                />
              </div>
            </div>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Adding..." : "Add Event"}
            </Button>
          </form>
        </Card>
      )}

      {eventsQuery.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : Object.keys(groupedEvents).length === 0 ? (
        <Card><p className="text-center text-violet-400 py-8">No events found.</p></Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedEvents).map(([month, events]) => (
            <div key={month}>
              <h3 className="text-lg font-semibold text-violet-900 mb-3">{month}</h3>
              <div className="space-y-2">
                {events.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()).map((event) => (
                  <Card key={event.id}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-center min-w-[50px]">
                          <p className="text-2xl font-bold text-violet-600">
                            {new Date(event.event_date).getDate()}
                          </p>
                          <p className="text-xs text-violet-400">
                            {new Date(event.event_date).toLocaleString("default", { weekday: "short" })}
                          </p>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-violet-900">{event.title}</p>
                            <Badge tone={event.event_type === "HOLIDAY" ? "red" : event.event_type === "EXAM" ? "yellow" : event.event_type === "EVENT" ? "green" : event.event_type === "OTHER" ? "gray" : "violet"}>{event.event_type}</Badge>
                          </div>
                          {event.description && <p className="text-sm text-violet-600">{event.description}</p>}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteMutation.mutate(event.id)}
                        className="text-sm text-red-500 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
