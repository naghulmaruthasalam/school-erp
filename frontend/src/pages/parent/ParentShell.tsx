import { Outlet } from "react-router-dom";
import { Spinner } from "../../components/ui";
import { SelectedChildProvider, useSelectedChild } from "./SelectedChildContext";

function ChildSwitcher() {
  const { children: kids, isLoading, selectedChildId, setSelectedChildId } = useSelectedChild();

  if (isLoading) {
    return (
      <div className="mb-6 flex items-center gap-2 text-sm text-accent-fg">
        <Spinner /> Loading your children…
      </div>
    );
  }

  if (kids.length === 0) {
    return (
      <div className="mb-6 rounded-lg border border-dashed border-line p-4 text-sm text-accent-fg">
        No children are linked to your account yet. Contact your school office if this looks wrong.
      </div>
    );
  }

  if (kids.length === 1) {
    return (
      <div className="mb-6">
        <p className="text-sm font-medium text-ink">{kids[0].full_name}</p>
        <p className="text-xs text-accent-fg">Admission No. {kids[0].admission_no}</p>
      </div>
    );
  }

  return (
    <div className="glass mb-6 inline-flex max-w-full flex-wrap gap-1.5 !rounded-[22px] p-1.5">
      {kids.map((kid) => {
        const active = kid.id === selectedChildId;
        return (
          <button
            key={kid.id}
            onClick={() => setSelectedChildId(kid.id)}
            className={`rounded-2xl px-4 py-2 text-sm font-semibold transition-all duration-300 [transition-timing-function:var(--ease)] ${
              active
                ? "bg-gradient-to-br from-accent to-accent-2 text-white shadow-[0_8px_18px_-8px_var(--accent-glow),inset_0_1px_0_rgba(255,255,255,0.4)]"
                : "text-ink-2 hover:bg-surface-3 hover:text-ink"
            }`}
          >
            {kid.full_name}
            <span className={`ml-1.5 text-xs font-medium ${active ? "text-white/80" : "text-ink-3"}`}>
              ({kid.admission_no})
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Wraps every /parent page with the children switcher, then renders the active page below it. */
export default function ParentShell() {
  return (
    <SelectedChildProvider>
      <ChildSwitcher />
      <Outlet />
    </SelectedChildProvider>
  );
}
