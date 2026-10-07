import ReactMarkdown, { type Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";

const components: Components = {
  h1: (p) => <h3 className="mb-1.5 mt-3 text-[15px] font-semibold text-ink first:mt-0" {...p} />,
  h2: (p) => <h3 className="mb-1.5 mt-3 text-[15px] font-semibold text-ink first:mt-0" {...p} />,
  h3: (p) => <h4 className="mb-1 mt-2.5 text-sm font-semibold text-ink first:mt-0" {...p} />,
  h4: (p) => <h5 className="mb-1 mt-2 text-sm font-semibold text-ink-2 first:mt-0" {...p} />,
  p: (p) => <p className="my-1.5 leading-relaxed first:mt-0 last:mb-0" {...p} />,
  ul: (p) => <ul className="my-1.5 list-disc space-y-0.5 ps-5" {...p} />,
  ol: (p) => <ol className="my-1.5 list-decimal space-y-0.5 ps-5" {...p} />,
  li: (p) => <li className="leading-relaxed" {...p} />,
  hr: () => <hr className="my-3 border-line" />,
  a: (p) => <a className="text-accent-fg underline underline-offset-2" target="_blank" rel="noopener noreferrer" {...p} />,
  blockquote: (p) => <blockquote className="my-2 border-s-2 border-accent/50 ps-3 text-ink-2" {...p} />,
  code: (p) => <code className="rounded-md bg-surface-3 px-1 py-0.5 text-[12.5px]" {...p} />,
  pre: (p) => <pre className="my-2 overflow-x-auto rounded-xl bg-surface-3 p-3 text-[12.5px]" {...p} />,
  table: (p) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-[13px]" {...p} />
    </div>
  ),
  th: (p) => <th className="border border-line bg-surface-3 px-2 py-1 text-start font-semibold" {...p} />,
  td: (p) => <td className="border border-line px-2 py-1 align-top" {...p} />,
};

/** Renders model output: GitHub-flavoured Markdown plus KaTeX maths ($x^2$ and $$...$$). Raw HTML is not
 * rendered (react-markdown escapes it), so model output can't inject markup. */
export default function Markdown({ children }: { children: string }) {
  return (
    <div className="copilot-md text-sm text-ink">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
