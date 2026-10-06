import { Outlet } from "react-router-dom";
import { Spinner } from "../../components/ui";
import { SelectedChildProvider, useSelectedChild } from "./SelectedChildContext";

function ChildSwitcher() {
  const { children: kids, isLoading, selectedChildId, setSelectedChildId } = useSelectedChild();

  if (isLoading) {
    return (
      <div className="mb-6 flex items-center gap-2 text-sm text-violet-600">
        <Spinner /> Loading your children…
      </div>
    );
  }

  if (kids.length === 0) {
    return (
      <div className="mb-6 rounded-lg border border-dashed border-violet-300 p-4 text-sm text-violet-600">
        No children are linked to your account yet. Contact your school office if this looks wrong.
      </div>
    );
  }

  if (kids.length === 1) {
    return (
      <div className="mb-6">
        <p className="text-sm font-medium text-violet-900">{kids[0].full_name}</p>
        <p className="text-xs text-violet-600">Admission No. {kids[0].admission_no}</p>
      </div>
    );
  }

  return (
    <div className="mb-6 flex flex-wrap gap-2 border-b border-violet-200 pb-4">
      {kids.map((kid) => {
        const active = kid.id === selectedChildId;
        return (
          <button
            key={kid.id}
            onClick={() => setSelectedChildId(kid.id)}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-violet-600 text-white" : "bg-white text-violet-700 border border-violet-300 hover:bg-violet-50"
            }`}
          >
            {kid.full_name}
            <span className={`ml-1.5 text-xs ${active ? "text-indigo-100" : "text-violet-400"}`}>
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
