"""Markdown (LLM output) -> a typeset PDF / plain-text document (worksheets, lesson plans).
Ported from Skillorea's content_common/markdown_pdf_renderer.py: headings, lists, tables and KaTeX maths are
typeset properly, fill-in-the-blank runs ("_____") are preserved, and the HTML is sanitised before Chromium loads it."""
import html
import re

import markdown as md
import nh3

from app.copilot.pdf import render

_ALLOWED_TAGS = {
    "p", "br", "hr", "strong", "b", "em", "i", "u", "s", "sub", "sup", "ul", "ol", "li", "h1", "h2", "h3", "h4",
    "h5", "h6", "table", "thead", "tbody", "tr", "th", "td", "code", "pre", "blockquote", "div", "span",
}

_PAGE_CSS = """
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: "Source Serif 4", "Noto Sans Devanagari", "Noto Sans Tamil", "Noto Sans", serif; font-size: 11.5pt; line-height: 1.4; color: #111; }
.title { font-size: 15pt; font-weight: 700; text-align: center; white-space: pre-line; margin: 0 0 3mm; }
.header-block { font-size: 10.5pt; margin: 0 0 3mm; }
.header-block div { white-space: pre-wrap; margin: 0.8mm 0; }
hr.divider { border: none; border-top: 0.9pt solid #999; margin: 0 0 5mm; }
hr { border: none; border-top: 0.75pt solid #ccc; margin: 5mm 0; }
h1 { font-size: 13pt; font-weight: 700; margin: 6mm 0 3mm; } h2 { font-size: 12pt; font-weight: 700; margin: 6mm 0 3mm; }
h3 { font-size: 11pt; font-weight: 600; margin: 5mm 0 2.5mm; }
p { margin: 0 0 3mm; white-space: pre-line; } strong { font-weight: 700; } em { font-style: italic; }
ul, ol { margin: 0 0 3mm; padding-left: 7mm; } li { margin: 1.5mm 0; }
table { border-collapse: collapse; margin: 3mm 0; width: 100%; break-inside: avoid; }
table th, table td { border: 0.75pt solid #cfcfcf; padding: 1.5mm 2.5mm; font-size: 10.5pt; }
code { font-family: "Courier New", monospace; background: #f2f2f2; padding: 0 1mm; }
.katex-display { margin: 2.5mm 0; }
"""

# Private-use characters wrapping a protected blank's length while the text goes through the markdown parser:
# python-markdown would otherwise read "_____" as emphasis and shrink a blank to one tiny dash.
_OPEN, _CLOSE = "", ""
_BLANK_RUN = re.compile(r"_{3,}")
_BLANK_TOKEN = re.compile(f"{_OPEN}(\\d+){_CLOSE}")
_RULE = re.compile(r"^ {0,3}(_ *){3,}$")


def _protect_blanks(text: str) -> str:
    text = text.replace(_OPEN, "").replace(_CLOSE, "")
    return "\n".join(
        line if _RULE.match(line) else _BLANK_RUN.sub(lambda m: f"{_OPEN}{len(m.group())}{_CLOSE}", line)
        for line in text.split("\n")
    )


def markdown_to_html_body(markdown_text: str) -> str:
    body = md.markdown(_protect_blanks(markdown_text), extensions=["extra", "sane_lists", "nl2br"])
    body = nh3.clean(body, tags=_ALLOWED_TAGS, attributes={}, link_rel=None)
    return _BLANK_TOKEN.sub(lambda m: "_" * int(m.group(1)), body)


def build_html(title: str, header_lines: list[str], body_markdown: str) -> str:
    header = "".join(f"<div>{html.escape(line)}</div>" for line in header_lines)
    return f"""<!doctype html><html><head><meta charset="utf-8" />
<link rel="stylesheet" href="{render.katex_css_url()}" />
<style>{render.font_face_css()}{_PAGE_CSS}</style></head>
<body><div class="title">{html.escape(title)}</div><div class="header-block">{header}</div><hr class="divider" />
{markdown_to_html_body(body_markdown)}{render.katex_script_tags()}</body></html>"""


async def markdown_to_pdf(title: str, header_lines: list[str], body_markdown: str) -> bytes:
    return await render.html_to_pdf_bytes(build_html(title, header_lines, body_markdown))


def build_plain_text(title: str, header_lines: list[str], body: str) -> str:
    parts = [title, ""]
    if header_lines:
        parts.extend(header_lines)
        parts.append("")
    parts.append(body)
    return "\n".join(parts)
