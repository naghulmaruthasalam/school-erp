import { useLanguage } from "../i18n/LanguageContext";
import { Globe } from "lucide-react";

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className={`relative inline-flex items-center gap-2 ${className}`}>
      <Globe className="w-4 h-4 text-violet-400" />
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as "en" | "ar")}
        className="appearance-none bg-transparent text-sm font-medium text-white/80 hover:text-white cursor-pointer focus:outline-none pr-6"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a78bfa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right center",
        }}
      >
        <option value="en" className="bg-slate-900 text-white">{t("common.english")}</option>
        <option value="ar" className="bg-slate-900 text-white">{t("common.arabic")}</option>
      </select>
    </div>
  );
}

export function LanguageSwitcherButtons({ className = "" }: { className?: string }) {
  const { language, setLanguage } = useLanguage();

  return (
    <div className={`inline-flex items-center rounded-full p-1 bg-slate-800/50 border border-violet-500/20 ${className}`}>
      <button
        onClick={() => setLanguage("en")}
        className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-300 ${
          language === "en"
            ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg"
            : "text-slate-400 hover:text-white"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLanguage("ar")}
        className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-300 ${
          language === "ar"
            ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-lg"
            : "text-slate-400 hover:text-white"
        }`}
      >
        عربي
      </button>
    </div>
  );
}
