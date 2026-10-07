import { useMemo } from "react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const rendered = useMemo(() => {
    if (!content) return "";

    let html = content
      // Escape HTML
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")

      // Headers
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold text-ink dark:text-white mt-6 mb-3 border-b border-line pb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-ink dark:text-white mt-6 mb-3 border-b-2 border-violet-500 pb-2">$2</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-ink dark:text-white mt-6 mb-4">$1</h1>')

      // Bold and italic
      .replace(/\*\*\*(.+?)\*\*\*/g, '<strong class="font-bold italic text-ink dark:text-white">$1</strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-ink dark:text-white">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')

      // Horizontal rule
      .replace(/^---$/gm, '<hr class="my-4 border-t border-line" />')

      // LaTeX math (convert to styled spans)
      .replace(/\$([^$]+)\$/g, '<code class="px-2 py-1 mx-1 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded font-mono text-sm">$1</code>')

      // Numbered lists
      .replace(/^(\d+)\.\s+(.+)$/gm, '<div class="flex gap-3 mb-2"><span class="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white text-sm font-medium flex items-center justify-center">$1</span><span class="flex-1 pt-0.5">$2</span></div>')

      // Bullet points
      .replace(/^[-•]\s+(.+)$/gm, '<div class="flex gap-3 mb-2"><span class="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-violet-500"></span><span class="flex-1">$1</span></div>')

      // Code blocks
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded-xl my-4 overflow-x-auto"><code class="text-sm font-mono">$2</code></pre>')

      // Inline code
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono">$1</code>')

      // Line breaks (preserve paragraphs)
      .replace(/\n\n/g, '</p><p class="mb-4">')
      .replace(/\n/g, '<br />');

    // Wrap in paragraph if not already
    if (!html.startsWith('<')) {
      html = `<p class="mb-4">${html}</p>`;
    }

    return html;
  }, [content]);

  return (
    <div
      className={`prose prose-sm dark:prose-invert max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}

interface DocumentSheetProps {
  title: string;
  subtitle?: string;
  metadata?: { label: string; value: string }[];
  content: string;
  type?: "lesson-plan" | "question-paper" | "worksheet" | "homework";
}

export function DocumentSheet({ title, subtitle, metadata, content, type = "worksheet" }: DocumentSheetProps) {
  const colorMap = {
    "lesson-plan": { gradient: "from-violet-500 to-purple-600", bg: "bg-violet-50 dark:bg-violet-900/20", border: "border-violet-200 dark:border-violet-800" },
    "question-paper": { gradient: "from-blue-500 to-cyan-500", bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800" },
    "worksheet": { gradient: "from-emerald-500 to-teal-500", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800" },
    "homework": { gradient: "from-amber-500 to-orange-500", bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800" },
  };

  const colors = colorMap[type];

  return (
    <div className={`rounded-2xl border-2 ${colors.border} overflow-hidden shadow-lg`}>
      {/* Header */}
      <div className={`bg-gradient-to-r ${colors.gradient} text-white p-6`}>
        <h2 className="text-2xl font-bold mb-1">{title}</h2>
        {subtitle && <p className="text-white/80">{subtitle}</p>}
      </div>

      {/* Metadata */}
      {metadata && metadata.length > 0 && (
        <div className={`${colors.bg} px-6 py-4 border-b ${colors.border}`}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {metadata.map((item, i) => (
              <div key={i}>
                <p className="text-xs font-medium text-ink-3 uppercase tracking-wide">{item.label}</p>
                <p className="text-sm font-semibold text-ink dark:text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-6 bg-white dark:bg-surface">
        <MarkdownRenderer content={content} />
      </div>
    </div>
  );
}
