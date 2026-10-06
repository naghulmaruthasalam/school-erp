import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def build_simple_pdf(
    *,
    school_name: str,
    document_title: str,
    meta: dict[str, str],
    table_headers: list[str],
    table_rows: list[list[str]],
    footer_lines: list[str] | None = None,
) -> bytes:
    """Renders a header (school name + document title), a key/value meta
    block, a data table, and optional footer lines. Used for report cards and
    fee receipts so both share one look."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph(school_name, styles["Title"]))
    story.append(Paragraph(document_title, styles["Heading2"]))
    story.append(Spacer(1, 8))

    if meta:
        meta_rows = [[f"{k}:", v] for k, v in meta.items()]
        meta_table = Table(meta_rows, colWidths=[45 * mm, 120 * mm])
        meta_table.setStyle(
            TableStyle(
                [
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("TEXTCOLOR", (0, 0), (0, -1), colors.grey),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ]
            )
        )
        story.append(meta_table)
        story.append(Spacer(1, 12))

    if table_headers:
        data = [table_headers] + table_rows
        data_table = Table(data, repeatRows=1)
        data_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(data_table)

    if footer_lines:
        story.append(Spacer(1, 16))
        for line in footer_lines:
            story.append(Paragraph(line, styles["Normal"]))

    doc.build(story)
    return buffer.getvalue()
