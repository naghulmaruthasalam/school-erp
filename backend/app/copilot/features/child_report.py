"""Plain-language progress summary of a parent's child, with ideas for supporting them at home."""
from datetime import date, timedelta

from pydantic import BaseModel, Field

from app.copilot import llm
from app.copilot.features import erp_data
from app.copilot.features.base import Feature, field_spec
from app.core.exceptions import ValidationAppError


class ChildReportParams(BaseModel):
    student_id: str | None = None
    days: int = Field(default=30, ge=7, le=120)
    language: str = "English"


def _items(value, limit=10):
    if isinstance(value, dict):
        value = value.get("items", value.get("results", []))
    return list(value or [])[:limit]


async def run(current, ctx, params: dict) -> dict:
    p = ChildReportParams(**params)
    children = await erp_data.call(current, "list_my_children") or []
    if not children:
        raise ValidationAppError("No child is linked to your account yet")
    if p.student_id:
        child = next((c for c in children if c["id"] == p.student_id), None)
        if child is None:
            raise ValidationAppError("That child is not linked to your account")
    elif len(children) == 1:
        child = children[0]
    else:
        raise ValidationAppError("Choose which child the report is for")

    sid = child["id"]
    date_from = (date.today() - timedelta(days=p.days)).isoformat()
    attendance = await erp_data.call(current, "get_child_attendance", {"student_id": sid, "date_from": date_from})
    homework = _items(await erp_data.call(current, "get_child_pending_homework", {"student_id": sid}))
    fees = _items(await erp_data.call(current, "get_child_fees", {"student_id": sid}))
    results = []
    for exam in _items(await erp_data.call(current, "list_exams"), 5):
        result = await erp_data.call(current, "get_child_exam_result", {"student_id": sid, "exam_id": exam["id"]})
        if result:
            results.append({"exam": exam.get("name"), "result": result})

    facts = {
        "child": f"{child.get('first_name', '')} {child.get('last_name', '')}".strip(),
        "pending_homework": len(homework),
        "invoices": len(fees),
        "exams_with_results": len(results),
    }
    system = (
        "You are Parent Companion. Write a clear, kind progress summary for a parent from the data given, in "
        "plain language. Sections: **How things look** (attendance, homework, results), **What's going well**, "
        "**Where to help**, and **Simple ways to support at home this week** (3 concrete, small ideas). Mention "
        "fees only if something is outstanding. Use ONLY the data provided; if a section has no data, say so "
        f"instead of guessing. Never compare with other children. Write in {p.language}. Use Markdown."
    )
    user = (
        f"Child: {facts['child']} (class id {child.get('class_id')})\nPeriod: last {p.days} days\n"
        f"Attendance summary: {attendance}\nPending homework: {homework}\nInvoices: {fees}\nExam results: {results}"
    )
    return {"title": f"Progress summary: {facts['child']}", "facts": facts, "content": await llm.call_text(system, user)}


FEATURE = Feature(
    key="child_report",
    title="Child progress summary",
    description="Attendance, homework, results and fees explained simply, with tips to help at home.",
    icon="HeartHandshake",
    handler=run,
    fields=[
        field_spec("student_id", "Child", "child"),
        field_spec("days", "Period (days)", "number", default=30, min=7, max=120),
    ],
)
