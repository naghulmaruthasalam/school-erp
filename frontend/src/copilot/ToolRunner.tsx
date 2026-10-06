import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, ErrorText, Input, Label, Select } from "../components/ui";
import { errorMessage, runTool, type CopilotContextOptions, type StudyContextSel, type ToolField, type ToolSpec } from "./api";
import ContextPicker from "./ContextPicker";
import type { CopilotFileInfo } from "./download";
import GradingTool from "./GradingTool";
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
  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-fg">
        <ArrowLeft size={14} className="rtl:rotate-180" /> All tools
      </button>
      <div>
        <h3 className="text-[15px] font-semibold text-ink">{tool.title}</h3>
        <p className="text-[13px] text-ink-3">{tool.description}</p>
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

function FieldInput({ field, value, onChange, options }: { field: ToolField; value: unknown; onChange: (v: unknown) => void; options: CopilotContextOptions }) {
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
              {o}
            </option>
          ))}
        </Select>
      );
    case "date":
      return <Input {...common} type="date" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
    case "child":
      return options.children.length > 1 ? (
        <Select {...common} value={String(value ?? "")} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">Choose a child…</option>
          {options.children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      ) : (
        <p className="text-[13px] text-ink-2">{options.children[0]?.name ?? "No child linked"}</p>
      );
    default:
      return <Input {...common} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
  }
}

/** Renders any tool's output: quiz questions, a document (worksheet, note, plan...), with optional fact tiles. */
function GenericResult({ data }: { data: Record<string, unknown> }) {
  const title = String(data.title ?? "Result");
  if (Array.isArray(data.questions)) return <QuizResult title={title} questions={data.questions as never} />;
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
                <p className="text-[11px] capitalize text-ink-3">{k.replace(/_/g, " ")}</p>
              </div>
            ))}
        </div>
      )}
      <DocumentResult id="copilot-result" title={title} content={String(data.content ?? "")} />
    </div>
  );
}

function GenericTool({ tool, options, language, initialContext, onBack }: ToolProps) {
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
          <Label htmlFor={`tf-${f.name}`}>{f.label}</Label>
          <FieldInput field={f} value={values[f.name]} options={options} onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))} />
        </div>
      ))}
      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || missing} className="w-full">
        {mutation.isPending ? "Working…" : "Generate"}
      </Button>
      {mutation.isPending && <Busy label="The AI is writing this, it can take a few seconds…" />}
      {mutation.isError && <ErrorText>{errorMessage(mutation.error)}</ErrorText>}
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
        {find.isPending ? "Reading the chapter…" : topics ? "Find topics again" : "Find topics in this chapter"}
      </Button>
      {find.isError && <ErrorText>{errorMessage(find.error)}</ErrorText>}
      {topics && (
        <div className="space-y-2">
          <p className="text-[13px] text-ink-3">Pick up to 3 topics and the activity types you want.</p>
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
            {make.isPending ? "Writing the worksheet…" : `Generate worksheet (${chosen} topic${chosen === 1 ? "" : "s"})`}
          </Button>
        </div>
      )}
      {make.isError && <ErrorText>{errorMessage(make.error)}</ErrorText>}
      {make.data && (
        <>
          <GenericResult data={make.data as Record<string, unknown>} />
          <ExportPanel
            fields={[
              { key: "school_name", label: "School name" },
              { key: "worksheet_title", label: "Title", default: "HOMEWORK WORKSHEET" },
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
        {find.isPending ? "Reading the chapter…" : topics ? "Re-read topics" : "Break the chapter into topics"}
      </Button>
      {find.isError && <ErrorText>{errorMessage(find.error)}</ErrorText>}
      {topics && (
        <div className="space-y-3">
          <div>
            <Label htmlFor="lp-topics">Topics, in teaching order (one per line, edit freely)</Label>
            <textarea id="lp-topics" className="lg-field min-h-[110px]" value={topics.join("\n")} onChange={(e) => setTopics(e.target.value.split("\n").filter((l) => l.trim()))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label htmlFor="lp-start">Start date</Label><Input id="lp-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div><Label htmlFor="lp-target">Finish by</Label><Input id="lp-target" type="date" value={target} onChange={(e) => setTarget(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Teaching days (up to 30 days apart)</Label>
            {days.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input type="date" value={d.date} min={start} max={target} onChange={(e) => setDays((s) => s.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} aria-label={`Day ${i + 1} date`} />
                <Input type="number" className="!w-24" value={d.minutes} min={10} max={480} onChange={(e) => setDays((s) => s.map((x, j) => (j === i ? { ...x, minutes: Number(e.target.value) } : x)))} aria-label={`Day ${i + 1} minutes`} />
                <span className="text-xs text-ink-3">min</span>
                <button type="button" aria-label="Remove day" className="text-ink-3 hover:text-red-500" onClick={() => setDays((s) => s.filter((_, j) => j !== i))}><Trash2 size={15} /></button>
              </div>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setDays((s) => [...s, { date: start, minutes: 40 }])}><Plus size={14} /> Add a day</Button>
          </div>
          <Button onClick={() => plan.mutate()} disabled={plan.isPending || !ready} className="w-full">
            {plan.isPending ? "Planning…" : "Generate lesson plan"}
          </Button>
          {!ready && days.length > 0 && <p className="text-xs text-ink-3">Every teaching day must fall between the start and finish dates.</p>}
        </div>
      )}
      {plan.isError && <ErrorText>{errorMessage(plan.error)}</ErrorText>}
      {plan.data && (
        <>
          <PlanView plan={plan.data} title={`Lesson plan: ${ctx.chapter ?? ""}`} />
          {plan.data.slots.length > 0 && (
            <ExportPanel
              fields={[
                { key: "school_name", label: "School name" },
                { key: "plan_title", label: "Title", default: "LESSON PLAN" },
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

function planToMarkdown(plan: PlanResult): string {
  return plan.slots
    .map(
      (s) =>
        `## ${s.date}: ${s.topic} (${s.minutes_allocated} min, ${s.session_type})\n` +
        s.sequence.map((st) => `- **${st.label}** (${st.minutes} min): ${st.description}`).join("\n") +
        `\n\n*Teacher note:* ${s.teacher_note}` +
        (s.pacing_flag ? `\n\n*Pacing:* ${s.pacing_flag}` : ""),
    )
    .join("\n\n---\n\n");
}

function PlanView({ plan, title }: { plan: PlanResult; title: string }) {
  const markdown = planToMarkdown(plan);
  return (
    <div className="space-y-2">
      {plan.buffer_notice && <p className="rounded-2xl bg-amber-500/15 px-3 py-2 text-[13px] text-ink">{plan.buffer_notice}</p>}
      {plan.surplus_notice && <p className="rounded-2xl bg-accent-soft px-3 py-2 text-[13px] text-accent-fg">{plan.surplus_notice}</p>}
      <DocumentResult id="copilot-plan" title={title} content={markdown} />
      {plan.slots.length === 0 && <p className="text-[13px] text-ink-3">No sessions came back. Try again or adjust the dates.</p>}
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

