import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useLanguage } from "../i18n/LanguageContext";
import { Badge, Card, PageHeader, Spinner } from "./ui";
import type { PageResponse } from "../types/common";

interface N { id: string; title: string; content: string; priority: string; category?: string | null; link?: string | null; created_at: string; is_read: boolean }

/** A plain list of the signed-in user's notifications; each opens its page when it has a link. (Super admin.) */
export default function NotificationsFeed() {
  const { t, fmtDate } = useLanguage();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const list = useQuery({ queryKey: ["feed-notifications"], queryFn: async () => (await api.get<PageResponse<N>>("/notifications", { params: { page_size: 100 } })).data });
  const read = useMutation({
    mutationFn: async (id: string) => { await api.post(`/notifications/${id}/read`); },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["feed-notifications"] }); void qc.invalidateQueries({ queryKey: ["notification-count"] }); },
  });
  return (
    <div className="animate-page-enter">
      <PageHeader title={t("navigation.notifications")} />
      {list.isLoading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <div className="space-y-3">
          {(list.data?.items ?? []).length === 0 && <Card><p className="text-sm text-ink-3">—</p></Card>}
          {list.data?.items.map((n) => (
            <button key={n.id} type="button" className={`block w-full text-start ${!n.is_read ? "border-s-4 border-s-violet-500" : ""}`}
              onClick={() => { if (!n.is_read) read.mutate(n.id); if (n.link) navigate(n.link); }}>
              <Card className={!n.is_read ? "bg-violet-50/50" : ""}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="font-semibold text-ink" dir="auto">{n.title}</p><p className="mt-0.5 text-sm text-ink-2" dir="auto">{n.content}</p></div>
                  <div className="shrink-0 text-end">{n.priority !== "NORMAL" && <Badge tone={n.priority === "URGENT" ? "red" : "amber"}>{n.priority}</Badge>}<p className="mt-1 text-xs text-ink-3">{fmtDate(n.created_at)}</p></div>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
