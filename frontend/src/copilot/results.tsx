import { Check, Copy, Printer } from "lucide-react";
import { useState } from "react";
import { Button, ErrorText, Input, Label } from "../components/ui";
import { downloadCopilotFile, type CopilotFileInfo } from "./download";
import { useCopilotText } from "./i18n";
import Markdown from "./Markdown";

/** Copy / print actions for generated content. Printing opens a clean window with the page's own styles
 * (incl. KaTeX) so the result can be saved as PDF from the browser. */
export function ResultActions({ text, title, containerId }: { text: string; title: string; containerId: string }) {
  const { t, dir } = useCopilotText();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: the text is still selectable on screen */
    }
  }

  function print() {
    const el = document.getElementById(containerId);
    if (!el) return;
    const w = window.open("", "_blank");
    if (!w) return;
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map((n) => n.outerHTML).join("");
    w.document.write(
      `<!doctype html><html dir="${dir}"><head><meta charset="utf-8"><title>${title.replace(/</g, "&lt;")}</title>${styles}` +
        `<style>body{background:#fff;color:#000;padding:24px;font-family:system-ui,sans-serif}</style></head>` +
        `<body><h2 style="margin-top:0">${title.replace(/</g, "&lt;")}</h2>${el.innerHTML}</body></html>`,
    );
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  return (
    <div className="flex gap-2">
      <Button variant="secondary" size="sm" onClick={copy}>
        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? t("copilot.results.copied") : t("copilot.results.copy")}
      </Button>
      <Button variant="secondary" size="sm" onClick={print}>
        <Printer size={14} /> {t("copilot.results.print")}
      </Button>
    </div>
  );
}

export function DocumentResult({ title, content, id }: { title: string; content: string; id: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
        <ResultActions text={content} title={title} containerId={id} />
      </div>
      <div id={id} className="rounded-2xl bg-surface-3 p-3">
        <Markdown>{content}</Markdown>
      </div>
    </div>
  );
}

interface QuizQuestion {
  type: "mcq" | "short";
  question: string;
  options: string[] | null;
  answer: string;
  explanation: string;
}

/** Interactive quiz: pick an option (or think of an answer), then reveal the answer and explanation. */
export function QuizResult({ title, questions }: { title: string; questions: QuizQuestion[] }) {
  const { t } = useCopilotText();
  const [picked, setPicked] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const score = questions.filter((q, i) => q.type === "mcq" && picked[i] === q.answer).length;
  const mcqs = questions.filter((q) => q.type === "mcq").length;
  const answered = questions.filter((q, i) => q.type === "mcq" && picked[i] !== undefined).length;
  const markdown = questions
    .map((q, i) => `${i + 1}. ${q.question}${q.options ? "\n" + q.options.map((o, j) => `   ${"ABCD"[j]}. ${o}`).join("\n") : ""}\n   **${t("copilot.results.answer")}:** ${q.answer}${q.explanation ? ` - ${q.explanation}` : ""}`)
    .join("\n\n");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-ink">{title}</h4>
        <ResultActions text={markdown} title={title} containerId="copilot-quiz-print" />
      </div>
      {mcqs > 0 && answered === mcqs && (
        <p className="rounded-2xl bg-accent-soft px-3 py-2 text-[13px] font-medium text-accent-fg">
          {t("copilot.results.score", { score, total: mcqs })}
        </p>
      )}
      <ol id="copilot-quiz-print" className="space-y-3">
        {questions.map((q, i) => {
          const show = revealed[i] || (q.type === "mcq" && picked[i] !== undefined);
          return (
            <li key={i} className="rounded-2xl bg-surface-3 p-3">
              <div className="flex gap-1.5 text-[13px] font-medium text-ink">
                <span>{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <Markdown>{q.question}</Markdown>
                </div>
              </div>
              {q.options && (
                <div className="mt-2 grid gap-1.5">
                  {q.options.map((o, j) => {
                    const chosen = picked[i] === o;
                    const correct = show && o === q.answer;
                    const wrong = show && chosen && o !== q.answer;
                    return (
                      <button
                        key={j}
                        type="button"
                        disabled={picked[i] !== undefined}
                        onClick={() => setPicked((p) => ({ ...p, [i]: o }))}
                        className={`rounded-xl px-3 py-1.5 text-start text-[13px] ring-1 transition-colors ${
                          correct
                            ? "bg-green-500/15 text-ink ring-green-500/50"
                            : wrong
                              ? "bg-red-500/15 text-ink ring-red-500/50"
                              : "bg-surface text-ink-2 ring-line hover:ring-accent/50"
                        }`}
                      >
                        <span className="me-2 font-semibold">{"ABCD"[j]}.</span>
                        {o}
                      </button>
                    );
                  })}
                </div>
              )}
              {!show && q.type === "short" && (
                <button type="button" className="mt-2 text-[13px] font-medium text-accent-fg" onClick={() => setRevealed((r) => ({ ...r, [i]: true }))}>
                  {t("copilot.results.showAnswer")}
                </button>
              )}
              {show && (
                <div className="mt-2 rounded-xl bg-surface px-3 py-2 text-[13px] text-ink-2">
                  <span className="font-semibold text-ink">{t("copilot.results.answer")}: </span>
                  {q.answer}
                  {q.explanation && <p className="mt-1">{q.explanation}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Export a generated document to a saved PDF / text file in the user's Copilot history, then download it. */
export function ExportPanel({
  fields,
  run,
}: {
  fields: { key: string; label: string; default?: string }[];
  run: (format: "pdf" | "text", header: Record<string, string>) => Promise<{ file: CopilotFileInfo }>;
}) {
  const { t, err } = useCopilotText();
  const [header, setHeader] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, f.default ?? ""])));
  const [busy, setBusy] = useState<"pdf" | "text" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<CopilotFileInfo | null>(null);

  async function go(format: "pdf" | "text") {
    setBusy(format);
    setError(null);
    try {
      const { file } = await run(format, Object.fromEntries(Object.entries(header).filter(([, v]) => v.trim())));
      setSaved(file);
      await downloadCopilotFile(file.id, file.filename);
    } catch (e) {
      setError(err(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl bg-surface-3 p-3">
      <p className="text-[13px] font-semibold text-ink">{t("copilot.results.export")}</p>
      <div className="grid grid-cols-2 gap-2">
        {fields.map((f) => (
          <div key={f.key}>
            <Label htmlFor={`ex-${f.key}`}>{f.label}</Label>
            <Input id={`ex-${f.key}`} value={header[f.key]} onChange={(e) => setHeader((h) => ({ ...h, [f.key]: e.target.value }))} />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => go("pdf")} disabled={busy !== null}>
          {busy === "pdf" ? t("copilot.results.renderingPdf") : t("copilot.results.downloadPdf")}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => go("text")} disabled={busy !== null}>
          {busy === "text" ? t("copilot.results.saving") : t("copilot.results.downloadText")}
        </Button>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
      {saved && !error && <p className="text-xs text-ink-3">{t("copilot.results.savedToFiles", { name: saved.filename })}</p>}
    </div>
  );
}
