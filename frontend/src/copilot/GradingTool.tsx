import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileUp, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { Badge, Button, ErrorText, Input, Label, Select } from "../components/ui";
import type { CopilotFileInfo } from "./download";
import { useCopilotText } from "./i18n";
import { ExportPanel } from "./results";
import { Busy, Section, Shell } from "./toolkit";
import type { ToolProps } from "./ToolRunner";

const GR = "/copilot/grading";
interface PaperRow { id: string; class_name: string; subject_name: string; chapters: string[]; total_marks: number; question_count: number; created_at: string }
interface GradedQ { question_number: number; question_type: string; marks_possible: number; marks_awarded: number; student_answer: string; feedback: string; needs_review: boolean; adjusted: boolean }
interface Sheet { id: string; student_name: string; total_marks_possible: number; total_marks_awarded: number; needs_review: number; questions?: GradedQ[] }
interface JobStudent { student_name: string; status: "queued" | "grading" | "done" | "failed"; current_question: number | null; total_questions: number | null; result_id: string | null; error: string | null }
interface Job { id: string; students: JobStudent[]; finished: boolean }

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf";

function FilePicker({ files, onChange, label }: { files: File[]; onChange: (f: File[]) => void; label: string }) {
  const { t } = useCopilotText();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1">
      <input ref={ref} type="file" multiple accept={ACCEPT} className="hidden" data-testid="grading-files" aria-label={label}
        onChange={(e) => { onChange([...files, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} />
      <Button type="button" size="sm" variant="secondary" onClick={() => ref.current?.click()}><FileUp size={14} /> {files.length ? t("copilot.grading.addPages") : label}</Button>
      {files.length > 0 && (
        <ul className="space-y-0.5 text-xs text-ink-2">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate">{i + 1}. {f.name}</span>
              <button type="button" aria-label={t("copilot.grading.removeFile", { name: f.name })} className="text-ink-3 hover:text-red-600" onClick={() => onChange(files.filter((_, j) => j !== i))}><X size={12} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function GradingTool({ tool, onBack }: ToolProps) {
  const { t, tr, te, fmtDate, err } = useCopilotText();
  const qc = useQueryClient();
  const papers = useQuery({ queryKey: ["qpg", "papers"], queryFn: async () => (await api.get<PaperRow[]>("/copilot/qpg/papers")).data });
  const [paperId, setPaperId] = useState("");
  const [mode, setMode] = useState<"one" | "class">("one");
  const [name, setName] = useState("");
  const [pages, setPages] = useState<File[]>([]);
  const [rows, setRows] = useState<{ name: string; files: File[] }[]>([{ name: "", files: [] }]);
  const [job, setJob] = useState<Job | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => { if (!paperId && papers.data?.length) setPaperId(papers.data[0].id); }, [papers.data, paperId]);
  const paper = papers.data?.find((p) => p.id === paperId);
  const results = useQuery({
    queryKey: ["grading", "results", paperId],
    queryFn: async () => (await api.get<Sheet[]>(`${GR}/results`, { params: { paper_id: paperId } })).data,
    enabled: !!paperId,
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["grading", "results"] });

  const grade = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append("paper_id", paperId);
      form.append("student_name", name.trim());
      pages.forEach((f) => form.append("files", f));
      return (await api.post<Sheet>(`${GR}/evaluate`, form, { timeout: 300_000 })).data;
    },
    onSuccess: (s) => { setName(""); setPages([]); setOpen(s.id); refresh(); },
  });

  const startBatch = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      form.append("paper_id", paperId);
      form.append("students", JSON.stringify(rows.map((r) => ({ student_name: r.name.trim(), page_count: r.files.length }))));
      rows.forEach((r) => r.files.forEach((f) => form.append("files", f)));
      return (await api.post<Job>(`${GR}/batch`, form, { timeout: 300_000 })).data;
    },
    onSuccess: setJob,
  });
  // Poll the running batch every 2 seconds until every student is done or failed.
  useEffect(() => {
    if (!job || job.finished) return;
    const t = setTimeout(async () => {
      try { setJob((await api.get<Job>(`${GR}/batch/${job.id}`)).data); } catch { /* try again on the next tick */ }
    }, 2000);
    return () => clearTimeout(t);
  }, [job]);
  useEffect(() => { if (job?.finished) { refresh(); setRows([{ name: "", files: [] }]); } /* eslint-disable-next-line */ }, [job?.finished]);

  const oneReady = !!paperId && name.trim() && pages.length > 0;
  const classReady = !!paperId && rows.every((r) => r.name.trim() && r.files.length > 0);

  return (
    <Shell tool={tool} onBack={onBack}>
      {papers.isLoading && <Busy label={t("copilot.grading.loadingPapers")} />}
      {papers.data?.length === 0 && (
        <p className="rounded-2xl bg-surface-3 p-3 text-[13px] text-ink-3">{t("copilot.grading.noPapers")}</p>
      )}
      {!!papers.data?.length && (
        <>
          <div>
            <Label htmlFor="gr-paper">{t("copilot.qp.questionPaper")}</Label>
            <Select id="gr-paper" value={paperId} onChange={(e) => { setPaperId(e.target.value); setOpen(null); }}>
              {papers.data.map((p) => <option key={p.id} value={p.id}>{te("subject", p.subject_name)} · {te("class", p.class_name)} · {t("copilot.qp.marksN", { n: p.total_marks })} · {fmtDate(p.created_at)}</option>)}
            </Select>
            {paper && <p className="mt-0.5 text-xs text-ink-3">{paper.chapters.join(t("copilot.listSeparator"))} · {t("copilot.grading.questionCount", { n: paper.question_count })}</p>}
          </div>

          <div className="lg-seg w-full [&>button]:flex-1">
            <button aria-pressed={mode === "one"} onClick={() => setMode("one")}>{t("copilot.grading.oneStudent")}</button>
            <button aria-pressed={mode === "class"} onClick={() => setMode("class")}>{t("copilot.grading.severalStudents")}</button>
          </div>

          {mode === "one" ? (
            <Section title={t("copilot.grading.answerSheet")}>
              <Input aria-label={t("copilot.grading.studentName")} placeholder={t("copilot.grading.studentName")} value={name} onChange={(e) => setName(e.target.value)} />
              <FilePicker files={pages} onChange={setPages} label={t("copilot.grading.choosePhotos")} />
              <p className="text-xs text-ink-3">{t("copilot.grading.pagesHint")}</p>
              <Button className="w-full" onClick={() => grade.mutate()} disabled={!oneReady || grade.isPending}>{grade.isPending ? t("copilot.grading.grading") : t("copilot.grading.grade")}</Button>
              {grade.isPending && <Busy label={t("copilot.grading.busy")} />}
              {grade.isError && <ErrorText>{err(grade.error)}</ErrorText>}
            </Section>
          ) : (
            <Section title={t("copilot.grading.classSet")} right={<Button size="sm" variant="secondary" onClick={() => setRows((r) => [...r, { name: "", files: [] }])}><Plus size={13} /> {t("copilot.grading.student")}</Button>}>
              {rows.map((r, i) => (
                <div key={i} className="space-y-1.5 rounded-xl bg-surface p-2">
                  <div className="flex items-center gap-2">
                    <Input aria-label={t("copilot.grading.studentNName", { n: i + 1 })} placeholder={t("copilot.grading.studentNName", { n: i + 1 })} value={r.name} onChange={(e) => setRows((all) => all.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                    {rows.length > 1 && <button type="button" aria-label={t("copilot.grading.removeStudent", { n: i + 1 })} className="text-ink-3 hover:text-red-600" onClick={() => setRows((all) => all.filter((_, j) => j !== i))}><Trash2 size={15} /></button>}
                  </div>
                  <FilePicker files={r.files} onChange={(files) => setRows((all) => all.map((x, j) => (j === i ? { ...x, files } : x)))} label={t("copilot.grading.choosePages")} />
                </div>
              ))}
              <Button className="w-full" onClick={() => startBatch.mutate()} disabled={!classReady || startBatch.isPending || (!!job && !job.finished)}>
                {startBatch.isPending ? t("copilot.grading.uploading") : t(rows.length === 1 ? "copilot.grading.gradeOne" : "copilot.grading.gradeMany", { n: rows.length })}
              </Button>
              {startBatch.isError && <ErrorText>{err(startBatch.error)}</ErrorText>}
              {job && (
                <div className="space-y-1" data-testid="batch-progress">
                  {job.students.map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="min-w-0 truncate text-ink">{s.student_name}</span>
                      <span className="shrink-0 text-xs text-ink-3">
                        {s.status === "grading" && s.current_question ? t("copilot.grading.questionOf", { n: s.current_question, total: s.total_questions ?? "" }) : s.status === "failed" ? <span className="text-red-600">{s.error}</span> 
                          : tr(`copilot.grading.status.${s.status}`, s.status)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          )}

          <Section title={t("copilot.grading.gradedSheets")} right={<span className="text-xs text-ink-3">{results.data?.length ?? 0}</span>}>
            {results.data?.length === 0 && <p className="text-[13px] text-ink-3">{t("copilot.grading.nothingGraded")}</p>}
            {results.data?.map((s) => (
              <SheetRow key={s.id} sheet={s} open={open === s.id} onToggle={() => setOpen(open === s.id ? null : s.id)} onChanged={refresh} />
            ))}
            {!!results.data?.length && (
              <ExportPanel fields={[]} run={async (format) => (await api.post<{ file: CopilotFileInfo }>(`${GR}/report`, { paper_id: paperId, format })).data} />
            )}
          </Section>
        </>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------------------------------- one graded sheet

function SheetRow({ sheet, open, onToggle, onChanged }: { sheet: Sheet; open: boolean; onToggle: () => void; onChanged: () => void }) {
  const { t, tr, err } = useCopilotText();
  const detail = useQuery({ queryKey: ["grading", "sheet", sheet.id], queryFn: async () => (await api.get<Sheet>(`${GR}/results/${sheet.id}`)).data, enabled: open });
  const [edits, setEdits] = useState<Record<number, { marks?: string; feedback?: string }>>({});
  useEffect(() => setEdits({}), [detail.data?.total_marks_awarded]);
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async () => {
      const changes = Object.entries(edits).map(([n, e]) => {
        const q = detail.data!.questions!.find((x) => x.question_number === Number(n))!;
        return { question_number: Number(n), marks_awarded: e.marks !== undefined ? Number(e.marks) : q.marks_awarded, feedback: e.feedback ?? q.feedback };
      });
      return (await api.patch<Sheet>(`${GR}/results/${sheet.id}`, { changes })).data;
    },
    onSuccess: (s) => { qc.setQueryData(["grading", "sheet", sheet.id], s); onChanged(); },
  });
  const del = useMutation({ mutationFn: async () => { await api.delete(`${GR}/results/${sheet.id}`); }, onSuccess: onChanged });
  const total = detail.data?.total_marks_awarded ?? sheet.total_marks_awarded;

  return (
    <div className="rounded-xl bg-surface p-2">
      <button type="button" className="flex w-full items-center justify-between gap-2 text-start" onClick={onToggle} aria-expanded={open}>
        <span className="min-w-0 truncate text-sm font-medium text-ink">{sheet.student_name}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {sheet.needs_review > 0 && <Badge tone="amber">{t("copilot.grading.toCheck", { n: sheet.needs_review })}</Badge>}
          <span className="text-sm font-semibold tabular text-accent-fg">{total} / {sheet.total_marks_possible}</span>
        </span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {detail.isLoading && <Busy label={t("copilot.loading")} />}
          {detail.data?.questions?.map((q) => {
            const e = edits[q.question_number] ?? {};
            return (
              <div key={q.question_number} className="space-y-1 border-t border-line pt-2 text-[13px]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-ink">{t("copilot.grading.qShort", { n: q.question_number })} <span className="text-xs font-normal text-ink-3">{tr(`copilot.qtypes.${q.question_type}`, q.question_type.replace(/_/g, " "))}</span></span>
                  <span className="flex items-center gap-1.5">
                    {q.needs_review && !q.adjusted && <Badge tone="amber">{t("copilot.grading.check")}</Badge>}
                    {q.adjusted && <Badge tone="blue">{t("copilot.grading.edited")}</Badge>}
                    <input type="number" step={0.5} min={0} max={q.marks_possible} aria-label={t("copilot.grading.marksFor", { n: q.question_number })} className="lg-field !min-h-8 !w-16 !px-2 !py-0 text-center"
                      value={e.marks ?? String(q.marks_awarded)} onChange={(ev) => setEdits((all) => ({ ...all, [q.question_number]: { ...all[q.question_number], marks: ev.target.value } }))} />
                    <span className="text-xs text-ink-3">/ {q.marks_possible}</span>
                  </span>
                </div>
                <p className="text-ink-2"><span className="font-semibold">{t("copilot.grading.studentWrote")}:</span> {q.student_answer || <em>{t("copilot.grading.nothing")}</em>}</p>
                <p className="text-ink-3">{q.feedback}</p>
              </div>
            );
          })}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || Object.keys(edits).length === 0}>{save.isPending ? t("copilot.results.saving") : t("copilot.grading.saveChanges")}</Button>
            <Button size="sm" variant="danger" onClick={() => del.mutate()} disabled={del.isPending}>{t("common.delete")}</Button>
          </div>
          {save.isError && <ErrorText>{err(save.error)}</ErrorText>}
        </div>
      )}
    </div>
  );
}
