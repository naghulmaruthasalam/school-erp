import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Minus, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { Badge, Button, ErrorText, Input, Label, Select } from "../components/ui";
import type { CopilotFileInfo } from "./download";
import { useCopilotText } from "./i18n";
import Markdown from "./Markdown";
import { ExportPanel } from "./results";
import { Busy, Section, Shell } from "./toolkit";
import type { ToolProps } from "./ToolRunner";

interface QType { key: string; label: string; marks: number; max: number }
interface QClass { id: string; name: string; subjects: { id: string; name: string; chapters: string[] }[]; types: QType[] }
interface Options { classes: QClass[]; limits: { paper_marks: number; chapter_marks: number } }
interface Question { id: string; chapter: string; question_type: string; marks: number; text: string; options: string[] | null; answer: string | null; keywords: string | null }
interface Paper { id: string; class_name: string; subject_name: string; chapters: string[]; total_marks: number; suggested_duration: string; question_count: number; created_at: string; questions?: Question[]; new_questions_written?: number }
interface BankItem { id: string; chapter: string; question_type: string; marks: number; text: string; options: string[] | null; answer: string | null; source: string }

const QP = "/copilot/qpg";

function chapterCaps(n: number, limits: Options["limits"]): number[] {
  if (n <= 4) return Array(n).fill(limits.chapter_marks);
  const base = Math.floor(limits.paper_marks / n), extra = limits.paper_marks % n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

export default function QuestionPaperTool(props: ToolProps) {
  const { tool, onBack, initialContext, language } = props;
  const { t, te, fmtDate, err, tr } = useCopilotText();
  const qc = useQueryClient();
  const options = useQuery({ queryKey: ["qpg", "options"], queryFn: async () => (await api.get<Options>(`${QP}/options`)).data });
  const papers = useQuery({ queryKey: ["qpg", "papers"], queryFn: async () => (await api.get<Paper[]>(`${QP}/papers`)).data });
  const [classId, setClassId] = useState(initialContext.classId ?? "");
  const [subjectId, setSubjectId] = useState(initialContext.subjectId ?? "");
  const [picked, setPicked] = useState<Record<string, Record<string, number>>>(() => (initialContext.chapter ? { [initialContext.chapter]: {} } : {}));
  const [paper, setPaper] = useState<Paper | null>(null);
  const [showBank, setShowBank] = useState(false);

  const cls = options.data?.classes.find((c) => c.id === classId) ?? options.data?.classes[0];
  const subject = cls?.subjects.find((s) => s.id === subjectId) ?? cls?.subjects[0];
  useEffect(() => {
    if (cls && cls.id !== classId) setClassId(cls.id);
    if (subject && subject.id !== subjectId) setSubjectId(subject.id);
  }, [cls, subject, classId, subjectId]);

  const chapters = Object.keys(picked).filter((c) => subject?.chapters.includes(c));
  const caps = chapterCaps(chapters.length, options.data?.limits ?? { paper_marks: 100, chapter_marks: 25 });
  const marksOf = (c: string) => Object.entries(picked[c] ?? {}).reduce((sum, [t, n]) => sum + n * (cls?.types.find((x) => x.key === t)?.marks ?? 0), 0);
  const totalMarks = chapters.reduce((s, c) => s + marksOf(c), 0);
  const over = chapters.some((c, i) => marksOf(c) > caps[i]);

  function setCount(chapter: string, type: QType, delta: number) {
    setPicked((p) => {
      const n = Math.max(0, Math.min(type.max, (p[chapter]?.[type.key] ?? 0) + delta));
      return { ...p, [chapter]: { ...p[chapter], [type.key]: n } };
    });
  }

  const generate = useMutation({
    mutationFn: async () =>
      (await api.post<Paper>(`${QP}/generate`, { class_id: cls!.id, subject_id: subject!.id, language,
        chapters: chapters.map((c) => ({ chapter: c, counts: picked[c] })) })).data,
    onSuccess: (p) => { setPaper(p); void qc.invalidateQueries({ queryKey: ["qpg", "papers"] }); },
  });
  const open = useMutation({ mutationFn: async (id: string) => (await api.get<Paper>(`${QP}/papers/${id}`)).data, onSuccess: setPaper });
  const remove = useMutation({
    mutationFn: async (id: string) => { await api.delete(`${QP}/papers/${id}`); },
    onSuccess: (_d, id) => { if (paper?.id === id) setPaper(null); void qc.invalidateQueries({ queryKey: ["qpg", "papers"] }); },
  });

  if (paper) return <PaperView {...props} paper={paper} onClose={() => setPaper(null)} />;

  return (
    <Shell tool={tool} onBack={onBack}>
      {options.isLoading && <Busy label={t("copilot.qp.loadingClasses")} />}
      {options.isError && <ErrorText>{err(options.error)}</ErrorText>}
      {options.data && options.data.classes.length === 0 && <p className="text-[13px] text-ink-3">{t("copilot.qp.noClasses")}</p>}
      {cls && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="qp-class">{t("copilot.picker.class")}</Label>
              <Select id="qp-class" value={cls.id} onChange={(e) => { setClassId(e.target.value); setSubjectId(""); setPicked({}); }}>
                {options.data!.classes.map((c) => <option key={c.id} value={c.id}>{te("class", c.name)}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="qp-subject">{t("copilot.picker.subject")}</Label>
              <Select id="qp-subject" value={subject?.id ?? ""} onChange={(e) => { setSubjectId(e.target.value); setPicked({}); }}>
                {cls.subjects.map((s) => <option key={s.id} value={s.id}>{te("subject", s.name)}</option>)}
              </Select>
            </div>
          </div>

          <Section title={t("copilot.qp.chaptersAndQuestions")} right={<span className="text-xs tabular text-ink-3">{t("copilot.qp.marksOfTotal", { n: totalMarks, total: options.data!.limits.paper_marks })}</span>}>
            {subject?.chapters.length === 0 && <p className="text-[13px] text-ink-3">{t("copilot.qp.noChapters")}</p>}
            {subject?.chapters.map((ch) => {
              const on = ch in picked;
              const i = chapters.indexOf(ch);
              return (
                <div key={ch} className="rounded-xl bg-surface p-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-ink">
                    <input type="checkbox" checked={on} onChange={(e) => setPicked((p) => { const n = { ...p }; if (e.target.checked) n[ch] = {}; else delete n[ch]; return n; })} />
                    <span className="min-w-0 flex-1 truncate">{ch}</span>
                    {on && <span className={`text-xs tabular ${marksOf(ch) > (caps[i] ?? 25) ? "text-red-600" : "text-ink-3"}`}>{marksOf(ch)} / {caps[i] ?? 25}</span>}
                  </label>
                  {on && (
                    <div className="mt-2 grid gap-1.5">
                      {cls.types.map((qt) => (
                        <div key={qt.key} className="flex items-center justify-between gap-2 text-[13px]">
                          <span className="text-ink-2">{tr(`copilot.qtypes.${qt.key}`, qt.label)} <span className="text-ink-3">· {t(qt.marks === 1 ? "copilot.qp.markOne" : "copilot.qp.markMany", { n: qt.marks })}</span></span>
                          <span className="flex items-center gap-1">
                            <button type="button" aria-label={t("copilot.qp.fewer", { type: tr(`copilot.qtypes.${qt.key}`, qt.label) })} className="lg-icon !h-7 !w-7" onClick={() => setCount(ch, qt, -1)}><Minus size={13} /></button>
                            <span className="w-6 text-center tabular" data-testid={`count-${ch}-${qt.key}`}>{picked[ch]?.[qt.key] ?? 0}</span>
                            <button type="button" aria-label={t("copilot.qp.more", { type: tr(`copilot.qtypes.${qt.key}`, qt.label) })} className="lg-icon !h-7 !w-7" onClick={() => setCount(ch, qt, 1)}><Plus size={13} /></button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </Section>

          <Button className="w-full" onClick={() => generate.mutate()} disabled={generate.isPending || totalMarks === 0 || over}>
            {generate.isPending ? t("copilot.qp.building") : t("copilot.qp.generate")}
          </Button>
          {over && <ErrorText>{t("copilot.qp.overLimit")}</ErrorText>}
          {generate.isPending && <Busy label={t("copilot.qp.picking")} />}
          {generate.isError && <ErrorText>{err(generate.error)}</ErrorText>}

          <button type="button" className="text-[13px] font-medium text-accent-fg" onClick={() => setShowBank(!showBank)}>
            {showBank ? t("copilot.qp.hideBank") : t("copilot.qp.showBank")}
          </button>
          {showBank && subject && <BankPanel classId={cls.id} subjectId={subject.id} chapters={subject.chapters} types={cls.types} />}
        </>
      )}

      {(papers.data ?? []).length > 0 && (
        <Section title={t("copilot.qp.recentPapers")}>
          {papers.data!.slice(0, 8).map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-surface p-2 text-[13px]">
              <button type="button" className="min-w-0 flex-1 text-start" onClick={() => open.mutate(p.id)}>
                <span className="block truncate font-medium text-ink">{te("subject", p.subject_name)} · {te("class", p.class_name)}</span>
                <span className="block truncate text-xs text-ink-3">{p.chapters.join(t("copilot.listSeparator"))} · {t("copilot.qp.marksN", { n: p.total_marks })} · {fmtDate(p.created_at)}</span>
              </button>
              <button type="button" aria-label={t("copilot.qp.deletePaper")} className="text-ink-3 hover:text-red-600" onClick={() => remove.mutate(p.id)}><Trash2 size={15} /></button>
            </div>
          ))}
          {open.isPending && <Busy label={t("copilot.qp.opening")} />}
        </Section>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------------------------------- a generated paper

function PaperView({ tool, onBack, paper, onClose }: ToolProps & { paper: Paper; onClose: () => void }) {
  const { t, te, tr } = useCopilotText();
  const [showAnswers, setShowAnswers] = useState(false);
  const sections = useMemo(() => {
    const order = ["mcq", "short", "state_precisely", "answer_in_brief", "long"];
    let n = 0;
    return order.map((t) => ({ type: t, items: (paper.questions ?? []).filter((q) => q.question_type === t).map((q) => ({ ...q, n: ++n })) })).filter((s) => s.items.length);
  }, [paper]);
  const label = (type: string) => tr(`copilot.qtypes.${type}`, type.replace(/_/g, " "));

  return (
    <Shell tool={tool} onBack={onBack}>
      <button type="button" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-fg" onClick={onClose}><ArrowLeft size={13} className="rtl:rotate-180" /> {t("copilot.qp.newPaper")}</button>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="violet">{te("subject", paper.subject_name)} · {te("class", paper.class_name)}</Badge>
        <Badge tone="blue">{t("copilot.qp.marksN", { n: paper.total_marks })}</Badge>
        <Badge tone="gray">{paper.suggested_duration}</Badge>
        {!!paper.new_questions_written && <Badge tone="green">{t("copilot.qp.newSaved", { n: paper.new_questions_written })}</Badge>}
      </div>
      <label className="flex items-center gap-2 text-[13px] text-ink">
        <input type="checkbox" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} /> {t("copilot.qp.showAnswers")}
      </label>
      <div className="space-y-3" id="qp-paper">
        {sections.map((s, i) => (
          <div key={s.type} className="space-y-2 rounded-2xl bg-surface-3 p-3">
            <p className="text-[13px] font-semibold text-ink">{t("copilot.qp.section", { letter: String.fromCharCode(65 + i) })} · {label(s.type)} <span className="font-normal text-ink-3">({t(s.items[0].marks === 1 ? "copilot.qp.markEachOne" : "copilot.qp.markEachMany", { n: s.items[0].marks })})</span></p>
            {s.items.map((q) => (
              <div key={q.id} className="text-sm text-ink">
                <div className="flex gap-1.5"><span className="font-semibold tabular">{q.n}.</span><div className="min-w-0 flex-1"><Markdown>{q.text}</Markdown></div></div>
                {q.options && <ul className="ms-6 mt-0.5 space-y-0.5 text-[13px] text-ink-2">{q.options.map((o, j) => <li key={j}>({String.fromCharCode(97 + j)}) {o}</li>)}</ul>}
                {showAnswers && (
                  <p className="ms-6 mt-1 rounded-lg bg-accent-soft px-2 py-1 text-[13px] text-accent-fg">
                    <span className="font-semibold">{t("copilot.results.answer")}:</span> {q.answer}{q.keywords ? <span className="block text-xs text-ink-3">{t("copilot.qp.keyPoints")}: {q.keywords}</span> : null}
                  </p>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
      <PaperExport paperId={paper.id} />
    </Shell>
  );
}

function PaperExport({ paperId }: { paperId: string }) {
  const { t } = useCopilotText();
  const [answers, setAnswers] = useState(false);
  const fields = [
    { key: "school_name", label: t("copilot.export.schoolName") }, { key: "exam_title", label: t("copilot.export.examTitle") },
    { key: "date_label", label: t("copilot.export.date") }, { key: "time_label", label: t("copilot.export.timeAllowed") },
  ];
  return (
    <div className="space-y-2">
      <div className="lg-seg w-full [&>button]:flex-1">
        <button aria-pressed={!answers} onClick={() => setAnswers(false)}>{t("copilot.qp.questionPaper")}</button>
        <button aria-pressed={answers} onClick={() => setAnswers(true)}>{t("copilot.qp.answerKey")}</button>
      </div>
      <ExportPanel
        key={String(answers)}
        fields={fields}
        run={async (format, header) => (await api.post<{ file: CopilotFileInfo }>(`${QP}/papers/${paperId}/export`, { header, include_answers: answers, format })).data}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- question bank

function BankPanel({ classId, subjectId, chapters, types }: { classId: string; subjectId: string; chapters: string[]; types: QType[] }) {
  const { t, tr, err } = useCopilotText();
  const qc = useQueryClient();
  const [chapter, setChapter] = useState(chapters[0] ?? "");
  const bank = useQuery({
    queryKey: ["qpg", "bank", classId, subjectId, chapter],
    queryFn: async () => (await api.get<BankItem[]>(`${QP}/bank`, { params: { class_id: classId, subject_id: subjectId, chapter } })).data,
    enabled: !!chapter,
  });
  const [type, setType] = useState("mcq");
  const [text, setText] = useState("");
  const [opts, setOpts] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [answer, setAnswer] = useState("");
  const add = useMutation({
    mutationFn: async () => (await api.post(`${QP}/bank`, {
      class_id: classId, subject_id: subjectId, chapter, question_type: type, text,
      options: type === "mcq" ? opts : null, answer: type === "mcq" ? opts[correct] : answer,
    })).data,
    onSuccess: () => { setText(""); setAnswer(""); setOpts(["", "", "", ""]); void qc.invalidateQueries({ queryKey: ["qpg", "bank"] }); },
  });
  const del = useMutation({ mutationFn: async (id: string) => { await api.delete(`${QP}/bank/${id}`); }, onSuccess: () => qc.invalidateQueries({ queryKey: ["qpg", "bank"] }) });
  const ready = text.trim().length > 2 && (type === "mcq" ? opts.every((o) => o.trim()) : answer.trim());

  return (
    <Section title={t("copilot.qp.bank")}>
      <Select aria-label={t("copilot.qp.bankChapter")} value={chapter} onChange={(e) => setChapter(e.target.value)}>
        {chapters.map((c) => <option key={c} value={c}>{c}</option>)}
      </Select>
      <p className="text-xs text-ink-3">{t("copilot.qp.bankHint")}</p>
      <div className="max-h-40 space-y-1 overflow-y-auto">
        {(bank.data ?? []).map((q) => (
          <div key={q.id} className="flex items-start justify-between gap-2 rounded-lg bg-surface p-2 text-[13px]">
            <span className="min-w-0 flex-1"><span className="font-medium text-ink">{q.text}</span><span className="block text-xs text-ink-3">{tr(`copilot.qtypes.${q.question_type}`, q.question_type)} · {q.marks} · {q.source}</span></span>
            <button type="button" aria-label={t("copilot.qp.removeFromBank")} className="text-ink-3 hover:text-red-600" onClick={() => del.mutate(q.id)}><Trash2 size={14} /></button>
          </div>
        ))}
        {bank.data?.length === 0 && <p className="text-xs text-ink-3">{t("copilot.qp.bankEmpty")}</p>}
      </div>
      <div className="space-y-2 border-t border-line pt-2">
        <p className="text-xs font-semibold text-ink">{t("copilot.qp.addQuestion")}</p>
        <Select aria-label={t("copilot.qp.questionType")} value={type} onChange={(e) => setType(e.target.value)}>{types.map((qt) => <option key={qt.key} value={qt.key}>{tr(`copilot.qtypes.${qt.key}`, qt.label)} ({qt.marks})</option>)}</Select>
        <Input placeholder={t("copilot.qp.question")} value={text} onChange={(e) => setText(e.target.value)} />
        {type === "mcq" ? opts.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name="bank-correct" aria-label={t("copilot.qp.optionCorrect", { n: i + 1 })} checked={correct === i} onChange={() => setCorrect(i)} />
            <Input placeholder={t("copilot.qp.option", { n: i + 1 })} value={o} onChange={(e) => setOpts((v) => v.map((x, j) => (j === i ? e.target.value : x)))} />
          </div>
        )) : <Input placeholder={t("copilot.qp.modelAnswer")} value={answer} onChange={(e) => setAnswer(e.target.value)} />}
        <Button size="sm" variant="secondary" onClick={() => add.mutate()} disabled={!ready || add.isPending}>{t("copilot.qp.addToBank")}</Button>
        {add.isError && <ErrorText>{err(add.error)}</ErrorText>}
      </div>
    </Section>
  );
}
