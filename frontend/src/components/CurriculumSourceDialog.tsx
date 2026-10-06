import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudDownload } from "lucide-react";
import { useEffect, useState } from "react";
import {
  deleteCurriculumSource, getCurriculumSource, saveCurriculumSource, syncCurriculumSource, testCurriculumSource,
  type SourcePayload, type SourceReport,
} from "../pages/admin/syllabusApi";
import { ImportSummary, errMessage } from "./SyllabusImportDialog";
import { Badge, Button, ErrorText, Input, Label, Modal, Select } from "./ui";

const TARGETS = ["class", "subject", "chapter", "topics", "description", "content", "order"];

/** "source_field = chapter" per line -> {source_field: "chapter"} */
function parseFieldMap(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const [k, v] = line.split("=").map((x) => x.trim());
    if (k && v) out[k] = v;
  }
  return out;
}
/** "class: 64f..a1 = Class 8" per line -> {class: {"64f..a1": "Class 8"}} */
function parseValueMap(text: string): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*(class|subject)\s*:\s*(.+?)\s*=\s*(.+?)\s*$/i);
    if (m) (out[m[1].toLowerCase()] ??= {})[m[2]] = m[3];
  }
  return out;
}
const fmtFieldMap = (m?: Record<string, string>) => Object.entries(m ?? {}).map(([k, v]) => `${k} = ${v}`).join("\n");
const fmtValueMap = (m?: Record<string, Record<string, string>>) =>
  Object.entries(m ?? {}).flatMap(([kind, map]) => Object.entries(map).map(([id, name]) => `${kind}: ${id} = ${name}`)).join("\n");

/** Connect the school to the link that holds its curriculum (JSON, CSV or ZIP), test it, and sync it into the syllabus. */
export default function CurriculumSourceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const saved = useQuery({ queryKey: ["syllabus", "source"], queryFn: getCurriculumSource, enabled: open });
  const [url, setUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [header, setHeader] = useState("Authorization");
  const [fieldMap, setFieldMap] = useState("");
  const [valueMap, setValueMap] = useState("");
  const [createMissing, setCreateMissing] = useState(true);
  const [replace, setReplace] = useState(false);
  const [auto, setAuto] = useState(0);
  const [advanced, setAdvanced] = useState(false);
  const [report, setReport] = useState<SourceReport | null>(null);

  useEffect(() => {
    const s = saved.data;
    if (!s?.configured) return;
    setUrl(s.url ?? ""); setHeader(s.api_key_header ?? "Authorization"); setCreateMissing(s.create_missing ?? true);
    setReplace(s.mode === "replace"); setAuto(s.auto_sync_minutes ?? 0);
    setFieldMap(fmtFieldMap(s.field_map)); setValueMap(fmtValueMap(s.value_map));
    setAdvanced(Object.keys(s.field_map ?? {}).length + Object.keys(s.value_map ?? {}).length > 0);
  }, [saved.data]);

  const payload = (): SourcePayload => ({
    url: url.trim(), api_key: keyTouched ? apiKey : null, api_key_header: header.trim() || "Authorization",
    field_map: parseFieldMap(fieldMap), value_map: parseValueMap(valueMap), create_missing: createMissing,
    mode: replace ? "replace" : "merge", auto_sync_minutes: auto,
  });

  const test = useMutation({ mutationFn: () => testCurriculumSource(payload()), onSuccess: setReport });
  const save = useMutation({
    mutationFn: async (syncNow: boolean) => {
      await saveCurriculumSource(payload());
      setApiKey(""); setKeyTouched(false);
      return syncNow ? syncCurriculumSource(true) : null;
    },
    onSuccess: (r) => {
      if (r) setReport(r);
      void qc.invalidateQueries({ queryKey: ["syllabus"] });
      void qc.invalidateQueries({ queryKey: ["copilot", "context"] });
    },
  });
  const remove = useMutation({
    mutationFn: deleteCurriculumSource,
    onSuccess: () => {
      setUrl(""); setApiKey(""); setReport(null);
      void qc.invalidateQueries({ queryKey: ["syllabus", "source"] });
    },
  });
  const busy = test.isPending || save.isPending || remove.isPending;
  const error = test.error ?? save.error ?? remove.error;
  const s = saved.data;

  return (
    <Modal open={open} onClose={onClose} title="Curriculum source" size="xl">
      <div className="max-h-[75vh] space-y-4 overflow-y-auto p-1">
        <p className="text-sm text-ink-2">
          Paste the link to your curriculum file (JSON, CSV or a ZIP of them, for example a pre-signed S3 link). It is read into the
          syllabus, and the Copilot and the Class → Subject → Chapter browser use it straight away.
        </p>
        <div>
          <Label htmlFor="cs-url">Link</Label>
          <Input id="cs-url" value={url} onChange={(e) => { setUrl(e.target.value); setReport(null); }} placeholder="https://your-bucket.s3.amazonaws.com/syllabus.json?X-Amz-…" />
        </div>
        <div>
          <Label htmlFor="cs-key">API key <span className="font-normal text-ink-3">(only if the link needs one)</span></Label>
          <Input id="cs-key" type="password" autoComplete="off" value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setKeyTouched(true); setReport(null); }}
            placeholder={s?.has_api_key && !keyTouched ? "Saved. Leave blank to keep it, or type a new one" : "Not needed for pre-signed links"} />
          {s?.has_api_key && (
            <button type="button" className="mt-1 text-xs text-accent-fg hover:underline" onClick={() => { setApiKey(""); setKeyTouched(true); }}>
              Remove the saved key
            </button>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" className="mt-1" checked={createMissing} onChange={(e) => { setCreateMissing(e.target.checked); setReport(null); }} />
            <span>Create classes and subjects that don't exist yet</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" className="mt-1" checked={replace} onChange={(e) => { setReplace(e.target.checked); setReport(null); }} />
            <span>Replace existing chapters (otherwise matched by name and updated)</span>
          </label>
        </div>
        <div>
          <Label htmlFor="cs-auto">Keep it up to date</Label>
          <Select id="cs-auto" value={auto} onChange={(e) => setAuto(Number(e.target.value))}>
            <option value={0}>Only when I press Sync</option>
            <option value={60}>Every hour</option>
            <option value={1440}>Every day</option>
          </Select>
        </div>

        <button type="button" className="text-sm font-medium text-accent-fg hover:underline" onClick={() => setAdvanced(!advanced)}>
          {advanced ? "Hide" : "Show"} field mapping (if the file uses other field names or only ids)
        </button>
        {advanced && (
          <div className="space-y-3 rounded-2xl bg-surface-3 p-3">
            <div>
              <Label htmlFor="cs-fm">Field names, one per line: <code>file_field = {TARGETS.join(" | ")}</code></Label>
              <textarea id="cs-fm" rows={3} className="lg-field w-full font-mono text-xs" value={fieldMap} onChange={(e) => { setFieldMap(e.target.value); setReport(null); }}
                placeholder={"unit_title_en = chapter\nunit_number = order\nfull_text = content"} />
              <p className="mt-0.5 text-xs text-ink-3">Common names (class, grade, subject, chapter, unit_title_en, unit_number, full_text…) are recognised without this.</p>
            </div>
            <div>
              <Label htmlFor="cs-vm">Names for ids, one per line: <code>class: id = Class 8</code> or <code>subject: id = Science</code></Label>
              <textarea id="cs-vm" rows={3} className="lg-field w-full font-mono text-xs" value={valueMap} onChange={(e) => { setValueMap(e.target.value); setReport(null); }} />
            </div>
          </div>
        )}

        {s?.configured && s.last_status && (
          <p className="text-xs text-ink-3">
            Last sync: <Badge tone={s.last_status === "error" ? "red" : s.last_status === "ok" ? "green" : "gray"}>{s.last_status}</Badge>{" "}
            {s.last_message} {s.last_synced_at ? `· ${new Date(s.last_synced_at).toLocaleString()}` : ""}
          </p>
        )}
        {error && <ErrorText>{errMessage(error)}</ErrorText>}
        {report && (
          <div className="space-y-2">
            {report.unchanged ? <p className="text-sm text-ink-2">{report.message}</p> : <ImportSummary report={report} />}
            {!report.unchanged && (
              <p className="text-xs text-ink-3">
                Read {report.records_read ?? 0} records from {(report.source_files ?? []).length} file(s)
                {(report.skipped_files ?? []).length > 0 && ` · skipped: ${(report.skipped_files ?? []).join("; ")}`}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-2">
          {s?.configured ? <Button type="button" variant="danger" size="sm" disabled={busy} onClick={() => remove.mutate()}>Disconnect</Button> : <span />}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" disabled={!url.trim() || busy} onClick={() => test.mutate()}>
              {test.isPending ? "Checking…" : "Test link"}
            </Button>
            <Button type="button" variant="secondary" disabled={!url.trim() || busy} onClick={() => save.mutate(false)}>Save</Button>
            <Button type="button" glow disabled={!url.trim() || busy} onClick={() => save.mutate(true)}>
              <CloudDownload size={16} /> {save.isPending ? "Working…" : "Save and sync now"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
