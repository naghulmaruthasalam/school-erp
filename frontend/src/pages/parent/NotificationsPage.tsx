import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, PageHeader, Spinner, Badge } from "../../components/ui";
import { api } from "../../api/client";
import type { PageResponse } from "../../types/common";
import { useLanguage } from "../../i18n/LanguageContext";

interface Notification {
  id: string;
  title: string;
  content: string;
  notification_type: string;
  priority: string;
  created_by_name: string;
  created_at: string;
  is_read: boolean;
  link?: string | null;
}

export default function ParentNotifications() {
  const { t, fmtDate } = useLanguage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const label = (prefix: string, v: string) => {
    const k = `${prefix}.${v}`;
    const r = t(k);
    return r === k ? v : r;
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["parent-notifications"],
    queryFn: async () => {
      const { data } = await api.get<PageResponse<Notification>>("/notifications");
      return data;
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parent-notifications"] });
    },
  });

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={t("parent.notifications.title")} subtitle={t("parent.notifications.subtitle")} />

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : isError ? (
        <Card><p className="text-center text-red-500 py-8">{t("parent.notifications.loadError")}</p></Card>
      ) : (
        <div className="space-y-3">
          {(data?.items ?? []).map((n) => (
            <div
              key={n.id}
              className={`cursor-pointer transition-all ${!n.is_read ? "border-s-4 border-s-violet-500" : ""}`}
              onClick={() => { if (!n.is_read) markReadMutation.mutate(n.id); if (n.link) navigate(n.link); }}
            >
              <Card className={!n.is_read ? "bg-violet-50/50" : ""}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className={`font-semibold ${!n.is_read ? "text-ink" : "text-ink-2"}`}>
                        {n.title}
                      </h3>
                      <Badge tone={n.notification_type === "ALERT" ? "red" : n.notification_type === "REMINDER" ? "yellow" : n.notification_type === "EVENT" ? "green" : "violet"}>{label("parent.notifications.types", n.notification_type)}</Badge>
                      <Badge tone={n.priority === "URGENT" ? "red" : n.priority === "HIGH" ? "yellow" : n.priority === "LOW" ? "gray" : "violet"}>{label("parent.notifications.priorities", n.priority)}</Badge>
                      {!n.is_read && <Badge tone="violet">{t("parent.notifications.new")}</Badge>}
                    </div>
                    <p className="text-ink-2 mb-2">{n.content}</p>
                    <p className="text-xs text-accent-fg">
                      {t("parent.notifications.by", { name: n.created_by_name })} · {fmtDate(n.created_at)}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          ))}
          {(data?.items?.length ?? 0) === 0 && (
            <Card>
              <p className="text-center text-accent-fg py-8">{t("parent.notifications.empty")}</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
