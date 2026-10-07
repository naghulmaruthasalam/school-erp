import { NavLink } from "react-router-dom";

const LINKS = [
  { to: "/admin/fees", label: "Overview", end: true },
  { to: "/admin/fees/manage", label: "Assign & Invoice", end: true },
  { to: "/admin/fees/structures", label: "Structures", end: true },
  { to: "/admin/fees/categories", label: "Categories", end: true },
];

/** Sub-navigation shared by every fee page so the fee setup/billing screens are reachable from the sidebar's "Fee Overview". */
export default function FeesNav() {
  return (
    <nav className="mb-6 flex flex-wrap gap-2" aria-label="Fee sections">
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
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
}
