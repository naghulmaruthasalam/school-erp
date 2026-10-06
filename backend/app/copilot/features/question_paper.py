"""Question paper (dedicated endpoints: see app/api/v1/copilot_qpg.py)."""
from app.copilot.features.base import Feature
from app.core.exceptions import NotFoundError


async def run(current, ctx, params: dict) -> dict:
    raise NotFoundError("This tool has its own endpoints")


FEATURE = Feature(
    key="question_paper",
    title="Question paper",
    description="Build a question paper from your question bank with marks per chapter, then export the paper and answer key as PDF.",
    icon="FileQuestion",
    handler=run,
    dedicated=True,
)
