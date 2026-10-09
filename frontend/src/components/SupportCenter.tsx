import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api/client";
import { useLanguage } from "../i18n/LanguageContext";
import { Badge, Button, Card, PageHeader, Spinner } from "./ui";
import type { PageResponse } from "../types/common";

export const CATEGORIES = ["ACADEMICS", "TEACHING", "FACILITIES", "TRANSPORT", "FEES", "SAFETY", "TECHNICAL", "OTHER"] as const;
export const STATUS_TONE: Record<string, "blue" | "amber" | "green" | "gray"> = { OPEN: "blue", IN_PROGRESS: "amber", RESOLVED: "green", CLOSED: "gray" };

export interface TicketRow {
  id: string; ticket_no: string; school_name: string | null; raised_by_name: string; raised_by_role: string; student_name: string | null;
  category: string; subject: string; description: string; rating: number | null; priority: string; status: string; created_at: string; last_activity_at: string;
}
export interface TicketDetail extends TicketRow { replies: { id: string; author_name: string; author_role: string; message: string; created_at: string }[] }

/** A ticket's description and its conversation, with a box to reply. `extra` adds staff-only controls (status). */
export function TicketThread({ id, extra, onChanged }: { id: string; extra?: (t: TicketDetail) => React.ReactNode; onChanged?: () => void }) {
  const { t, fmtDate } = useLanguage();
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");
  const detail = useQuery({ queryKey: ["ticket", id], queryFn: async () => (await api.get<TicketDetail>(`/tickets/${id}`)).data });
  const send = useMutation({
    mutationFn: async () => (await api.post(`/tickets/${id}/replies`, { message: msg })).data,
    onSuccess: () => { setMsg(""); void qc.invalidateQueries({ queryKey: ["ticket", id] }); void qc.invalidateQueries({ queryKey: ["tickets"] }); onChanged?.(); },
  });
  if (detail.isLoading) return <div className="flex justify-center py-8"><Spinner /></div>;
  const d = detail.data;
  if (!d) return null;
  return (
    <div className="space-y-3" data-testid="ticket-thread">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-ink-3" dir="ltr">{d.ticket_no}</span>
        <Badge tone={STATUS_TONE[d.status] ?? "gray"}>{t(`lead.tickets.status.${d.status}`)}</Badge>
        <Badge tone="violet">{t(`lead.tickets.cat.${d.category}`)}</Badge>
        {d.priority !== "NORMAL" && <Badge tone="red">{t(`lead.tickets.prio.${d.priority}`)}</Badge>}
        {d.rating != null && <Badge tone="amber">{t("lead.tickets.rated")}: <span dir="ltr">{d.rating}/5</span></Badge>}
      </div>
      <h3 className="text-base font-semibold text-ink" dir="auto">{d.subject}</h3>
      <p className="whitespace-pre-line rounded-xl bg-surface-3 p-3 text-sm text-ink-2" dir="auto">{d.description}</p>
      <p className="text-xs text-ink-3">{d.raised_by_name} · {t(d.raised_by_role === "PARENT" ? "lead.tickets.parent" : "lead.tickets.student")}{d.student_name ? ` · ${d.student_name}` : ""}{d.school_name ? ` · ${d.school_name}` : ""} · {fmtDate(d.created_at)}</p>
      {extra?.(d)}
      <div className="space-y-2">
        {d.replies.length === 0 && <p className="text-sm text-ink-3">{t("lead.tickets.noReplies")}</p>}
        {d.replies.map((r) => (
          <div key={r.id} className={`rounded-xl p-3 text-sm ${r.author_role === d.raised_by_role ? "bg-surface-3" : "bg-accent/10"}`} data-testid="ticket-reply">
            <p className="mb-0.5 text-xs font-semibold text-ink-3">{r.author_name} · {fmtDate(r.created_at)}</p>
            <p className="whitespace-pre-line text-ink-2" dir="auto">{r.message}</p>
          </div>
        ))}
      </div>
      {d.status === "CLOSED" ? <p className="text-sm text-ink-3">{t("lead.tickets.closedNote")}</p> : (
        <div className="flex gap-2">
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={2} maxLength={4000} dir="auto" placeholder={t("lead.tickets.replyPh")} className="lg-field w-full" data-testid="reply-input" />
          <Button onClick={() => send.mutate()} disabled={!msg.trim() || send.isPending}>{t("lead.tickets.send")}</Button>
        </div>
      )}
    </div>
  );
}

/** Student and parent: raise a ticket and follow the replies. */
export default function SupportCenter({ role }: { role: "student" | "parent" }) {
  const { t, fmtDate } = useLanguage();
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ category: "TEACHING", subject: "", description: "", rating: 0, teacher_id: "", student_id: "" });
  const [notice, setNotice] = useState<"ok" | "fail" | null>(null);
  const list = useQuery({ queryKey: ["tickets", "mine"], queryFn: async () => (await api.get<PageResponse<TicketRow>>("/tickets", { params: { page_size: 100 } })).data });
  const teachers = useQuery({ queryKey: ["tickets", "teachers"], queryFn: async () => (await api.get<{ id: string; name: string }[]>("/tickets/teachers")).data });
  const children = useQuery({
    queryKey: ["tickets", "children"], enabled: role === "parent",
    queryFn: async () => (await api.get<{ id: string; full_name: string }[]>("/students/my-children")).data,
  });
  const create = useMutation({
    mutationFn: async () => (await api.post("/tickets", {
      category: form.category, subject: form.subject, description: form.description, rating: form.rating || null,
      teacher_id: form.teacher_id || null, student_id: form.student_id || null,
    })).data,
    onSuccess: () => { setNotice("ok"); setForm({ ...form, subject: "", description: "", rating: 0, teacher_id: "" }); void qc.invalidateQueries({ queryKey: ["tickets"] }); },
    onError: () => setNotice("fail"),
  });
  return (
    <div className="animate-page-enter">
      <PageHeader title={t("lead.tickets.title")} subtitle={t("lead.tickets.subtitle")} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <Card gradient>
          <h2 className="mb-3 text-base font-semibold text-ink">{t("lead.tickets.raise")}</h2>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); setNotice(null); create.mutate(); }}>
            <label className="block text-sm"><span className="mb-1 block font-medium text-ink">{t("lead.tickets.category")}</span>
              <select className="lg-field w-full" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="ticket-category">
                {CATEGORIES.map((c) => <option key={c} value={c}>{t(`lead.tickets.cat.${c}`)}</option>)}
              </select></label>
            {role === "parent" && (children.data ?? []).length > 0 && (
              <label className="block text-sm"><span className="mb-1 block font-medium text-ink">{t("lead.tickets.child")}</span>
                <select className="lg-field w-full" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
                  <option value="">—</option>{children.data!.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select></label>
            )}
            {(teachers.data ?? []).length > 0 && (
              <label className="block text-sm"><span className="mb-1 block font-medium text-ink">{t("lead.tickets.teacher")}</span>
                <select className="lg-field w-full" value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}>
                  <option value="">{t("lead.tickets.noTeacher")}</option>{teachers.data!.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select></label>
            )}
            <label className="block text-sm"><span className="mb-1 block font-medium text-ink">{t("lead.tickets.subject")}</span>
              <input className="lg-field w-full" value={form.subject} maxLength={200} dir="auto" placeholder={t("lead.tickets.subjectPh")} onChange={(e) => setForm({ ...form, subject: e.target.value })} data-testid="ticket-subject" /></label>
            <label className="block text-sm"><span className="mb-1 block font-medium text-ink">{t("lead.tickets.details")}</span>
              <textarea className="lg-field w-full" rows={4} value={form.description} maxLength={4000} dir="auto" placeholder={t("lead.tickets.detailsPh")} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="ticket-description" /></label>
            <div className="text-sm">
              <span className="mb-1 block font-medium text-ink">{t("lead.tickets.rating")}</span>
              <div className="flex items-center gap-1" role="radiogroup">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={form.rating === n} onClick={() => setForm({ ...form, rating: form.rating === n ? 0 : n })}
                    className={`h-9 w-9 rounded-full text-sm font-semibold transition ${form.rating === n ? "bg-accent text-white" : "bg-surface-3 text-ink-2 hover:bg-surface-2"}`} data-testid={`rate-${n}`}>{n}</button>
                ))}
              </div>
              <span className="mt-1 block text-xs text-ink-3">{t("lead.tickets.ratingHint")}</span>
            </div>
            <Button type="submit" glow disabled={!form.subject.trim() || !form.description.trim() || create.isPending} data-testid="ticket-submit">{t("lead.tickets.submit")}</Button>
            {notice === "ok" && <p className="text-sm text-emerald-600" data-testid="ticket-sent">{t("lead.tickets.sent")}</p>}
            {notice === "fail" && <p className="text-sm text-red-600">{t("lead.tickets.failed")}</p>}
          </form>
        </Card>
        <Card gradient>
          <h2 className="mb-3 text-base font-semibold text-ink">{t("lead.tickets.mine")}</h2>
          {list.isLoading ? <Spinner /> : (list.data?.items ?? []).length === 0 ? <p className="text-sm text-ink-3">{t("lead.tickets.empty")}</p> : (
            <ul className="space-y-2">
              {list.data!.items.map((x) => (
                <li key={x.id} className="rounded-xl bg-surface-3 p-3">
                  <button type="button" className="flex w-full flex-wrap items-center justify-between gap-2 text-start" onClick={() => setOpen(open === x.id ? null : x.id)} data-testid="ticket-row">
                    <span className="min-w-0 font-medium text-ink" dir="auto">{x.subject}</span>
                    <span className="flex items-center gap-2"><Badge tone={STATUS_TONE[x.status] ?? "gray"}>{t(`lead.tickets.status.${x.status}`)}</Badge><span className="text-xs text-ink-3">{fmtDate(x.last_activity_at)}</span></span>
                  </button>
                  {open === x.id && <div className="mt-3 border-t border-line pt-3"><TicketThread id={x.id} /></div>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
