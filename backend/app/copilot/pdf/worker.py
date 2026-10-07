"""Standalone worker: prints one HTML file to PDF with headless Chromium.

Runs as its own process (never imported into the API) because Playwright's sync API needs its own event loop /
subprocess support, and a crash or leak in Chromium must never take the API down.
Usage: python worker.py <input.html> <output.pdf> [--no-footer]
Set COPILOT_CHROMIUM_PATH to use a specific Chromium/Chrome binary instead of Playwright's own download.
"""
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

FOOTER = (
    "<div style=\"width:100%; font-size:8.5px; text-align:center; color:#666; "
    "font-family: Georgia, 'Times New Roman', serif;\">Page <span class=\"pageNumber\"></span></div>"
)


def main() -> None:
    html_path, pdf_path = sys.argv[1], sys.argv[2]
    footer = "--no-footer" not in sys.argv[3:]
    launch_args = {"args": ["--disable-dev-shm-usage", "--no-sandbox"]}  # small /dev/shm in containers; non-root user
    if os.environ.get("COPILOT_CHROMIUM_PATH"):
        launch_args["executable_path"] = os.environ["COPILOT_CHROMIUM_PATH"]
    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_args)
        try:
            page = browser.new_page()
            page.goto(Path(html_path).resolve().as_uri(), wait_until="load")
            page.evaluate("document.fonts.ready")
            page.pdf(
                path=pdf_path,
                format="A4",
                margin={"top": "15mm", "bottom": "15mm", "left": "16mm", "right": "16mm"},
                print_background=True,
                display_header_footer=footer,
                header_template="<span></span>",
                footer_template=FOOTER if footer else "<span></span>",
            )
        finally:
            browser.close()


if __name__ == "__main__":
    main()
