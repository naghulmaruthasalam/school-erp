import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";

export default function Logo({ size = 32, showWordmark = true, className = "", dark = false }: { size?: number; showWordmark?: boolean; className?: string; dark?: boolean }) {
  const { t } = useLanguage();
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {!imageFailed ? (
        <img
          src={`${import.meta.env.BASE_URL}logo.png`}
          alt={t("shell.brand.name")}
          style={{ height: size, width: "auto" }}
          className="object-contain"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div
          style={{ height: size, width: size }}
          className="flex items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 text-white font-bold shadow-lg shadow-emerald-500/30"
        >
          <span style={{ fontSize: size * 0.5 }}>C</span>
        </div>
      )}
      {showWordmark && (
        <div>
          <span className={`text-sm font-bold ${dark ? 'text-white' : 'text-ink'}`}>{t("shell.brand.name")}</span>
          <span className={`text-xs block ${dark ? 'text-ink-2' : 'text-ink-3'}`}>{t("shell.brand.subtitle")}</span>
        </div>
      )}
    </div>
  );
}
