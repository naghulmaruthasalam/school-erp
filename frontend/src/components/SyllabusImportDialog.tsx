import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, FileUp } from "lucide-react";
import { useRef, useState } from "react";
import { downloadImportTemplate, importSyllabus, type ImportReport } from "../pages/admin/syllabusApi";
import { Badge, Button, ErrorText, Modal } from "./ui";

export function errMessage(err: unknown): string {
  const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return detail ?? "The import failed. Check the file and try again.";
}

export function ImportSummary({ report }: { report: ImportReport }) {
  const t = report.totals;
  return (
    <div className="space-y-2 rounded-2xl bg-surface-3 p-3 text-sm">
      <p className="font-semibold text-ink">
        {report.dry_run ? "Preview" : "Done"} · {report.academic_year}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Badge tone="green">{t.syllabi_created} new syllabus</Badge>
        <Badge tone="blue">{t.syllabi_updated} updated</Badge>
        <Badge tone="violet">{t.chapters_added} chapters added</Badge>
        <Badge tone="gray">{t.chapters_updated} chapters updated</Badge>
        {t.skipped_groups > 0 && <Badge tone="amber">{t.skipped_groups} skipped</Badge>}
      </div>
      {(report.created_classes.length > 0 || report.created_subjects.length > 0) && (
        <p className="text-xs text-ink-2">
          {report.dry_run ? "Will create" : "Created"}: {[...report.created_classes, ...report.created_subjects].join(", ")}
        </p>
      )}
      <ul className="max-h-40 space-y-0.5 overflow-y-auto text-xs text-ink-2">
        {report.syllabi.map((s) => (
          <li key={`${s.class}-${s.subject}`}>
            <span className="font-medium text-ink">{s.class} · {s.subject}</span> — {s.chapters.length} chapters ({s.action})
          </li>
        ))}
      </ul>
      {report.problems.length > 0 && (
        <ul className="space-y-0.5 text-xs text-red-600">
          {report.problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
    </div>
  );
}

/** Upload a CSV/JSON curriculum, preview what it would change, then apply it. */
export default function SyllabusImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [createMissing, setCreateMissing] = useState(false);
  const [replace, setReplace] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  const run = useMutation({
    mutationFn: (dryRun: boolean) => importSyllabus(file!, { dryRun, createMissing, replace }),
    onSuccess: (r) => {
      setReport(r);
      if (!r.dry_run) {
        void qc.invalidateQueries({ queryKey: ["syllabus"] });
        void qc.invalidateQueries({ queryKey: ["teacher", "syllabus"] });
        void qc.invalidateQueries({ queryKey: ["copilot", "context"] });
      }
    },
  });

  function close() {
    setFile(null); setReport(null); run.reset();
    onClose();
  }

  const applied = report && !report.dry_run;
  const nothingToDo = report ? report.totals.chapters_added + report.totals.chapters_updated === 0 : true;

  return (
    <Modal open={open} onClose={close} title="Import syllabus" size="lg">
      <div className="space-y-4 p-1">
        <p className="text-sm text-ink-2">
          Load classes, subjects and chapters (with topics and notes) from a CSV or JSON file. Nothing is saved until you press Import.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={input} type="file" accept=".csv,.json,text/csv,application/json" className="hidden" data-testid="syllabus-file"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setReport(null); run.reset(); }} />
          <Button type="button" variant="secondary" onClick={() => input.current?.click()}><FileUp size={16} /> {file ? file.name : "Choose file"}</Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => void downloadImportTemplate()}><Download size={14} /> Template</Button>
        </div>
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" className="mt-1" checked={createMissing} onChange={(e) => { setCreateMissing(e.target.checked); setReport(null); }} />
          <span>Create classes and subjects that don't exist yet<span className="block text-xs text-ink-3">Otherwise rows for unknown classes or subjects are reported and skipped.</span></span>
        </label>
        <label className="flex items-start gap-2 text-sm text-ink">
          <input type="checkbox" className="mt-1" checked={replace} onChange={(e) => { setReplace(e.target.checked); setReport(null); }} />
          <span>Replace existing chapters<span className="block text-xs text-ink-3">Off: chapters are matched by name and updated, others are kept.</span></span>
        </label>

        {run.isError && <ErrorText>{errMessage(run.error)}</ErrorText>}
        {report && <ImportSummary report={report} />}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>{applied ? "Close" : "Cancel"}</Button>
          {!applied && (
            <>
              <Button type="button" variant="secondary" disabled={!file || run.isPending} onClick={() => run.mutate(true)}>Preview</Button>
              <Button type="button" glow disabled={!file || run.isPending || !report || nothingToDo} onClick={() => run.mutate(false)}>
                {run.isPending ? "Working…" : "Import"}
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
