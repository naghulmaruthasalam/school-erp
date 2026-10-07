import { NavLink } from "react-router-dom";
import { useLanguage } from "../../../i18n/LanguageContext";

const LINKS = [
  { to: "/admin/fees", labelKey: "admin.nav.overview", end: true },
  { to: "/admin/fees/manage", labelKey: "admin.nav.assignInvoice", end: true },
  { to: "/admin/fees/structures", labelKey: "admin.nav.structures", end: true },
  { to: "/admin/fees/categories", labelKey: "admin.nav.categories", end: true },
];

/** Sub-navigation shared by every fee page so the fee setup/billing screens are reachable from the sidebar's "Fee Overview". */
export default function FeesNav() {
  const { t } = useLanguage();
  return (
    <nav className="mb-6 flex flex-wrap gap-2" aria-label={t("admin.nav.feeSections")}>
      {LINKS.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.end}
          className={({ isActive }) =>
            `rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              isActive ? "bg-violet-600 text-white shadow-lg shadow-violet-500/30" : "bg-surface text-ink-2 hover:bg-violet-50"
            }`
          }
        >
          {t(l.labelKey)}
        </NavLink>
      ))}
    </nav>
  );
}
