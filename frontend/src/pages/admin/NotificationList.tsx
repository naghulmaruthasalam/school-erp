import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button, Card, PageHeader, Spinner, Badge } from "../../components/ui";
import { api } from "../../api/client";
import type { PageResponse } from "../../types/common";
import { useLanguage } from "../../i18n/LanguageContext";

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
  const { t, fmtDate } = useLanguage();
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
      <PageHeader title={t("admin.notifications.title")} subtitle={t("admin.notifications.subtitle")}>
        <Button onClick={() => setShowForm(!showForm)}>{showForm ? t("admin.common.cancel") : t("admin.notifications.new")}</Button>
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
              <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.common.title")}</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500 focus:ring-violet-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.common.content")}</label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500 focus:ring-violet-500"
                rows={4}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.common.type")}</label>
                <select
                  value={form.notification_type}
                  onChange={(e) => setForm({ ...form, notification_type: e.target.value })}
                  className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500 focus:ring-violet-500"
                >
                  <option value="ANNOUNCEMENT">{t("admin.notifType.ANNOUNCEMENT")}</option>
                  <option value="NOTICE">{t("admin.notifType.NOTICE")}</option>
                  <option value="ALERT">{t("admin.notifType.ALERT")}</option>
                  <option value="REMINDER">{t("admin.notifType.REMINDER")}</option>
                  <option value="EVENT">{t("admin.notifType.EVENT")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-2 mb-1">{t("admin.common.priority")}</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full rounded-lg border border-line px-3 py-2 focus:border-violet-500 focus:ring-violet-500"
                >
                  <option value="LOW">{t("admin.priority.LOW")}</option>
                  <option value="NORMAL">{t("admin.priority.NORMAL")}</option>
                  <option value="HIGH">{t("admin.priority.HIGH")}</option>
                  <option value="URGENT">{t("admin.priority.URGENT")}</option>
                </select>
              </div>
            </div>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? t("admin.common.creating") : t("admin.notifications.create")}
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
                    <h3 className="font-semibold text-ink">{n.title}</h3>
                    <Badge tone={n.priority === "URGENT" ? "red" : n.priority === "HIGH" ? "yellow" : n.priority === "LOW" ? "gray" : "violet"}>{t(`admin.priority.${n.priority}`)}</Badge>
                    <Badge tone="violet">{t(`admin.notifType.${n.notification_type}`)}</Badge>
                  </div>
                  <p className="text-ink-2 mb-2">{n.content}</p>
                  <p className="text-xs text-accent-fg">
                    {t("admin.notifications.by", { name: n.created_by_name, date: fmtDate(n.created_at) })}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (confirm(t("admin.notifications.confirmDelete"))) {
                      deleteMutation.mutate(n.id);
                    }
                  }}
                >
                  {t("admin.common.delete")}
                </Button>
              </div>
            </Card>
          ))}
          {data?.items.length === 0 && (
            <Card>
              <p className="text-center text-accent-fg py-8">{t("admin.notifications.empty")}</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
