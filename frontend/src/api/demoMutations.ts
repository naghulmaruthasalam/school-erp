// Backend-less "live demo" behaviour (VITE_STANDALONE_DEMO builds only).
// Writes succeed locally and show up in the matching list for the rest of the session, so every
// form in the app can be tried without a server. Nothing leaves the browser.

type Row = Record<string, unknown>;

const created = new Map<string, Row[]>(); // list path -> rows created this session
const patched = new Map<string, Row>(); // row id -> field overrides
const removed = new Set<string>();
let seq = 1000;

const stripQuery = (url: string) => url.replace(/\?.*$/, "").replace(/\/+$/, "");
const lastSegment = (path: string) => path.split("/").pop() ?? "";
const looksLikeId = (s: string) => /^(demo-|[0-9a-f]{24}$|[a-z]{1,4}\d+$)/i.test(s) || /\d/.test(s);

function parseBody(data: unknown): Row {
  if (data instanceof FormData) {
    const out: Row = {};
    data.forEach((v, k) => { out[k] = v instanceof File ? v.name : v; });
    return out;
  }
  if (typeof data === "string") {
    try { return JSON.parse(data) as Row; } catch { return {}; }
  }
  return (data as Row) ?? {};
}

const AI_REPLIES: Array<[RegExp, string]> = [
  [/attendance|present|absent/i, "Attendance is at **93%** this month. 2 students were absent today — I can list them or draft a message to their parents."],
  [/fee|due|pending|payment|invoice/i, "₹15,00,000 is pending across 45 invoices; collection is **82%** of the expected amount. Class 10 has the largest outstanding balance."],
  [/homework|assignment/i, "There are 3 homework items due this week: Mathematics (Algebra worksheet), Physics (Optics notes) and English (Essay draft)."],
  [/student|how many|count/i, "The school has **1,250 students** across Classes 6–10. Class 10 is the largest with 120 students."],
  [/exam|result|marks|grade/i, "The Half Yearly exams start on 4 Nov. Class 10 averaged **78%** in the last unit test, up 3 points."],
  [/timetable|schedule|period|class today/i, "Next up: Mathematics with Class 10-A at 09:20, then Physics with Class 9-B at 10:30."],
];

function aiReply(message: string): string {
  const hit = AI_REPLIES.find(([rx]) => rx.test(message));
  return hit
    ? hit[1]
    : "I'm running in demo mode with sample data. Try asking about attendance, fees, homework, exams or today's timetable.";
}

/** Result for a non-GET request, or null to let it go through untouched. */
export function demoMutation(method: string, url: string, rawBody: unknown): unknown | null {
  const path = stripQuery(url);
  const body = parseBody(rawBody);

  if (path.includes("/ai/generate-homework")) {
    const topic = String(body.topic ?? "the topic");
    return {
      content: `**${topic} — practice set**\n\n1. Define the key terms in your own words.\n2. Solve 5 graded problems (2 easy, 2 medium, 1 challenge).\n3. Write a short reflection on where you got stuck.`,
    };
  }
  if (/\/ai\/[a-z-]+$/.test(path)) {
    return { response: aiReply(String(body.message ?? "")), conversation_id: "demo-conversation" };
  }
  if (path.endsWith("/auth/change-password") || path.includes("/auth/")) return {};

  if (method === "post") {
    if (path.endsWith("/uploads") || path.endsWith("/uploads/documents")) {
      const name = String(body.file ?? "file");
      return { id: `demo-file-${seq++}`, original_filename: name, filename: name, size: 1024, content_type: "application/octet-stream", category: body.category ?? "GENERAL", created_at: new Date().toISOString() };
    }
    const action = lastSegment(path);
    if (["read", "review", "cancel", "return", "reset-password", "initiate", "manual", "seed"].includes(action) || path.includes("/payments/")) {
      return { ok: true, credentials: { email: "demo.user", password: "Demo@1234" } };
    }
    const row: Row = { ...body, id: `demo-${seq++}`, created_at: new Date().toISOString(), status: body.status ?? "ACTIVE" };
    if (body.first_name || body.last_name) {
      row.full_name = [body.first_name, body.last_name].filter(Boolean).join(" ");
    }
    if (!created.has(path)) created.set(path, []);
    created.get(path)!.unshift(row);
    // Login credentials dialog shown after creating a student/teacher.
    if (/\/(students|teachers)$/.test(path)) row.credentials = { email: `DEMO-${seq}`, password: "Welcome@123" };
    return row;
  }

  if (method === "patch" || method === "put") {
    const id = lastSegment(path);
    patched.set(id, { ...(patched.get(id) ?? {}), ...body });
    return { id, ...body };
  }

  if (method === "delete") {
    removed.add(lastSegment(path));
    return {};
  }
  return null;
}

/** Layers this session's creates/edits/deletes over a canned GET response. */
export function overlayDemoList<T>(url: string, data: T): T {
  if (!import.meta.env.VITE_STANDALONE_DEMO) return data;
  const path = stripQuery(url);
  const mine = created.get(path) ?? [];
  const decorate = (rows: Row[]) =>
    rows.filter((r) => !removed.has(String(r.id))).map((r) => (patched.has(String(r.id)) ? { ...r, ...patched.get(String(r.id)) } : r));

  if (Array.isArray(data)) return [...decorate([...mine, ...(data as Row[])])] as unknown as T;
  const page = data as unknown as { items?: Row[]; total?: number };
  if (page && Array.isArray(page.items)) {
    const items = decorate([...mine, ...page.items]);
    return { ...page, items, total: Math.max(0, (page.total ?? page.items.length) + mine.length - (page.items.length + mine.length - items.length)) } as unknown as T;
  }
  const id = lastSegment(path);
  if (looksLikeId(id) && data && typeof data === "object" && patched.has(id)) return { ...data, ...patched.get(id) } as T;
  return data;
}
