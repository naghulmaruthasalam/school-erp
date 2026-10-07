import { currentLanguage, translate } from "../i18n/LanguageContext";

/** "just now", "5m ago", "3h ago", "2d ago", then a short date (in the current language). */
export function timeAgo(iso: string, now = new Date()): string {
  const lang = currentLanguage();
  const then = new Date(iso);
  const seconds = Math.max(0, Math.round((now.getTime() - then.getTime()) / 1000));
  if (seconds < 60) return translate(lang, "admin.time.justNow");
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return translate(lang, "admin.time.minutesAgo", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return translate(lang, "admin.time.hoursAgo", { n: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return translate(lang, "admin.time.daysAgo", { n: days });
  return then.toLocaleDateString(lang === "ar" ? "ar-OM-u-nu-latn" : "en-IN", { day: "numeric", month: "short" });
}
