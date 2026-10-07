import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { readStored, writeStored } from "../lib/safeStorage";
import en from "./en.json";
import ar from "./ar.json";
import { entityLabel, type EntityKind } from "./entities";

export type Language = "en" | "ar";
type Dict = Record<string, unknown>;
export type TVars = Record<string, string | number | null | undefined>;

/** Page-level dictionaries live in ./locales/<area>.en.json and <area>.ar.json and are merged into the base ones. */
function collect(files: Record<string, { default: Dict }>, suffix: string): Dict[] {
  return Object.entries(files)
    .filter(([path]) => path.endsWith(suffix))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, mod]) => mod.default);
}

function merge(target: Dict, source: Dict): Dict {
  for (const [k, v] of Object.entries(source)) {
    const cur = target[k];
    if (v && typeof v === "object" && !Array.isArray(v) && cur && typeof cur === "object") merge(cur as Dict, v as Dict);
    else target[k] = v && typeof v === "object" && !Array.isArray(v) ? merge({}, v as Dict) : v;
  }
  return target;
}

const localeFiles = import.meta.glob("./locales/*.json", { eager: true }) as Record<string, { default: Dict }>;
const translations: Record<Language, Dict> = {
  en: collect(localeFiles, ".en.json").reduce((acc, d) => merge(acc, d), merge({}, en as Dict)),
  ar: collect(localeFiles, ".ar.json").reduce((acc, d) => merge(acc, d), merge({}, ar as Dict)),
};

function lookup(dict: Dict, key: string): string | undefined {
  let value: unknown = dict;
  for (const k of key.split(".")) {
    if (value && typeof value === "object" && k in (value as Dict)) value = (value as Dict)[k];
    else return undefined;
  }
  return typeof value === "string" ? value : undefined;
}

export function translate(language: Language, key: string, vars?: TVars): string {
  // Arabic falls back to English (never to the raw key) so a missing translation is readable, not a bug report.
  const raw = lookup(translations[language], key) ?? lookup(translations.en, key) ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? (vars[name] == null ? "—" : String(vars[name])) : m)) : raw;
}

/** Current language for code that runs outside React (axios interceptors, query functions). */
export function currentLanguage(): Language {
  return readStored("language") === "ar" ? "ar" : "en";
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  /** Translate a key; `{name}` placeholders are filled from `vars`. */
  t: (key: string, vars?: TVars) => string;
  /** Translate a value that comes from the database: a subject, class, section, status, role, month... */
  te: (kind: EntityKind, value: string | null | undefined) => string;
  /** Locale-aware date / number formatting (Latin digits in both languages, as the school's books use). */
  fmtDate: (value: string | number | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) => string;
  fmtNumber: (value: number, opts?: Intl.NumberFormatOptions) => string;
  dir: "ltr" | "rtl";
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(currentLanguage);

  const setLanguage = useCallback((lang: Language) => {
    writeStored("language", lang);  // first, so the Accept-Language header of the refetches below is already the new one
    setLanguageState(lang);
    window.dispatchEvent(new CustomEvent("language:changed", { detail: lang }));
  }, []);

  const dir = language === "ar" ? "rtl" : "ltr";
  const locale = language === "ar" ? "ar-OM-u-nu-latn" : "en-GB";

  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = language;
    document.title = translate(language, "landing.title");  // the browser tab too
  }, [language, dir]);

  const value = useMemo<LanguageContextType>(
    () => ({
      language,
      setLanguage,
      dir,
      t: (key, vars) => translate(language, key, vars),
      te: (kind, v) => entityLabel(language, kind, v),
      fmtDate: (v, opts) => {
        if (v == null || v === "") return "—";
        const d = v instanceof Date ? v : new Date(v);
        return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString(locale, opts ?? { day: "numeric", month: "short", year: "numeric" });
      },
      fmtNumber: (n, opts) => n.toLocaleString(locale, opts),
    }),
    [language, setLanguage, dir, locale],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
