import type { ToolProps } from "./ToolRunner";

/** Placeholder: replaced by the real panel in this port. */
export default function GradingTool({ tool, onBack }: ToolProps) {
  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="text-[13px] font-medium text-accent-fg">All tools</button>
      <p className="text-[13px] text-ink-3">{tool.title} is coming up.</p>
    </div>
  );
}
