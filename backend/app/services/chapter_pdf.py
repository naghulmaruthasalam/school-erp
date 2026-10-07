"""A chapter's notes (as stored in the DB) as a readable PDF. Pure reportlab: no browser needed, works offline.

Arabic is shaped (arabic-reshaper) and put in visual order (python-bidi) line by line, so it reads correctly
right-to-left; the bundled DejaVu Sans font has both Latin and Arabic glyphs.
"""
import re
from io import BytesIO
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

FONTS = Path(__file__).resolve().parent.parent / "copilot" / "assets" / "fonts"
_ARABIC = re.compile(r"[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]")
_registered = False


def _fonts() -> None:
    global _registered
    if not _registered:
        pdfmetrics.registerFont(TTFont("Body", str(FONTS / "DejaVuSans.ttf")))
        pdfmetrics.registerFont(TTFont("BodyBold", str(FONTS / "DejaVuSans-Bold.ttf")))
        _registered = True


def _is_rtl(text: str) -> bool:
    letters = [c for c in text if c.isalpha()]
    return bool(letters) and sum(1 for c in letters if _ARABIC.match(c)) / len(letters) > 0.3


def _visual(text: str, rtl: bool) -> str:
    if not _ARABIC.search(text):
        return text
    import arabic_reshaper
    from bidi.algorithm import get_display

    return get_display(arabic_reshaper.reshape(text), base_dir="R" if rtl else "L")


def _blocks(markdown: str) -> list[tuple[str, str]]:
    """Markdown -> (kind, text) blocks: h1/h2/h3, bullet, para, rule. Tables become one line per row."""
    out: list[tuple[str, str]] = []
    para: list[str] = []

    def flush() -> None:
        if para:
            out.append(("para", " ".join(para)))
            para.clear()

    for raw in markdown.replace("\r", "").split("\n"):
        line = raw.strip()
        if not line:
            flush()
            continue
        if re.fullmatch(r"[-*_]{3,}", line):
            flush(); out.append(("rule", "")); continue
        if re.fullmatch(r"\|?[\s:|-]+\|?", line) and "-" in line:
            continue  # table separator row
        m = re.match(r"^(#{1,6})\s+(.*)$", line)
        if m:
            flush(); out.append((f"h{min(len(m.group(1)), 3)}", m.group(2))); continue
        if line.startswith("|"):
            flush(); out.append(("bullet", "  |  ".join(c.strip() for c in line.strip("|").split("|")))); continue
        m = re.match(r"^([-*•]|\d+[.)])\s+(.*)$", line)
        if m:
            flush(); out.append(("bullet", m.group(2))); continue
        para.append(line)
    flush()
    return [(k, re.sub(r"[*_`]{1,3}", "", t) if k != "rule" else t) for k, t in out]


def _wrap(text: str, font: str, size: float, width: float) -> list[str]:
    lines, cur = [], ""
    for word in text.split():
        trial = f"{cur} {word}".strip()
        if cur and pdfmetrics.stringWidth(trial, font, size) > width:
            lines.append(cur)
            cur = word
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines or [""]


def build_chapter_pdf(*, title: str, subtitle: str, description: str | None, topics: list[str], notes: str, topics_label: str) -> bytes:
    _fonts()
    buf = BytesIO()
    page_w, page_h = A4
    margin = 20 * mm
    width = page_w - 2 * margin
    c = canvas.Canvas(buf, pagesize=A4, pageCompression=1)
    c.setTitle(title)
    state = {"y": page_h - margin, "page": 1}

    def footer() -> None:
        c.setFont("Body", 8); c.setFillGray(0.5)
        c.drawCentredString(page_w / 2, 10 * mm, str(state["page"]))
        c.setFillGray(0)

    def new_page() -> None:
        footer(); c.showPage(); state["page"] += 1; state["y"] = page_h - margin

    def draw(text: str, font: str, size: float, leading: float, *, rtl: bool, indent: float = 0, gray: float = 0, gap: float = 0, bullet: bool = False) -> None:
        avail = width - indent
        lines = _wrap(text, font, size, avail - (5 * mm if bullet else 0))
        state["y"] -= gap
        for i, ln in enumerate(lines):
            if state["y"] - leading < margin:
                new_page()
            state["y"] -= leading
            c.setFont(font, size); c.setFillGray(gray)
            shown = _visual(ln, rtl)
            if rtl:
                c.drawRightString(page_w - margin - indent, state["y"], shown)
                if bullet and i == 0:
                    c.drawRightString(page_w - margin - indent + 4.5 * mm, state["y"], "•")
            else:
                c.drawString(margin + indent + (5 * mm if bullet else 0), state["y"], shown)
                if bullet and i == 0:
                    c.drawString(margin + indent, state["y"], "•")
        c.setFillGray(0)

    draw(title, "BodyBold", 18, 24, rtl=_is_rtl(title))
    draw(subtitle, "Body", 10, 15, rtl=_is_rtl(subtitle), gray=0.4)
    if description:
        draw(description, "Body", 11, 16, rtl=_is_rtl(description), gap=4)
    if topics:
        draw(topics_label, "BodyBold", 12, 18, rtl=_is_rtl(topics_label), gap=8)
        for t in topics:
            draw(t, "Body", 11, 16, rtl=_is_rtl(t), indent=2 * mm, bullet=True)
    state["y"] -= 6
    c.setStrokeGray(0.75); c.line(margin, state["y"], page_w - margin, state["y"]); c.setStrokeGray(0)

    for kind, text in _blocks(notes):
        if kind == "rule":
            state["y"] -= 6
            c.setStrokeGray(0.8); c.line(margin, state["y"], page_w - margin, state["y"]); c.setStrokeGray(0)
        elif kind.startswith("h"):
            size = {"h1": 15, "h2": 13, "h3": 12}[kind]
            draw(text, "BodyBold", size, size + 6, rtl=_is_rtl(text), gap=10)
        elif kind == "bullet":
            draw(text, "Body", 11, 16, rtl=_is_rtl(text), indent=2 * mm, gap=1, bullet=True)
        else:
            draw(text, "Body", 11, 16, rtl=_is_rtl(text), gap=5)
    footer()
    c.save()
    return buf.getvalue()
