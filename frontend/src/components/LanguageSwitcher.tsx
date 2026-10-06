import { useLanguage } from "../i18n/LanguageContext";
import { Globe } from "lucide-react";

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className={`relative inline-flex items-center gap-2 ${className}`}>
      <Globe className="w-4 h-4 text-ink-3" />
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as "en" | "ar")}
        className="appearance-none bg-transparent text-sm font-medium text-ink-2 hover:text-ink cursor-pointer focus:outline-none pr-6"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a78bfa' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right center",
        }}
      >
        <option value="en" >{t("common.english")}</option>
        <option value="ar" >{t("common.arabic")}</option>
      </select>
    </div>
  );
}

export function LanguageSwitcherButtons({ className = "" }: { className?: string }) {
  const { language, setLanguage } = useLanguage();

  return (
    <div className={`lg-seg ${className}`}>
      <button aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button>
      <button aria-pressed={language === "ar"} onClick={() => setLanguage("ar")}>عربي</button>
    </div>
  );
}
