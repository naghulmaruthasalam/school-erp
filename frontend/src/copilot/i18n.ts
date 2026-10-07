import { useLanguage } from "../i18n/LanguageContext";
import { errorMessage, type CopilotProfile, type ToolField, type ToolSpec } from "./api";

/** "meeting request" -> "meeting_request": server-provided strings are looked up in the locale files by this key. */
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

/** Translates the pieces of the Copilot UI that the server sends as English text (tool titles, field labels, option
 * names, profile titles, starter prompts). Anything without a translation falls back to what the server sent, so a
 * new tool or option still renders. Only the DISPLAY changes: values sent to the server are never touched. */
export function useCopilotText() {
  const { t, te, fmtDate, fmtNumber, language, dir } = useLanguage();
  const tr = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };
  return {
    t, te, fmtDate, fmtNumber, language, dir, tr,
    toolTitle: (tool: ToolSpec) => tr(`copilot.tools.${tool.key}.title`, tool.title),
    toolDescription: (tool: ToolSpec) => tr(`copilot.tools.${tool.key}.description`, tool.description),
    fieldLabel: (tool: ToolSpec, f: ToolField) => tr(`copilot.tools.${tool.key}.fields.${f.name}.label`, f.label),
    fieldHelp: (tool: ToolSpec, f: ToolField) => (f.help ? tr(`copilot.tools.${tool.key}.fields.${f.name}.help`, f.help) : undefined),
    optionLabel: (tool: ToolSpec, f: ToolField, o: string) => tr(`copilot.tools.${tool.key}.options.${f.name}.${slug(o)}`, o),
    profileTitle: (p: CopilotProfile) => tr(`copilot.profiles.${p.role}.title`, p.title),
    profileTagline: (p: CopilotProfile) => tr(`copilot.profiles.${p.role}.tagline`, p.tagline),
    quick: (q: string) => tr(`copilot.quick.${slug(q)}`, q),
    languageName: (l: string) => tr(`copilot.languages.${l}`, l),
    questionType: (key: string) => tr(`copilot.qtypes.${key}`, key.replace(/_/g, " ")),
    /** Error text for the UI: the server's own explanation when it sent one, otherwise a translated generic message. */
    err: (e: unknown, fallback?: string) => {
      const detail = (e as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
      if (typeof detail !== "string" && (e as { message?: string })?.message === "Network Error") return t("copilot.errors.network");
      return errorMessage(e, fallback ?? t("copilot.errors.generic"));
    },
  };
}
