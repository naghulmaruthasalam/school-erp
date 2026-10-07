import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import type { Student } from "./types";
import { useMyChildren } from "./hooks";

interface SelectedChildContextValue {
  children: Student[];
  isLoading: boolean;
  error: unknown;
  selectedChild: Student | null;
  selectedChildId: string | null;
  setSelectedChildId: (id: string) => void;
}

const SelectedChildContext = createContext<SelectedChildContextValue | null>(null);

/**
 * Fetches the parent's children once and tracks which one is currently
 * selected via the `?child=<id>` URL param, so the choice survives
 * navigation between the dashboard/attendance/homework/exams/fees pages.
 */
export function SelectedChildProvider({ children: node }: { children: ReactNode }) {
  const { data: kids = [], isLoading, error } = useMyChildren();
  const [searchParams, setSearchParams] = useSearchParams();

  const childParam = searchParams.get("child");
  const selectedChild = useMemo(
    () => kids.find((k) => k.id === childParam) ?? kids[0] ?? null,
    [kids, childParam],
  );

  // Once children load, make sure the URL reflects a valid selection.
  useEffect(() => {
    if (!isLoading && kids.length > 0 && (!childParam || !kids.some((k) => k.id === childParam))) {
      const next = new URLSearchParams(searchParams);
      next.set("child", kids[0].id);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, kids, childParam]);

  const setSelectedChildId = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("child", id);
    setSearchParams(next);
  };

  const value: SelectedChildContextValue = {
    children: kids,
    isLoading,
    error,
    selectedChild,
    selectedChildId: selectedChild?.id ?? null,
    setSelectedChildId,
  };

  return <SelectedChildContext.Provider value={value}>{node}</SelectedChildContext.Provider>;
}

export function useSelectedChild(): SelectedChildContextValue {
  const ctx = useContext(SelectedChildContext);
  if (!ctx) throw new Error("useSelectedChild must be used within SelectedChildProvider");
  return ctx;
}
