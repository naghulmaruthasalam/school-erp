import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import { useLanguage } from "../i18n/LanguageContext";
import { Badge, Card, PageHeader, Spinner } from "./ui";
import { CATEGORIES, STATUS_TONE, TicketThread, type TicketRow } from "./SupportCenter";
import type { PageResponse } from "../types/common";

const STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

/** Principal, school admin and super admin: every ticket in their scope (a school; or all schools for the platform). */
export default function TicketDesk({ platform = false }: { platform?: boolean }) {
  const { t, fmtDate, fmtNumber } = useLanguage();
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const params = { status: status || undefined, category: category || undefined, school_id: schoolId || undefined, page_size: 100 };
  const list = useQuery({ queryKey: ["tickets", "desk", params], queryFn: async () => (await api.get<PageResponse<TicketRow>>("/tickets", { params })).data });
  const summary = useQuery({
    queryKey: ["tickets", "summary", schoolId],
    queryFn: async () => (await api.get<{ total: number; by_status: Record<string, number>; open_high_priority: number }>("/tickets/summary", { params: { school_id: schoolId || undefined } })).data,
  });
  const schools = useQuery({
    queryKey: ["tickets", "schools"], enabled: platform,
    queryFn: async () => {
      const { data } = await api.get<PageResponse<TicketRow>>("/tickets", { params: { page_size: 200 } });
      const seen = new Map<string, string>();
      data.items.forEach((x) => { const sid = (x as unknown as { school_id: string }).school_id; if (sid && x.school_name) seen.set(sid, x.school_name); });
      return [...seen.entries()];
    },
  });
  const setTicketStatus = useMutation({
    mutationFn: async (v: { id: string; status: string }) => (await api.patch(`/tickets/${v.id}/status`, { status: v.status })).data,
    onSuccess: (_d, v) => { void qc.invalidateQueries({ queryKey: ["tickets"] }); void qc.invalidateQueries({ queryKey: ["ticket", v.id] }); },
  });
  const s = summary.data;
  const tiles: [string, number][] = [
    [t("lead.tickets.sumTotal"), s?.total ?? 0], [t("lead.tickets.sumOpen"), s?.by_status.OPEN ?? 0], [t("lead.tickets.sumProgress"), s?.by_status.IN_PROGRESS ?? 0],
    [t("lead.tickets.sumDone"), (s?.by_status.RESOLVED ?? 0) + (s?.by_status.CLOSED ?? 0)], [t("lead.tickets.sumHigh"), s?.open_high_priority ?? 0],
  ];
  return (
    <div className="animate-page-enter">
      <PageHeader title={t("lead.tickets.deskTitle")} subtitle={t("lead.tickets.deskSubtitle")} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map(([label, n]) => (
          <Card key={label} gradient><p className="text-xs font-semibold uppercase tracking-wide text-ink-3">{label}</p><p className="mt-1 text-2xl font-bold text-ink" dir="ltr">{fmtNumber(n)}</p></Card>
        ))}
      </div>
      <Card gradient>
        <div className="mb-3 flex flex-wrap gap-2">
          <select className="lg-field" value={status} onChange={(e) => setStatus(e.target.value)} data-testid="filter-status">
            <option value="">{t("lead.tickets.allStatuses")}</option>{STATUSES.map((x) => <option key={x} value={x}>{t(`lead.tickets.status.${x}`)}</option>)}
          </select>
          <select className="lg-field" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">{t("lead.tickets.allCategories")}</option>{CATEGORIES.map((x) => <option key={x} value={x}>{t(`lead.tickets.cat.${x}`)}</option>)}
          </select>
          {platform && (schools.data ?? []).length > 0 && (
            <select className="lg-field" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
              <option value="">{t("lead.tickets.allSchools")}</option>{schools.data!.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          )}
        </div>
        {list.isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : (list.data?.items ?? []).length === 0 ? <p className="text-sm text-ink-3">{t("lead.tickets.empty")}</p> : (
          <ul className="space-y-2">
            {list.data!.items.map((x) => (
              <li key={x.id} className="rounded-xl bg-surface-3 p-3" data-testid="desk-row">
                <button type="button" className="flex w-full flex-wrap items-center justify-between gap-2 text-start" onClick={() => setOpen(open === x.id ? null : x.id)}>
                  <span className="min-w-0">
                    <span className="block font-medium text-ink" dir="auto">{x.subject}</span>
                    <span className="block text-xs text-ink-3"><span dir="ltr">{x.ticket_no}</span> · {x.raised_by_name}{platform && x.school_name ? ` · ${x.school_name}` : ""} · {fmtDate(x.last_activity_at)}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    {x.priority !== "NORMAL" && <Badge tone="red">{t(`lead.tickets.prio.${x.priority}`)}</Badge>}
                    <Badge tone="violet">{t(`lead.tickets.cat.${x.category}`)}</Badge>
                    <Badge tone={STATUS_TONE[x.status] ?? "gray"}>{t(`lead.tickets.status.${x.status}`)}</Badge>
                  </span>
                </button>
                {open === x.id && (
                  <div className="mt-3 border-t border-line pt-3">
                    <TicketThread id={x.id} extra={(d) => (
                      <div className="flex flex-wrap items-center gap-2" data-testid="status-buttons">
                        <span className="text-xs font-semibold text-ink-3">{t("lead.tickets.setStatus")}</span>
                        {STATUSES.map((st) => (
                          <button key={st} type="button" disabled={d.status === st} onClick={() => setTicketStatus.mutate({ id: d.id, status: st })}
                            className={`lg-chip cursor-pointer ${d.status === st ? "!bg-accent !text-white" : ""}`} data-testid={`set-${st}`}>{t(`lead.tickets.status.${st}`)}</button>
                        ))}
                      </div>
                    )} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
