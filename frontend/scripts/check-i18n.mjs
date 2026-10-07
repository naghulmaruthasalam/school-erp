// Usage: node scripts/check-i18n.mjs [--hardcoded] [path-prefix]
//  - every key exists in both languages, Arabic values are really Arabic
//  - every literal t("a.b") used in src exists
//  - with --hardcoded: lists JSX text / string props that still look like untranslated English (per file)
import fs from "node:fs";
import path from "node:path";

const src = path.resolve("src");
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object") flatten(v, `${prefix}${k}.`, out);
    else out[`${prefix}${k}`] = v;
  }
  return out;
}
const files = fs.readdirSync(path.join(src, "i18n", "locales")).filter((f) => f.endsWith(".json")).sort();
const en = flatten(read(path.join(src, "i18n/en.json")));
const ar = flatten(read(path.join(src, "i18n/ar.json")));
for (const f of files) Object.assign(f.endsWith(".ar.json") ? ar : en, flatten(read(path.join(src, "i18n/locales", f))));

let problems = 0;
const bad = (m) => { problems++; console.log(m); };
for (const k of Object.keys(en)) if (!(k in ar)) bad(`missing in ar: ${k}`);
for (const k of Object.keys(ar)) if (!(k in en)) bad(`missing in en: ${k}`);
const ARABIC = /[؀-ۿ]/;
for (const [k, v] of Object.entries(ar)) {
  const plain = String(v).replace(/\{\w+\}/g, "").replace(/[\d\s.,:;!?()/%+\-–—_·•&@#$*'"]/g, "");
  if (plain && !ARABIC.test(plain) && !/^(AI|ISBN|PayU|UPI|PDF|ID|SMS|OTP|QR|GST|VAT|CSV|JSON|URL|API|WhatsApp|Gmail|Copilot)$/i.test(plain)) bad(`ar value is not Arabic: ${k} = ${v}`);
  const enPh = (String(en[k] ?? "").match(/\{\w+\}/g) ?? []).sort().join();
  const arPh = (String(v).match(/\{\w+\}/g) ?? []).sort().join();
  if (enPh !== arPh) bad(`placeholder mismatch: ${k}`);
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "demo" && e.name !== "locales") walk(p, out); }
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}
const prefix = process.argv.find((a, i) => i > 1 && !a.startsWith("--")) ?? "";
const code = walk(src).filter((f) => path.relative(src, f).startsWith(prefix));
for (const f of code) {
  const text = fs.readFileSync(f, "utf8");
  for (const m of text.matchAll(/\bt\(\s*["'`]([\w.]+)["'`]/g)) if (!(m[1] in en)) bad(`${path.relative(src, f)}: unknown key ${m[1]}`);
}

if (process.argv.includes("--hardcoded")) {
  let total = 0;
  const rows = [];
  for (const f of code) {
    if (/api\.ts$|types\.ts$|demo|Demo/.test(f)) continue;
    const text = fs.readFileSync(f, "utf8");
    const hits = new Set();
    for (const m of text.matchAll(/>\s*([A-Z][A-Za-z][^<>{}\n]{2,})\s*</g)) hits.add(m[1].trim());
    for (const m of text.matchAll(/\b(?:placeholder|title|aria-label|label|alt)="([A-Za-z][^"{}]{2,})"/g)) hits.add(m[1]);
    for (const m of text.matchAll(/^\s+([A-Z][a-z]+(?:\s[A-Za-z&',.!?-]+){1,})\s*$/gm)) hits.add(m[1].trim());
    if (hits.size) { rows.push([path.relative(src, f), hits.size, [...hits].slice(0, 3)]); total += hits.size; }
  }
  rows.sort((a, b) => b[1] - a[1]);
  for (const [f, n, ex] of rows) console.log(`${String(n).padStart(4)}  ${f}   e.g. ${ex.map((s) => JSON.stringify(s)).join(" | ")}`);
  console.log(`hardcoded-looking strings: ${total} in ${rows.length} files`);
}
console.log(problems ? `${problems} i18n problem(s)` : "i18n keys OK");
process.exit(problems ? 1 : 0);
