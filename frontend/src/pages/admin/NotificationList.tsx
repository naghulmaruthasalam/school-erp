import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, PageHeader, Spinner, Badge } from "../../components/ui";
import { api } from "../../api/client";
import type { PageResponse } from "../../types/common";

interface Notification {
  id: string;
  title: string;
  content: string;
  notification_type: string;
  priority: string;
  is_published: boolean;
  created_by_name: string;
  created_at: string;
  is_read: boolean;
}

interface CreatePayload {
  title: string;
  content: string;
  notification_type: string;
  priority: string;
  target_roles: string[];
}

export default function NotificationList() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreatePayload>({
    title: "",
    content: "",
    notification_type: "ANNOUNCEMENT",
    priority: "NORMAL",
    target_roles: [],
  });

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data } = await api.get<PageResponse<Notification>>("/notifications", {
        params: { include_expired: true },
      });
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: CreatePayload) => {
      const { data } = await api.post("/notifications", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setShowForm(false);
      setForm({ title: "", content: "", notification_type: "ANNOUNCEMENT", priority: "NORMAL", target_roles: [] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/notifications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Notifications & Announcements" subtitle="Manage school-wide communications">
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? "Cancel" : "New Announcement"}</Button>
      </PageHeader>

      {showForm && (
        <Card className="mb-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate(form);
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-violet-700 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500 focus:ring-violet-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-violet-700 mb-1">Content</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500 focus:ring-violet-500"
                rows={4}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-violet-700 mb-1">Type</label>
                <select
                  value={form.notification_type}
                  onChange={(e) => setForm({ ...form, notification_type: e.target.value })}
                  className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500 focus:ring-violet-500"
                >
                  <option value="ANNOUNCEMENT">Announcement</option>
                  <option value="NOTICE">Notice</option>
                  <option value="ALERT">Alert</option>
                  <option value="REMINDER">Reminder</option>
                  <option value="EVENT">Event</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-violet-700 mb-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full rounded-lg border border-violet-200 px-3 py-2 focus:border-violet-500 focus:ring-violet-500"
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Announcement"}
            </Button>
          </form>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="space-y-4">
          {data?.items.map((n) => (
            <Card key={n.id}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-violet-900">{n.title}</h3>
                    <Badge tone={n.priority === "URGENT" ? "red" : n.priority === "HIGH" ? "yellow" : n.priority === "LOW" ? "gray" : "violet"}>{n.priority}</Badge>
                    <Badge tone="violet">{n.notification_type}</Badge>
                  </div>
                  <p className="text-violet-700 mb-2">{n.content}</p>
                  <p className="text-xs text-violet-400">
                    By {n.created_by_name} · {new Date(n.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (confirm("Delete this notification?")) {
                      deleteMutation.mutate(n.id);
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
          {data?.items.length === 0 && (
            <Card>
              <p className="text-center text-violet-400 py-8">No notifications yet.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
