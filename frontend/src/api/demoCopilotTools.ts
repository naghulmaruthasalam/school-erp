// DEMO BUILD ONLY. In-browser stand-ins for the question paper, grading and file-history endpoints (no server).
import { CAPTURE } from "../copilot/demo/capture";

type Json = Record<string, any>;
const classes = () => CAPTURE.TEACHER.context.classes as { id: string; name: string; subjects: { id: string; name: string; chapters: string[] }[] }[];
const uid = () => Math.random().toString(16).slice(2, 10) + Date.now().toString(16).slice(-6);
const MARKS: Record<string, number> = { mcq: 1, short: 2, state_precisely: 3, answer_in_brief: 4, long: 5 };
const LABEL: Record<string, string> = { mcq: "Multiple choice", short: "Short answer", state_precisely: "State precisely", answer_in_brief: "Answer in brief", long: "Long answer" };
const ORDER = Object.keys(MARKS);

// ------------------------------------------------------------------ a small question bank to draw from
interface Q { type: string; text: string; options?: string[]; answer: string; keywords?: string }
const FACTS: Record<string, Q[]> = {
  Light: [
    { type: "mcq", text: "A ray of light going from air into water bends. This is called:", options: ["Reflection", "Refraction", "Diffraction", "Dispersion"], answer: "Refraction", keywords: "bending, medium" },
    { type: "mcq", text: "The image formed by a plane mirror is:", options: ["Real and inverted", "Virtual and upright", "Real and magnified", "Virtual and diminished"], answer: "Virtual and upright" },
    { type: "mcq", text: "The angle of incidence is equal to the angle of:", options: ["Refraction", "Reflection", "Deviation", "Emergence"], answer: "Reflection" },
    { type: "mcq", text: "Light travels fastest in:", options: ["Water", "Glass", "Vacuum", "Diamond"], answer: "Vacuum" },
    { type: "mcq", text: "A concave mirror used as a shaving mirror forms an image that is:", options: ["Virtual and enlarged", "Real and small", "Virtual and small", "Real and inverted"], answer: "Virtual and enlarged" },
    { type: "short", text: "State the two laws of reflection of light.", answer: "The angle of incidence equals the angle of reflection, and the incident ray, reflected ray and normal lie in the same plane.", keywords: "angle of incidence, angle of reflection, same plane" },
    { type: "short", text: "Why does a pencil look bent in a glass of water?", answer: "Light refracts as it passes from water to air, changing the apparent position of the pencil.", keywords: "refraction, water, air" },
    { type: "short", text: "Define the refractive index of a medium.", answer: "The ratio of the speed of light in vacuum to its speed in the medium: n = c/v.", keywords: "ratio, speed of light" },
    { type: "long", text: "Explain refraction of light through a glass slab with a labelled ray diagram.", answer: "The ray bends towards the normal on entering the denser glass and away from it on leaving; the emergent ray is parallel to the incident ray but laterally shifted.", keywords: "normal, denser, lateral shift, parallel" },
    { type: "long", text: "Describe the image formation by a concave mirror when the object is beyond the centre of curvature.", answer: "The image is formed between the focus and the centre of curvature; it is real, inverted and diminished.", keywords: "real, inverted, diminished, between F and C" },
  ],
  Electricity: [
    { type: "mcq", text: "The unit of electric resistance is:", options: ["Volt", "Ampere", "Ohm", "Watt"], answer: "Ohm" },
    { type: "mcq", text: "A 6 V battery drives a current of 2 A. The resistance is:", options: ["12 Ω", "3 Ω", "4 Ω", "8 Ω"], answer: "3 Ω" },
    { type: "mcq", text: "In a series circuit the current is:", options: ["Different in each part", "The same everywhere", "Zero", "Largest at the battery"], answer: "The same everywhere" },
    { type: "short", text: "State Ohm's law.", answer: "At constant temperature the current through a conductor is proportional to the potential difference across it: V = IR.", keywords: "V = IR, constant temperature" },
    { type: "short", text: "Why is a long thin wire a better heater than a short thick one?", answer: "It has higher resistance, so more electrical energy is turned into heat.", keywords: "resistance, heat" },
    { type: "long", text: "Derive the equivalent resistance of two resistors connected in parallel.", answer: "The potential difference is the same across both, the currents add up, so 1/R = 1/R1 + 1/R2.", keywords: "same potential difference, currents add, 1/R" },
  ],
};
let draw = 0;
function pool(chapter: string, type: string, n: number): Q[] {
  const base = (FACTS[chapter] ?? []).filter((q) => q.type === type);
  const out: Q[] = [];
  for (let i = 0; i < n; i++) {
    const k = draw++;
    if (base.length) out.push(base[k % base.length]);
    else if (type === "mcq") out.push({ type, text: `Which statement about "${chapter}" is correct? (practice ${k + 1})`, options: ["The key definition from the chapter", "A statement unrelated to the topic", "A random fact", "None of these"], answer: "The key definition from the chapter" });
    else out.push({ type, text: `${type === "long" ? "Explain in detail" : "Explain briefly"} an important idea from "${chapter}" with an example. (practice ${k + 1})`, answer: `A correct explanation of the idea with a relevant example from ${chapter}.`, keywords: `${chapter.toLowerCase()}, example` });
  }
  return out;
}

// ------------------------------------------------------------------ stores
interface Paper { id: string; class_id: string; class_name: string; subject_id: string; subject_name: string; chapters: string[]; total_marks: number; suggested_duration: string; question_count: number; created_at: string; questions: Json[]; new_questions_written?: number }
const papers: Paper[] = [];
const bank: Json[] = [];
const sheets: Json[] = [];
interface Job { id: string; paper_id: string; started: number; students: { student_name: string }[] }
const jobs: Job[] = [];
interface DemoFile { info: Json; blob: Blob }
const files: DemoFile[] = [];

const paperSummary = (p: Paper) => { const { questions, new_questions_written, ...rest } = p; void questions; void new_questions_written; return rest; };
const sheetSummary = (s: Json) => { const { questions, ...rest } = s; return { ...rest, needs_review: questions.filter((q: Json) => q.needs_review && !q.adjusted).length }; };

// ------------------------------------------------------------------ files (PDF / text)
function pdfBlob(title: string, markdown: string): Blob {
  const clean = (s: string) => s.replace(/\*\*|\*|^#+\s*|^[-|]\s*|\\\|/gm, "").replace(/\|/g, "  ").replace(/[^\x20-\x7e]/g, "?");
  const wrap: string[] = [];
  for (const raw of [title, "", ...markdown.split("\n")]) {
    const line = clean(raw).trimEnd();
    if (!line) { wrap.push(""); continue; }
    let cur = "";
    for (const word of line.split(/(\s+)/)) {  // wrap at word boundaries, keeping the leading indent
      if ((cur + word).length > 88 && cur.trim()) { wrap.push(cur.trimEnd()); cur = "  " + word.trimStart(); } else cur += word;
    }
    wrap.push(cur);
  }
  const pages: string[][] = [];
  for (let i = 0; i < wrap.length; i += 52) pages.push(wrap.slice(i, i + 52));
  const objs: string[] = [];
  const kids: string[] = [];
  pages.forEach((lines, i) => {
    const content = "BT /F1 10 Tf 50 790 Td 14 TL\n" + lines.map((l) => `(${l.replace(/[\\()]/g, "\\$&")}) Tj T*`).join("\n") + "\nET";
    objs[3 + i * 2] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
    objs[2 + i * 2] = `<< /Type /Page /Parent 1 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${4 + i * 2} 0 R >>`;
    kids.push(`${3 + i * 2} 0 R`);
  });
  objs[0] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objs[1] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`;
  // object numbers: 1 catalog, 2 pages, then page/content pairs; re-index so Parent points at 2
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  const body = objs.map((o, i) => (i === 1 ? o : o)); // objs are already in object order (index + 1)
  body.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o.replace("/Parent 1 0 R", "/Parent 2 0 R")}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${body.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
  pdf += `trailer\n<< /Size ${body.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

export function saveDemoFile(kind: string, title: string, markdown: string, format: string): Json {
  const stem = title.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "document";
  const pdf = format !== "text";
  const blob = pdf ? pdfBlob(title, markdown) : new Blob([`${title}\n\n${markdown}`], { type: "text/plain" });
  const info = { id: uid(), kind, title, filename: `${stem}.${pdf ? "pdf" : "txt"}`, content_type: pdf ? "application/pdf" : "text/plain", size_bytes: blob.size, created_at: new Date().toISOString() };
  files.unshift({ info, blob });
  return { step: "finalize", file: info };
}

function paperMarkdown(p: Paper, answers: boolean): string {
  const out: string[] = [];
  let n = 0, sec = 0;
  for (const t of ORDER) {
    const qs = p.questions.filter((q) => q.question_type === t);
    if (!qs.length) continue;
    out.push(`## Section ${String.fromCharCode(65 + sec++)}: ${LABEL[t]} (${MARKS[t]} mark${MARKS[t] === 1 ? "" : "s"} each)`, "");
    for (const q of qs) {
      out.push(`${++n}. ${q.text} [${q.marks}]`);
      (q.options ?? []).forEach((o: string, i: number) => out.push(`   (${String.fromCharCode(97 + i)}) ${o}`));
      if (answers) out.push(`   Answer: ${q.answer}`, q.keywords ? `   Key points: ${q.keywords}` : "");
      out.push("");
    }
  }
  return out.join("\n");
}

// ------------------------------------------------------------------ grading
function gradePaper(paper: Paper, name: string): Json {
  const questions = paper.questions.map((q, i) => {
    const n = i + 1;
    if (q.question_type === "mcq") {
      const right = (n + name.length) % 4 !== 0;
      const wrongOpt = (q.options as string[]).find((o) => o !== q.answer)!;
      return { question_number: n, question_type: q.question_type, marks_possible: q.marks, marks_awarded: right ? q.marks : 0, student_answer: right ? q.answer : wrongOpt, feedback: right ? "Correct." : `Incorrect, expected '${q.answer}'.`, needs_review: false, adjusted: false };
    }
    const full = (n + name.length) % 3 === 0;
    const awarded = full ? q.marks : Math.max(0.5, Math.floor(q.marks * 0.6 * 2) / 2);
    return { question_number: n, question_type: q.question_type, marks_possible: q.marks, marks_awarded: awarded, adjusted: false,
      student_answer: full ? q.answer : String(q.answer).split(/[,;.]/)[0] + ".",
      feedback: full ? "Covers all the expected points." : "Gets the main idea but leaves out some expected points (" + (q.keywords ?? "key terms") + ").", needs_review: n % 4 === 0 };
  });
  const sheet = { id: uid(), paper_id: paper.id, student_name: name, student_id: null, total_marks_possible: paper.total_marks, total_marks_awarded: questions.reduce((s, q) => s + q.marks_awarded, 0), questions, created_at: new Date().toISOString() };
  sheets.unshift(sheet);
  return sheet;
}

function jobStatus(job: Job): Json {
  const t = Date.now() - job.started;
  const paper = papers.find((p) => p.id === job.paper_id)!;
  const total = paper.questions.length;
  const students = job.students.map((s: Json, i) => {
    if (s.result_id) return s;
    const begin = i * 900, perQ = 450, end = begin + 600 + total * perQ;
    if (t < begin) return { ...s, status: "queued", current_question: null, total_questions: total, result_id: null, error: null };
    if (t < end) return { ...s, status: "grading", current_question: Math.min(total, Math.max(1, Math.ceil((t - begin - 600) / perQ))), total_questions: total, result_id: null, error: null };
    const sheet = gradePaper(paper, s.student_name);
    Object.assign(s, { status: "done", current_question: null, total_questions: total, result_id: sheet.id, error: null });
    return s;
  });
  return { id: job.id, paper_id: job.paper_id, students, finished: students.every((s: Json) => s.status === "done") };
}

// ------------------------------------------------------------------ routing
export function getDemoCopilotToolsResponse(url: string, params?: Json): unknown | null {
  const u = url.replace(/\?.*$/, "");
  if (u.endsWith("/copilot/qpg/options")) {
    return { classes: classes().map((c) => ({ ...c, types: ["mcq", "short", "long"].map((k) => ({ key: k, label: LABEL[k], marks: MARKS[k], max: { mcq: 20, short: 10, long: 5 }[k] })) })), limits: { paper_marks: 100, chapter_marks: 25 } };
  }
  if (u.endsWith("/copilot/qpg/papers")) return papers.map(paperSummary);
  let m = u.match(/\/copilot\/qpg\/papers\/([\w]+)$/);
  if (m) return papers.find((p) => p.id === m![1]) ?? null;
  if (u.endsWith("/copilot/qpg/bank")) return bank.filter((b) => (!params?.chapter || b.chapter === params.chapter) && (!params?.subject_id || b.subject_id === params.subject_id));
  if (u.endsWith("/copilot/grading/results")) return sheets.filter((s) => !params?.paper_id || s.paper_id === params.paper_id).map(sheetSummary);
  m = u.match(/\/copilot\/grading\/results\/([\w]+)$/);
  if (m) return sheets.find((s) => s.id === m![1]) ?? null;
  m = u.match(/\/copilot\/grading\/batch\/([\w]+)$/);
  if (m) { const j = jobs.find((x) => x.id === m![1]); return j ? jobStatus(j) : null; }
  if (u.endsWith("/copilot/files")) return files.filter((f) => !params?.kind || f.info.kind === params.kind).map((f) => f.info);
  m = u.match(/\/copilot\/files\/([\w]+)\/download$/);
  if (m) return files.find((f) => f.info.id === m![1])?.blob ?? null;
  return null;
}

export function mutateDemoCopilotTools(method: string, url: string, data: unknown): unknown | null {
  const u = url.replace(/\?.*$/, "");
  const body = (data && typeof data === "object" && !(data instanceof FormData) ? data : {}) as Json;
  if (method === "post" && u.endsWith("/copilot/qpg/generate")) {
    const cls = classes().find((c) => c.id === body.class_id)!;
    const subject = cls.subjects.find((s) => s.id === body.subject_id)!;
    const qs: Json[] = [];
    for (const sel of body.chapters as { chapter: string; counts: Record<string, number> }[]) {
      for (const t of ORDER) for (const q of pool(sel.chapter, t, sel.counts[t] ?? 0)) qs.push({ id: uid(), chapter: sel.chapter, question_type: t, marks: MARKS[t], text: q.text, options: q.options ?? null, answer: q.answer, keywords: q.keywords ?? null });
    }
    qs.sort((a, b) => ORDER.indexOf(a.question_type) - ORDER.indexOf(b.question_type));
    const total = qs.reduce((s, q) => s + q.marks, 0);
    const mins = Math.max(15, Math.ceil((total * 1.5) / 15) * 15);
    const paper: Paper = { id: uid(), class_id: cls.id, class_name: cls.name, subject_id: subject.id, subject_name: subject.name, chapters: [...new Set(qs.map((q) => q.chapter))], total_marks: total,
      suggested_duration: `${mins >= 60 ? Math.floor(mins / 60) + " hour" + (mins >= 120 ? "s" : "") : ""}${mins % 60 && mins >= 60 ? " " : ""}${mins % 60 ? (mins % 60) + " minutes" : ""}`,
      question_count: qs.length, created_at: new Date().toISOString(), questions: qs, new_questions_written: papers.length === 0 ? qs.length + 2 : 0 };
    papers.unshift(paper);
    return paper;
  }
  if (method === "delete" && /\/copilot\/qpg\/papers\/\w+$/.test(u)) { const i = papers.findIndex((p) => u.endsWith(p.id)); if (i >= 0) papers.splice(i, 1); return {}; }
  let m = u.match(/\/copilot\/qpg\/papers\/(\w+)\/export$/);
  if (method === "post" && m) {
    const p = papers.find((x) => x.id === m![1])!;
    const h = (body.header ?? {}) as Json;
    const title = (h.exam_title || `${p.subject_name} - ${p.class_name}`) + (body.include_answers ? " (Answer key)" : "");
    const head = [h.school_name, `Class: ${p.class_name}    Subject: ${p.subject_name}`, `Maximum marks: ${p.total_marks}    Time: ${h.time_label || p.suggested_duration}`, h.date_label ? `Date: ${h.date_label}` : ""].filter(Boolean).join("\n");
    return saveDemoFile(body.include_answers ? "answer_key" : "question_paper", title, head + "\n\n" + paperMarkdown(p, !!body.include_answers), body.format);
  }
  if (method === "post" && u.endsWith("/copilot/qpg/bank")) {
    const item = { id: uid(), source: "teacher", marks: MARKS[body.question_type] ?? 1, ...body };
    bank.unshift(item);
    return item;
  }
  if (method === "delete" && /\/copilot\/qpg\/bank\/\w+$/.test(u)) { const i = bank.findIndex((b) => u.endsWith(b.id)); if (i >= 0) bank.splice(i, 1); return {}; }
  if (method === "post" && u.endsWith("/copilot/grading/evaluate") && data instanceof FormData) {
    const paper = papers.find((p) => p.id === data.get("paper_id"))!;
    return gradePaper(paper, String(data.get("student_name")));
  }
  if (method === "post" && u.endsWith("/copilot/grading/batch") && data instanceof FormData) {
    const students = JSON.parse(String(data.get("students"))) as { student_name: string }[];
    const job: Job = { id: uid(), paper_id: String(data.get("paper_id")), started: Date.now(), students: students.map((s) => ({ student_name: s.student_name, status: "queued", current_question: null, total_questions: null, result_id: null, error: null })) };
    jobs.unshift(job);
    return jobStatus(job);
  }
  m = u.match(/\/copilot\/grading\/results\/(\w+)$/);
  if (method === "patch" && m) {
    const s = sheets.find((x) => x.id === m![1])!;
    for (const c of body.changes as Json[]) {
      const q = s.questions.find((x: Json) => x.question_number === c.question_number);
      if (q) { q.marks_awarded = c.marks_awarded; q.adjusted = true; if (c.feedback != null) q.feedback = c.feedback; }
    }
    s.total_marks_awarded = s.questions.reduce((t: number, q: Json) => t + q.marks_awarded, 0);
    return s;
  }
  if (method === "delete" && m) { const i = sheets.findIndex((x) => x.id === m![1]); if (i >= 0) sheets.splice(i, 1); return {}; }
  if (method === "post" && u.endsWith("/copilot/grading/report")) {
    const p = papers.find((x) => x.id === body.paper_id)!;
    const mine = sheets.filter((s) => s.paper_id === p.id).sort((a, b) => b.total_marks_awarded - a.total_marks_awarded);
    const md = [`Class: ${p.class_name}    Subject: ${p.subject_name}`, `Maximum marks: ${p.total_marks}    Students: ${mine.length}`, "", "## Class summary",
      ...mine.map((s) => `${s.student_name}: ${s.total_marks_awarded} / ${s.total_marks_possible}`), "",
      ...mine.flatMap((s) => [`## ${s.student_name}: ${s.total_marks_awarded} / ${s.total_marks_possible}`, ...s.questions.map((q: Json) => `Q${q.question_number} (${q.question_type}) ${q.marks_awarded}/${q.marks_possible}  ${q.feedback}`), ""])].join("\n");
    return saveDemoFile("grading_report", `Grading report - ${p.subject_name} ${p.class_name}`, md, body.format);
  }
  return null;
}
