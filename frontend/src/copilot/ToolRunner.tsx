import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button, ErrorText, Input, Label, Select } from "../components/ui";
import { runTool, type CopilotContextOptions, type StudyContextSel, type ToolField, type ToolSpec } from "./api";
import ContextPicker from "./ContextPicker";
import type { CopilotFileInfo } from "./download";
import GradingTool from "./GradingTool";
import { useCopilotText } from "./i18n";
import Markdown from "./Markdown";
import QuestionPaperTool from "./QuestionPaperTool";
import { DocumentResult, ExportPanel, QuizResult } from "./results";

export interface ToolProps {
  tool: ToolSpec;
  options: CopilotContextOptions;
  language: string;
  initialContext: StudyContextSel;
  onBack: () => void;
}

function Shell({ tool, onBack, children }: { tool: ToolSpec; onBack: () => void; children: ReactNode }) {
  const { t, toolTitle, toolDescription } = useCopilotText();
  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-fg">
        <ArrowLeft size={14} className="rtl:rotate-180" /> {t("copilot.allTools")}
      </button>
      <div>
        <h3 className="text-[15px] font-semibold text-ink">{toolTitle(tool)}</h3>
        <p className="text-[13px] text-ink-3">{toolDescription(tool)}</p>
      </div>
      {children}
    </div>
  );
}

function Busy({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-[13px] text-ink-3">
      <Loader2 size={14} className="animate-spin" /> {label}
    </p>
  );
}

function FieldInput({ tool, field, value, onChange, options }: { tool: ToolSpec; field: ToolField; value: unknown; onChange: (v: unknown) => void; options: CopilotContextOptions }) {
  const { t, optionLabel } = useCopilotText();
  const common = { id: `tf-${field.name}`, required: field.required };
  switch (field.type) {
    case "textarea":
      return <textarea {...common} className="lg-field min-h-[84px]" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return <Input {...common} type="number" min={field.min} max={field.max} value={String(value ?? "")} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />;
    case "select":
      return (
        <Select {...common} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {optionLabel(tool, field, o)}
            </option>
          ))}
        </Select>
      );
    case "date":
      return <Input {...common} type="date" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "child":
      return options.children.length > 1 ? (
        <Select {...common} value={String(value ?? "")} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">{t("copilot.picker.chooseChild")}</option>
          {options.children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      ) : (
        <p className="text-[13px] text-ink-2">{options.children[0]?.name ?? t("copilot.tool.noChild")}</p>
      );
    default:
      return <Input {...common} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
  }
}

interface HomeworkIdea { title: string; kind: string; minutes: number; instructions: string; what_to_check?: string }

/** Homework ideas: each can be turned into real homework (opens the teacher's Homework form, prefilled). */
function HomeworkIdeasResult({ data }: { data: Record<string, unknown> }) {
  const { t, fmtNumber } = useCopilotText();
  const navigate = useNavigate();
  const ideas = data.ideas as HomeworkIdea[];
  const context = (data.context ?? {}) as { class_id?: string; subject_id?: string; chapter?: string };
  return (
    <div className="space-y-3">
      {ideas.map((idea, i) => (
        <div key={i} className="space-y-2 rounded-2xl bg-surface-3 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{idea.title}</p>
            <span className="shrink-0 text-[11px] text-ink-3">{idea.kind} · {t("copilot.tool.approxMinutes", { n: fmtNumber(idea.minutes) })}</span>
          </div>
          <Markdown>{idea.instructions}</Markdown>
          {idea.what_to_check && <p className="text-xs text-ink-3"><span className="font-semibold">{t("copilot.tool.check")}:</span> {idea.what_to_check}</p>}
          <Button size="sm" variant="secondary" className="w-full"
            onClick={() => navigate("/teacher/homework", { state: { prefill: { ...context, title: idea.title, description: idea.instructions } } })}>
            {t("copilot.tool.createHomework")}
          </Button>
        </div>
      ))}
    </div>
  );
}

/** Renders any tool's output: quiz questions, a document (worksheet, note, plan...), with optional fact tiles. */
function GenericResult({ data }: { data: Record<string, unknown> }) {
  const { t, tr } = useCopilotText();
  const title = String(data.title ?? t("copilot.tool.result"));
  if (Array.isArray(data.questions)) return <QuizResult title={title} questions={data.questions as never} />;
  if (Array.isArray(data.ideas)) return <HomeworkIdeasResult data={data} />;
  const facts = data.facts as Record<string, unknown> | undefined;
  return (
    <div className="space-y-3">
      {facts && (
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(facts)
            .filter(([k]) => k !== "child")
            .map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-accent-soft px-2 py-2 text-center">
                <p className="text-lg font-semibold text-accent-fg tabular">{String(v)}</p>
                <p className="text-[11px] capitalize text-ink-3">{tr(`copilot.facts.${k}`, k.replace(/_/g, " "))}</p>
              </div>
            ))}
        </div>
      )}
      <DocumentResult id="copilot-result" title={title} content={String(data.content ?? "")} />
    </div>
  );
}

function GenericTool({ tool, options, language, initialContext, onBack }: ToolProps) {
  const { t, fieldLabel, err } = useCopilotText();
  const [ctx, setCtx] = useState<StudyContextSel>(initialContext);
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(tool.fields.filter((f) => f.default !== undefined).map((f) => [f.name, f.default])),
  );
  const mutation = useMutation({ mutationFn: () => runTool(tool.key, ctx, values, language) });
  const missing = tool.fields.some((f) => f.required && !values[f.name]) || (tool.needs_context && (!ctx.classId || (tool.require_subject && !ctx.subjectId)));

  return (
    <Shell tool={tool} onBack={onBack}>
      {tool.needs_context && <ContextPicker options={options} value={ctx} onChange={setCtx} requireSubject={tool.require_subject} />}
      {tool.fields.map((f) => (
        <div key={f.name}>
          <Label htmlFor={`tf-${f.name}`}>{fieldLabel(tool, f)}</Label>
          <FieldInput tool={tool} field={f} value={values[f.name]} options={options} onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} />
        </div>
      ))}
      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || missing} className="w-full">
        {mutation.isPending ? t("copilot.tool.working") : t("copilot.tool.generate")}
      </Button>
      {mutation.isPending && <Busy label={t("copilot.tool.aiWriting")} />}
      {mutation.isError && <ErrorText>{err(mutation.error)}</ErrorText>}
      {mutation.data && <GenericResult data={mutation.data as Record<string, unknown>} />}
    </Shell>
  );
}

// ---------------------------------------------------------------------------------------- worksheet

interface Topic {
  topic: string;
  description?: string;
  suggested_activities: string[];
}

function WorksheetTool({ tool, options, language, initialContext, onBack }: ToolProps) {
  const { t, err } = useCopilotText();
  const [ctx, setCtx] = useState<StudyContextSel>(initialContext);
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const find = useMutation({
    mutationFn: async () => (await runTool<{ topics: Topic[] }>(tool.key, ctx, { step: "topics" }, language)).topics,
    onSuccess: (t) => {
      setTopics(t);
      setPicked({});
    },
  });
  const make = useMutation({
    mutationFn: () =>
      runTool(
        tool.key,
        ctx,
        { step: "generate", selected_topics: Object.entries(picked).filter(([, a]) => a.length).map(([topic, activities]) => ({ topic, activities })) },
        language,
      ),
  });
  const chosen = Object.values(picked).filter((a) => a.length).length;

  function toggle(topic: string, activity: string) {
    setPicked((p) => {
      const current = p[topic] ?? [];
      const next = current.includes(activity) ? current.filter((a) => a !== activity) : [...current, activity];
      const copy = { ...p, [topic]: next };
      return Object.values(copy).filter((a) => a.length).length > 3 ? p : copy; // at most 3 topics per worksheet
    });
  }

  return (
    <Shell tool={tool} onBack={onBack}>
      <ContextPicker options={options} value={ctx} onChange={(c) => { setCtx(c); setTopics(null); }} requireSubject requireChapter />
      <Button onClick={() => find.mutate()} disabled={find.isPending || !ctx.chapter} className="w-full" variant={topics ? "secondary" : "primary"}>
        {find.isPending ? t("copilot.worksheet.reading") : topics ? t("copilot.worksheet.findAgain") : t("copilot.worksheet.find")}
      </Button>
      {find.isError && <ErrorText>{err(find.error)}</ErrorText>}
      {topics && (
        <div className="space-y-2">
          <p className="text-[13px] text-ink-3">{t("copilot.worksheet.pick")}</p>
          {topics.map((t) => (
            <div key={t.topic} className="rounded-2xl bg-surface-3 p-3">
              <p className="text-[13px] font-semibold text-ink">{t.topic}</p>
              {t.description && <p className="text-xs text-ink-3">{t.description}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {t.suggested_activities.map((a) => {
                  const on = picked[t.topic]?.includes(a);
                  return (
                    <button key={a} type="button" aria-pressed={!!on} onClick={() => toggle(t.topic, a)}
                      className={`rounded-full px-2.5 py-1 text-xs ring-1 transition-colors ${on ? "bg-accent text-white ring-accent" : "bg-surface text-ink-2 ring-line hover:ring-accent/50"}`}>
                      {a}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <Button onClick={() => make.mutate()} disabled={make.isPending || chosen === 0} className="w-full">
            {make.isPending ? t("copilot.worksheet.writing") : t(chosen === 1 ? "copilot.worksheet.generateOne" : "copilot.worksheet.generateMany", { n: chosen })}
          </Button>
        </div>
      )}
      {make.isError && <ErrorText>{err(make.error)}</ErrorText>}
      {make.data && (
        <>
          <GenericResult data={make.data as Record<string, unknown>} />
          <ExportPanel
            fields={[
              { key: "school_name", label: t("copilot.export.schoolName") },
              { key: "worksheet_title", label: t("copilot.export.title"), default: "HOMEWORK WORKSHEET" },
            ]}
            run={(format, header) =>
              runTool(tool.key, ctx, { step: "finalize", content: String((make.data as Record<string, unknown>).content ?? ""), header, export_format: format }, language) as Promise<{ file: CopilotFileInfo }>
            }
          />
        </>
      )}
    </Shell>
  );
}

// ---------------------------------------------------------------------------------------- lesson plan

interface Slot {
  date: string;
  topic: string;
  minutes_allocated: number;
  session_type: string;
  sequence: { label: string; minutes: number; description: string }[];
  teacher_note: string;
  pacing_flag: string | null;
}

interface PlanResult {
  slots: Slot[];
  all_topics_covered: boolean;
  uncovered_topics: string[];
  buffer_notice: string | null;
  surplus_notice: string | null;
}

const today = () => new Date().toISOString().slice(0, 10);

function LessonPlanTool({ tool, options, language, initialContext, onBack }: ToolProps) {
  const { t, err } = useCopilotText();
  const [ctx, setCtx] = useState<StudyContextSel>(initialContext);
  const [topics, setTopics] = useState<string[] | null>(null);
  const [start, setStart] = useState(today());
  const [target, setTarget] = useState(today());
  const [days, setDays] = useState<{ date: string; minutes: number }[]>([{ date: today(), minutes: 40 }]);
  const find = useMutation({
    mutationFn: async () => (await runTool<{ topics: string[] }>(tool.key, ctx, { step: "topics" }, language)).topics,
    onSuccess: setTopics,
  });
  const plan = useMutation({
    mutationFn: () =>
      runTool<PlanResult>(tool.key, ctx, { step: "schedule", topics, start_date: start, target_completion: target, teaching_dates: days }, language),
  });
  const ready = topics && topics.length > 0 && days.length > 0 && days.every((d) => d.date >= start && d.date <= target && d.minutes > 0);

  return (
    <Shell tool={tool} onBack={onBack}>
      <ContextPicker options={options} value={ctx} onChange={(c) => { setCtx(c); setTopics(null); }} requireSubject requireChapter />
      <Button onClick={() => find.mutate()} disabled={find.isPending || !ctx.chapter} className="w-full" variant={topics ? "secondary" : "primary"}>
        {find.isPending ? t("copilot.worksheet.reading") : topics ? t("copilot.lessonPlan.reread") : t("copilot.lessonPlan.breakDown")}
      </Button>
      {find.isError && <ErrorText>{err(find.error)}</ErrorText>}
      {topics && (
        <div className="space-y-3">
          <div>
            <Label htmlFor="lp-topics">{t("copilot.lessonPlan.topics")}</Label>
            <textarea id="lp-topics" className="lg-field min-h-[110px]" value={topics.join("\n")} onChange={(e) => setTopics(e.target.value.split("\n").filter((l) => l.trim()))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label htmlFor="lp-start">{t("copilot.lessonPlan.startDate")}</Label><Input id="lp-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><Label htmlFor="lp-target">{t("copilot.lessonPlan.finishBy")}</Label><Input id="lp-target" type="date" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("copilot.lessonPlan.teachingDays")}</Label>
            {days.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input type="date" value={d.date} min={start} max={target} onChange={(e) => setDays((s) => s.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} aria-label={t("copilot.lessonPlan.dayDate", { n: i + 1 })} />
                <Input type="number" className="!w-24" value={d.minutes} min={10} max={480} onChange={(e) => setDays((s) => s.map((x, j) => (j === i ? { ...x, minutes: Number(e.target.value) } : x)))} aria-label={t("copilot.lessonPlan.dayMinutes", { n: i + 1 })} />
                <span className="text-xs text-ink-3">{t("copilot.lessonPlan.min")}</span>
                <button type="button" aria-label={t("copilot.lessonPlan.removeDay")} className="text-ink-3 hover:text-red-500" onClick={() => setDays((s) => s.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setDays((s) => [...s, { date: start, minutes: 40 }])}><Plus size={14} /> {t("copilot.lessonPlan.addDay")}</Button>
          </div>
          <Button onClick={() => plan.mutate()} disabled={plan.isPending || !ready} className="w-full">
            {plan.isPending ? t("copilot.lessonPlan.planning") : t("copilot.lessonPlan.generate")}
          </Button>
          {!ready && days.length > 0 && <p className="text-xs text-ink-3">{t("copilot.lessonPlan.datesHint")}</p>}
        </div>
      )}
      {plan.isError && <ErrorText>{err(plan.error)}</ErrorText>}
      {plan.data && (
        <>
          <PlanView plan={plan.data} title={t("copilot.lessonPlan.title", { chapter: ctx.chapter ?? "" })} />
          {plan.data.slots.length > 0 && (
            <ExportPanel
              fields={[
                { key: "school_name", label: t("copilot.export.schoolName") },
                { key: "plan_title", label: t("copilot.export.title"), default: "LESSON PLAN" },
              ]}
              run={(format, header) =>
                runTool(tool.key, ctx, { step: "finalize", slots: plan.data!.slots, buffer_notice: plan.data!.buffer_notice, header, export_format: format }, language) as Promise<{ file: CopilotFileInfo }>
              }
            />
          )}
        </>
      )}
    </Shell>
  );
}

function planToMarkdown(plan: PlanResult, t: (key: string, vars?: Record<string, string | number>) => string): string {
  return plan.slots
    .map(
      (s) =>
        `## ${s.date}: ${s.topic} (${t("copilot.lessonPlan.minutesShort", { n: s.minutes_allocated })}, ${s.session_type})\n` +
        s.sequence.map((st) => `- **${st.label}** (${t("copilot.lessonPlan.minutesShort", { n: st.minutes })}): ${st.description}`).join("\n") +
        `\n\n*${t("copilot.lessonPlan.teacherNote")}:* ${s.teacher_note}` +
        (s.pacing_flag ? `\n\n*${t("copilot.lessonPlan.pacing")}:* ${s.pacing_flag}` : ""),
    )
    .join("\n\n---\n\n");
}

function PlanView({ plan, title }: { plan: PlanResult; title: string }) {
  const { t } = useCopilotText();
  const markdown = planToMarkdown(plan, t);
  return (
    <div className="space-y-2">
      {plan.buffer_notice && <p className="rounded-2xl bg-amber-500/15 px-3 py-2 text-[13px] text-ink">{plan.buffer_notice}</p>}
      {plan.surplus_notice && <p className="rounded-2xl bg-accent-soft px-3 py-2 text-[13px] text-accent-fg">{plan.surplus_notice}</p>}
      <DocumentResult id="copilot-plan" title={title} content={markdown} />
      {plan.slots.length === 0 && <p className="text-[13px] text-ink-3">{t("copilot.lessonPlan.noSessions")}</p>}
    </div>
  );
}

export default function ToolRunner(props: ToolProps) {
  if (props.tool.key === "question_paper") return <QuestionPaperTool {...props} />;
  if (props.tool.key === "grading") return <GradingTool {...props} />;
  if (props.tool.key === "worksheet") return <WorksheetTool {...props} />;
  if (props.tool.key === "lesson_plan") return <LessonPlanTool {...props} />;
  return <GenericTool {...props} />;
}

