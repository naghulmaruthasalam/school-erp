"""Render an HTML string to PDF bytes via the Chromium worker (see worker.py)."""
import asyncio
import importlib.util
import logging
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from app.core.exceptions import AppError

logger = logging.getLogger("copilot.pdf")

ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"
KATEX_DIR = ASSETS_DIR / "katex"
FONTS_DIR = ASSETS_DIR / "fonts"
WORKER = Path(__file__).resolve().parent / "worker.py"
RENDER_TIMEOUT_SECONDS = 90


class PdfUnavailable(AppError):
    def __init__(self, detail: str = "PDF export is not available on this server. Use Print / PDF from your browser instead."):
        super().__init__(503, detail)


def file_url(path: Path | str) -> str:
    return Path(path).resolve().as_uri()


def katex_css_url() -> str:
    return file_url(KATEX_DIR / "katex.min.css")


def katex_script_tags() -> str:
    """Typesets $...$ and $$...$$ maths in the page before it is printed."""
    return (
        f'<script src="{file_url(KATEX_DIR / "katex.min.js")}"></script>'
        f'<script src="{file_url(KATEX_DIR / "auto-render.min.js")}"></script>'
        "<script>renderMathInElement(document.body,{delimiters:["
        '{left:"$$",right:"$$",display:true},{left:"\\\\[",right:"\\\\]",display:true},'
        '{left:"\\\\(",right:"\\\\)",display:false},{left:"$",right:"$",display:false}],throwOnError:false});</script>'
    )


def font_face_css() -> str:
    def u(name: str) -> str:
        return file_url(FONTS_DIR / name)

    return f"""
@font-face {{ font-family: "Source Serif 4"; font-style: normal; font-weight: 400; src: url("{u('SourceSerif4-Regular.ttf')}") format("truetype"); }}
@font-face {{ font-family: "Source Serif 4"; font-style: italic; font-weight: 400; src: url("{u('SourceSerif4-Italic.ttf')}") format("truetype"); }}
@font-face {{ font-family: "Source Serif 4"; font-style: normal; font-weight: 600; src: url("{u('SourceSerif4-SemiBold.ttf')}") format("truetype"); }}
@font-face {{ font-family: "Source Serif 4"; font-style: normal; font-weight: 700; src: url("{u('SourceSerif4-Bold.ttf')}") format("truetype"); }}
@font-face {{ font-family: "Noto Sans Devanagari"; src: url("{u('NotoSansDevanagari-Regular.ttf')}") format("truetype"); }}
@font-face {{ font-family: "Noto Sans Tamil"; src: url("{u('NotoSansTamil-Regular.ttf')}") format("truetype"); }}
@font-face {{ font-family: "Noto Sans"; src: url("{u('NotoSans-Regular.ttf')}") format("truetype"); }}
"""


def chromium_path() -> str | None:
    """COPILOT_CHROMIUM_PATH from backend/.env (settings) or the process environment."""
    from app.core.config import get_settings

    return get_settings().copilot_chromium_path or os.environ.get("COPILOT_CHROMIUM_PATH") or None


def is_available() -> bool:
    """Playwright is importable and a browser is configured (COPILOT_CHROMIUM_PATH or Playwright's own)."""
    if importlib.util.find_spec("playwright") is None:
        return False
    custom = chromium_path()
    return Path(custom).exists() if custom else True  # Playwright's own browser is checked when rendering


def _render_blocking(html: str, footer: bool) -> bytes:
    with tempfile.TemporaryDirectory(prefix="copilot_pdf_") as tmp:
        html_path, pdf_path = Path(tmp) / "doc.html", Path(tmp) / "doc.pdf"
        html_path.write_text(html, encoding="utf-8")
        cmd = [sys.executable, str(WORKER), str(html_path), str(pdf_path)] + ([] if footer else ["--no-footer"])
        try:
            env = {**os.environ, **({"COPILOT_CHROMIUM_PATH": chromium_path()} if chromium_path() else {})}
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=RENDER_TIMEOUT_SECONDS, env=env)
        except subprocess.TimeoutExpired as exc:
            raise AppError(504, "PDF rendering timed out. Please try again.") from exc
        if result.returncode != 0:
            logger.error("PDF worker failed: %s", result.stderr[-800:])
            if "Executable doesn't exist" in result.stderr or "playwright install" in result.stderr:
                raise PdfUnavailable("PDF export is not set up on this server (Chromium is not installed).")
            raise AppError(502, "PDF rendering failed. Please try again.")
        return pdf_path.read_bytes()


async def html_to_pdf_bytes(html: str, *, footer: bool = True) -> bytes:
    """Print an HTML document (use file:// URLs for assets, see helpers above) to PDF."""
    if not is_available():
        raise PdfUnavailable()
    return await asyncio.to_thread(_render_blocking, html, footer)
