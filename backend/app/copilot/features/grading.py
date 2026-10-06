"""Grade answer sheets (dedicated endpoints: see app/api/v1/copilot_grading.py)."""
from app.copilot.features.base import Feature
from app.core.exceptions import NotFoundError


async def run(current, ctx, params: dict) -> dict:
    raise NotFoundError("This tool has its own endpoints")


FEATURE = Feature(
    key="grading",
    title="Grade answer sheets",
    description="Upload scanned or photographed answer sheets and get marks, feedback and a report against a question paper you generated.",
    icon="ClipboardCheck",
    handler=run,
    dedicated=True,
)
