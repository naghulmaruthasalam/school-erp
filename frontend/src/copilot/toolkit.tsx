import { ArrowLeft, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import type { ToolSpec } from "./api";

/** Title bar + back link shared by the tool panels in the Copilot widget. */
export function Shell({ tool, onBack, children }: { tool: ToolSpec; onBack: () => void; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-fg">
        <ArrowLeft size={14} className="rtl:rotate-180" /> All tools
      </button>
      <div>
        <h3 className="text-[15px] font-semibold text-ink">{tool.title}</h3>
        <p className="text-[13px] text-ink-3">{tool.description}</p>
      </div>
      {children}
    </div>
  );
}

export function Busy({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 text-[13px] text-ink-3">
      <Loader2 size={14} className="animate-spin" /> {label}
    </p>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="space-y-2 rounded-2xl bg-surface-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-ink">{title}</p>
        {right}
      </div>
      {children}
    </div>
  );
}
