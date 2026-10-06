"""Turn generated Markdown into a saved PDF / text file in the user's Copilot file history."""
from app.copilot import files
from app.copilot.pdf import markdown_doc
from app.core.deps import CurrentUser


async def export_markdown(
    current: CurrentUser, kind: str, title: str, header_lines: list[str], body_markdown: str, export_format: str, meta: dict | None = None
) -> dict:
    """export_format: "pdf" (Chromium render; 503 with a clear message if the server has no Chromium) or "text"."""
    display_title = title.replace("\n", " ").strip() or kind
    if export_format == "pdf":
        data = await markdown_doc.markdown_to_pdf(title, header_lines, body_markdown)
        record = await files.save_generated(current, kind, display_title, data, "pdf", "application/pdf", meta)
    else:
        text = markdown_doc.build_plain_text(title, header_lines, body_markdown)
        record = await files.save_generated(current, kind, display_title, text.encode("utf-8"), "txt", "text/plain", meta)
    return {"step": "finalize", "file": files.file_info(record)}
