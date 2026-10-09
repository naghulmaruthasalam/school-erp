import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useLanguage } from "../i18n/LanguageContext";
import { Badge, Button, Card, Modal, PageHeader, Spinner } from "./ui";

interface LangInfo { id: string; chars: number; source: "original" | "translation"; status: string; flags: string[] }
interface UnitRow { grade: number; subject: string; subject_key: string; unit_number: number; title_en: string | null; title_ar: string | null; languages: { en: LangInfo | null; ar: LangInfo | null } }
interface Overview { grades: { grade: number; units: number }[]; units: UnitRow[] }
interface Job { id: string; status: string; total: number; translated: number; skipped: number; failed: number; messages: string[] }
interface Edition { id: string; title: string | null; full_text: string; source: string; status: string; flags: string[] }
interface UnitDetail { subject: string; unit_number: number; en: Edition | null; ar: Edition | null }

function StatusBadge({ info }: { info: LangInfo | null }) {
  const { t } = useLanguage();
  if (!info) return <Badge tone="gray">{t("lead.library.missing")}</Badge>;
  if (info.source === "original") return <Badge tone="blue">{t("lead.library.original")}</Badge>;
  if (info.status === "reviewed") return <Badge tone="green">{t("lead.library.reviewed")}</Badge>;
  if (info.status === "needs_review") return <Badge tone="amber">{t("lead.library.needsReview")}</Badge>;
  return <Badge tone="violet">{t("lead.library.aiChecked")}</Badge>;
}

function ReviewModal({ row, canManage, onClose, onTranslate }: { row: UnitRow; canManage: boolean; onClose: () => void; onTranslate: (target: "en" | "ar") => void }) {
  const { t, fmtNumber } = useLanguage();
  const qc = useQueryClient();
  const detail = useQuery({
    queryKey: ["library", "unit", row.grade, row.subject, row.unit_number],
    queryFn: async () => (await api.get<UnitDetail>("/curriculum-library/unit", { params: { grade: row.grade, subject: row.subject, unit_number: row.unit_number } })).data,
  });
  const [drafts, setDrafts] = useState<Record<string, { title: string; text: string }>>({});
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const d = detail.data;
    if (d) setDrafts({ en: { title: d.en?.title ?? "", text: d.en?.full_text ?? "" }, ar: { title: d.ar?.title ?? "", text: d.ar?.full_text ?? "" } });
  }, [detail.data]);
  const save = useMutation({
    mutationFn: async (v: { id: string; lang: "en" | "ar"; approve: boolean; edited: boolean }) =>
      (await api.put(`/curriculum-library/units/${v.id}`, { title: drafts[v.lang]?.title ?? null, full_text: v.edited ? drafts[v.lang]?.text : null, approve: v.approve })).data,
    onSuccess: () => { setSaved(true); void qc.invalidateQueries({ queryKey: ["library"] }); },
  });
  const d = detail.data;
  const cols: ("en" | "ar")[] = ["en", "ar"];
  return (
    <Modal open onClose={onClose} title={`${t("lead.library.reviewTitle")} — ${row.subject} ${row.unit_number}`} size="xl">
      <div className="max-h-[75vh] space-y-3 overflow-y-auto px-6 pb-6" data-testid="review-modal">
        {detail.isLoading || !d ? <Spinner /> : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              {cols.map((lang) => {
                const e = d[lang];
                const draft = drafts[lang] ?? { title: e?.title ?? "", text: e?.full_text ?? "" };
                return (
                  <div key={lang} className="space-y-2 rounded-xl bg-surface-3 p-3" data-testid={`col-${lang}`}>
                    <div className="flex items-center justify-between gap-2">
                      <b className="text-sm text-ink">{t(lang === "ar" ? "lead.library.arabic" : "lead.library.english")}</b>
                      <StatusBadge info={e ? { id: e.id, chars: e.full_text.length, source: e.source as "original", status: e.status, flags: e.flags } : null} />
                    </div>
                    {!e ? <p className="text-sm text-ink-3">{t("lead.library.missing")}</p> : (
                      <>
                        {e.flags.length > 0 && (
                          <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300" data-testid={`flags-${lang}`}>
                            <b>{t("lead.library.flags")}</b><ul className="ms-4 list-disc">{e.flags.map((f, i) => <li key={i}>{f}</li>)}</ul>
                          </div>
                        )}
                        <input className="lg-field w-full" dir={lang === "ar" ? "rtl" : "ltr"} aria-label={t("lead.library.titleLabel")} value={draft.title} readOnly={e.source === "original"}
                          onChange={(ev) => setDrafts({ ...drafts, [lang]: { ...draft, title: ev.target.value } })} />
                        <textarea className="lg-field h-72 w-full text-sm leading-relaxed" dir={lang === "ar" ? "rtl" : "ltr"} aria-label={t("lead.library.textLabel")} data-testid={`text-${lang}`}
                          value={draft.text} readOnly={e.source === "original"} onChange={(ev) => setDrafts({ ...drafts, [lang]: { ...draft, text: ev.target.value } })} />
                        <p className="text-xs text-ink-3">{e.source === "original" ? t("lead.library.readOnly") : t("lead.library.chars", { n: fmtNumber(draft.text.length) })}</p>
                        {e.source === "translation" && (
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" disabled={save.isPending} onClick={() => { setSaved(false); save.mutate({ id: e.id, lang, approve: true, edited: draft.text !== e.full_text }); }} data-testid={`approve-${lang}`}>{t("lead.library.approve")}</Button>
                            <Button size="sm" variant="secondary" disabled={save.isPending || (draft.text === e.full_text && draft.title === (e.title ?? ""))}
                              onClick={() => { setSaved(false); save.mutate({ id: e.id, lang, approve: false, edited: draft.text !== e.full_text }); }}>{t("lead.library.save")}</Button>
                            {canManage && <Button size="sm" variant="secondary" onClick={() => onTranslate(lang)}>{t("lead.library.translateUnit")}</Button>}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            {saved && <p className="text-sm text-emerald-600" data-testid="review-saved">{t("lead.library.saved")}</p>}
          </>
        )}
      </div>
    </Modal>
  );
}

/** Std 1-12: the textbook library in both languages. Managers add units and translate; teachers and managers review. */
export default function CurriculumLibrary({ canManage }: { canManage: boolean }) {
  const { t, te, fmtNumber } = useLanguage();
  const qc = useQueryClient();
  const [grade, setGrade] = useState<number | null>(null);
  const [review, setReview] = useState<UnitRow | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [upload, setUpload] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const overview = useQuery({ queryKey: ["library", "overview"], queryFn: async () => (await api.get<Overview>("/curriculum-library")).data });
  useEffect(() => {
    if (grade === null && overview.data) setGrade(overview.data.grades.find((g) => g.units > 0)?.grade ?? 1);
  }, [overview.data, grade]);
  const job = useQuery({
    queryKey: ["library", "job", jobId], enabled: !!jobId,
    queryFn: async () => (await api.get<Job>(`/curriculum-library/jobs/${jobId}`)).data,
    refetchInterval: (q) => (q.state.data && ["done", "failed"].includes(q.state.data.status) ? false : 1500),
  });
  useEffect(() => { if (job.data && ["done", "failed"].includes(job.data.status)) void qc.invalidateQueries({ queryKey: ["library"] }); }, [job.data?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const translate = useMutation({
    mutationFn: async (v: { grade: number; subject?: string; unit_number?: number; target: string }) => (await api.post<{ job_id: string }>("/curriculum-library/translate", v)).data,
    onSuccess: (r) => setJobId(r.job_id),
  });
  const ingest = useMutation({
    mutationFn: async (file: File) => { const f = new FormData(); f.append("file", file); return (await api.post("/curriculum-library/ingest", f)).data as { inserted: number; updated: number; unchanged: number; skipped: number; grades: number[]; problems: string[] }; },
    onSuccess: (r) => { setUpload(t("lead.library.uploadDone", { inserted: r.inserted, updated: r.updated, unchanged: r.unchanged, skipped: r.skipped, grades: r.grades.join(", ") || "—" }) + (r.problems.length ? ` ${r.problems[0]}` : "")); void qc.invalidateQueries({ queryKey: ["library"] }); if (r.grades[0]) setGrade(r.grades[0]); },
  });
  const rows = (overview.data?.units ?? []).filter((u) => u.grade === grade);
  const j = job.data;
  return (
    <div className="animate-page-enter">
      <PageHeader title={t("lead.library.title")} subtitle={t("lead.library.subtitle")}>
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept=".ndjson,.json,.jsonl" hidden data-testid="library-file" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setUpload(null); ingest.mutate(f); } e.target.value = ""; }} />
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={ingest.isPending}>{ingest.isPending ? t("lead.library.uploading") : t("lead.library.upload")}</Button>
            <Button onClick={() => grade && translate.mutate({ grade, target: "both" })} disabled={!grade || translate.isPending || (!!j && j.status === "running")} data-testid="translate-grade">
              {t("lead.library.translateMissing")} ({t("lead.library.grade", { n: fmtNumber(grade ?? 0) })})
            </Button>
          </div>
        )}
      </PageHeader>
      {upload && <p className="mb-3 text-sm text-ink-2" data-testid="upload-note">{upload}</p>}
      {j && (
        <Card className="mb-4" gradient>
          <div data-testid="job-card">
          <p className="text-sm font-semibold text-ink">{t("lead.library.jobTitle")}: {j.status === "done" || j.status === "failed" ? t("lead.library.jobDone", { translated: j.translated, skipped: j.skipped, failed: j.failed }) : `${t("lead.library.translating")} ${t("lead.library.jobProgress", { done: j.translated + j.skipped + j.failed, total: j.total })}`}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${j.total ? Math.round(100 * (j.translated + j.skipped + j.failed) / j.total) : j.status === "done" ? 100 : 5}%` }} /></div>
          {j.messages.length > 0 && <ul className="mt-2 max-h-28 overflow-y-auto text-xs text-ink-3" dir="ltr">{j.messages.slice(-6).map((m, i) => <li key={i}>{m}</li>)}</ul>}
          </div>
        </Card>
      )}
      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label={t("lead.library.title")}>
        {(overview.data?.grades ?? []).map((g) => (
          <button key={g.grade} role="tab" aria-selected={grade === g.grade} data-testid={`grade-${g.grade}`}
            className={`lg-chip cursor-pointer ${grade === g.grade ? "!bg-accent !text-white" : ""}`} onClick={() => setGrade(g.grade)}>
            {t("lead.library.grade", { n: fmtNumber(g.grade) })}{g.units > 0 && <span className="opacity-70"> · {fmtNumber(g.units)}</span>}
          </button>
        ))}
      </div>
      <Card gradient>
        {overview.isLoading ? <div className="flex justify-center py-8"><Spinner /></div> : overview.isError ? <p className="text-sm text-ink-3">{t("lead.library.loadFailed")}</p> : rows.length === 0 ? <p className="py-6 text-center text-sm text-ink-3">{t("lead.library.empty")}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead><tr className="text-xs uppercase tracking-wide text-ink-3">
                <th className="px-2 py-2 text-start">{t("lead.library.subject")}</th><th className="px-2 py-2 text-start">{t("lead.library.unit")}</th><th className="px-2 py-2 text-start">{t("lead.library.unitTitle")}</th>
                <th className="px-2 py-2 text-start">{t("lead.library.english")}</th><th className="px-2 py-2 text-start">{t("lead.library.arabic")}</th><th />
              </tr></thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={`${u.subject_key}-${u.unit_number}`} className="border-t border-line" data-testid="library-row">
                    <td className="px-2 py-2 font-medium text-ink">{te("subject", u.subject)}</td>
                    <td className="px-2 py-2" dir="ltr">{fmtNumber(u.unit_number)}</td>
                    <td className="px-2 py-2" dir="auto">{u.title_en ?? u.title_ar}</td>
                    <td className="px-2 py-2"><StatusBadge info={u.languages.en} /></td>
                    <td className="px-2 py-2"><StatusBadge info={u.languages.ar} /></td>
                    <td className="px-2 py-2 text-end"><Button size="sm" variant="secondary" onClick={() => setReview(u)} data-testid="review-btn">{t("lead.library.review")}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-ink-3">{t("lead.library.note")}</p>
      </Card>
      {review && <ReviewModal row={review} canManage={canManage} onClose={() => setReview(null)}
        onTranslate={(target) => { translate.mutate({ grade: review.grade, subject: review.subject, unit_number: review.unit_number, target }); setReview(null); }} />}
    </div>
  );
}
