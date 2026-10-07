import { useEffect } from "react";
import { api } from "../api/client";
import { authStore } from "../auth/store";
import { readStored, writeStored } from "../lib/safeStorage";
import { useLanguage } from "./LanguageContext";

/**
 * Everything the application writes is translated at build time (en.json / ar.json and the locales/ files). What the
 * *data* says (a homework title, a notice, a student's name, an error text from the server) arrives from the database or
 * the API in whatever language it was typed in. In Arabic mode this component finds such text on screen and replaces it
 * with its Arabic translation (from the server, which caches every translation), and puts the original back when the
 * user switches to English. Parts that are meant to stay in their own language (chat replies, generated papers, textbook
 * notes) opt out with data-no-translate.
 */

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "CODE", "PRE", "INPUT", "TITLE"]);
const ATTRS = ["placeholder", "title", "aria-label", "alt"] as const;
const STORAGE_KEY = "i18n-dyn-ar";
const MAX_CACHE = 3000;
const BATCH = 50;

const LATIN = /[A-Za-z]/g;
function needsTranslation(text: string): boolean {
  const t = text.trim();
  if (t.length < 2 || t.length > 700) return false;
  if ((t.match(LATIN)?.length ?? 0) < 2) return false;
  if (/^[A-Za-z][A-Za-z0-9]*(_[A-Za-z0-9]+)+$/.test(t) && !/\d/.test(t)) return true; // an enum code (UNIT_TEST): shown as words
  if (/^[\w.\-@:/#?&=%+]+$/.test(t) && /[\d@/_:.#]/.test(t)) return false; // an id, e-mail, url or code
  return true;
}

let cache: Record<string, string> = {};
try { cache = JSON.parse(readStored(STORAGE_KEY) ?? "{}"); } catch { cache = {}; }
function remember(src: string, tr: string) {
  cache[src] = tr;
  const keys = Object.keys(cache);
  if (keys.length > MAX_CACHE) for (const k of keys.slice(0, keys.length - MAX_CACHE)) delete cache[k];
  writeStored(STORAGE_KEY, JSON.stringify(cache));
}

/** What is sent for translation: enum codes become plain words ("UNIT_TEST" -> "unit test"). */
const humanise = (core: string) => (/^[A-Za-z][A-Za-z0-9]*(_[A-Za-z0-9]+)+$/.test(core) ? core.replace(/_/g, " ").toLowerCase() : core);

function splitWs(raw: string): [string, string, string] {
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw)!;
  return [m[1], m[2], m[3]];
}

export default function AutoTranslate() {
  const { language } = useLanguage();

  useEffect(() => {
    if (language !== "ar") return;

    const originalText = new WeakMap<Text, string>();
    const writtenText = new WeakMap<Text, string>();
    const originalAttr = new WeakMap<Element, Record<string, string>>();
    const touchedText = new Set<WeakRef<Text>>();
    const touchedEls = new Set<WeakRef<Element>>();
    const pending = new Set<string>();
    let timer: number | undefined;
    let pausedUntil = 0;
    let stopped = false;

    const skipped = (el: Element | null): boolean => {
      for (let e = el; e; e = e.parentElement) {
        if (SKIP_TAGS.has(e.tagName.toUpperCase()) || e.hasAttribute("data-no-translate") || e.getAttribute("contenteditable") === "true") return true;
      }
      return false;
    };

    const applyText = (node: Text) => {
      const current = node.nodeValue ?? "";
      if (writtenText.get(node) === current) return; // our own write
      const [lead, core, trail] = splitWs(current);
      if (!needsTranslation(core)) return;
      const hit = cache[humanise(core)];
      if (hit) {
        originalText.set(node, current);
        writtenText.set(node, lead + hit + trail);
        node.nodeValue = lead + hit + trail;
        touchedText.add(new WeakRef(node));
      } else {
        pending.add(humanise(core));
      }
    };

    const applyAttrs = (el: Element) => {
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (v && / legend icon$/.test(v)) { // added by the chart library, in English
          const o = originalAttr.get(el) ?? {};
          o[a] = o[a] ?? v;
          originalAttr.set(el, o);
          el.setAttribute(a, v.replace(/ legend icon$/, " — مفتاح الرسم البياني"));
          touchedEls.add(new WeakRef(el));
          continue;
        }
        if (!v || !needsTranslation(v)) continue;
        const hit = cache[v.trim()];
        if (hit) {
          const o = originalAttr.get(el) ?? {};
          o[a] = o[a] ?? v;
          originalAttr.set(el, o);
          el.setAttribute(a, hit);
          touchedEls.add(new WeakRef(el));
        } else {
          pending.add(v.trim());
        }
      }
    };

    const scan = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) {
        if (!skipped(root.parentElement)) applyText(root as Text);
        return;
      }
      if (root.nodeType !== Node.ELEMENT_NODE) return;
      const rootEl = root as Element;
      if (skipped(rootEl)) return;
      const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const n = walker.currentNode as Text;
        if (!skipped(n.parentElement)) applyText(n);
      }
      applyAttrs(rootEl);
      rootEl.querySelectorAll("[placeholder],[title],[aria-label],[alt]").forEach((e) => { if (!skipped(e)) applyAttrs(e); });
    };

    const flush = async () => {
      timer = undefined;
      if (stopped || pending.size === 0 || Date.now() < pausedUntil) return;
      if (!authStore.getState().accessToken && !authStore.getState().isDemo) return; // the endpoint needs a signed-in user
      const texts = [...pending].filter((t) => !(t in cache)).slice(0, BATCH);
      texts.forEach((t) => pending.delete(t));
      if (texts.length === 0) return;
      try {
        const { data } = await api.post<{ available: boolean; translations: Record<string, string> }>("/i18n/translate", { texts, target: "ar" });
        if (!data.available) pausedUntil = Date.now() + 5 * 60_000; // the server has no AI key: don't keep asking
        for (const [src, tr] of Object.entries(data.translations ?? {})) remember(src, tr);
      } catch {
        pausedUntil = Date.now() + 30_000;
      }
      if (!stopped) { scan(document.body); if (pending.size > 0) schedule(); }
    };
    const schedule = () => { if (timer === undefined) timer = window.setTimeout(() => void flush(), 150); };

    const observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "childList") r.addedNodes.forEach((n) => scan(n));
        else if (r.type === "characterData") scan(r.target);
        else if (r.type === "attributes" && r.target instanceof Element && !skipped(r.target)) applyAttrs(r.target);
      }
      if (pending.size > 0) schedule();
    });

    scan(document.body);
    if (pending.size > 0) schedule();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });

    return () => {
      stopped = true;
      observer.disconnect();
      if (timer !== undefined) window.clearTimeout(timer);
      // back to the language the data was written in
      for (const ref of touchedText) {
        const n = ref.deref();
        const o = n && originalText.get(n);
        if (n && o !== undefined && n.nodeValue === writtenText.get(n)) n.nodeValue = o;
      }
      for (const ref of touchedEls) {
        const e = ref.deref();
        const o = e && originalAttr.get(e);
        if (e && o) for (const [a, v] of Object.entries(o)) e.setAttribute(a, v);
      }
    };
  }, [language]);

  return null;
}
