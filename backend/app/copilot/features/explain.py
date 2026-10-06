"""Re-explain a chapter or a term in the way the user asks for: simple words, a story, an analogy, examples..."""
from typing import Literal

from pydantic import BaseModel, Field

from app.copilot import llm
from app.copilot.features.base import Feature, field_spec

STYLES = {
    "simple": "plain, simple words and short sentences, no jargon (explain any technical term the first time it appears)",
    "story": "a short, vivid story with characters that carries the idea; end with a one-line takeaway of what the story shows",
    "analogy": "one or two everyday analogies, and say clearly where the analogy stops working",
    "example": "two or three real-life examples from a child's world (home, school, food, sports, nature)",
    "worked": "worked examples: a solved example for each key idea with every step shown, then one for the learner to try",
    "steps": "a numbered step-by-step walk-through from the basics to the full idea",
    "memory": "memory tricks: a mnemonic or rhyme, a mental picture and a quick self-test",
}


class ExplainParams(BaseModel):
    style: Literal["simple", "story", "analogy", "example", "worked", "steps", "memory"] = "simple"
    concept: str = Field(default="", max_length=300)
    language: str = "English"


async def run(current, ctx, params: dict) -> dict:
    p = ExplainParams(**params)
    audience = {
        "PARENT": "a parent who may not know the subject and wants to explain it to their child",
        "TEACHER": "a teacher looking for a fresh way to explain it to the class",
    }.get(current.role.value, f"a {ctx.class_name} student")
    target = p.concept.strip() or ctx.chapter or f"the main ideas of {ctx.subject_name}"
    system = (
        f"You explain school topics. The audience is {audience}. Explain in this way: {STYLES[p.style]}. "
        "Use the curriculum material given as your source and stay consistent with it; when the request goes beyond "
        "it, use general knowledge at this class level and say so in one short line. Keep it age-appropriate and "
        f"under 450 words. Write in {p.language}. Reply in Markdown (KaTeX LaTeX for maths in single dollar signs)."
    )
    user = f"Class: {ctx.class_name}\nSubject: {ctx.subject_name}\nChapter: {ctx.chapter or '(any)'}\nExplain: {target}\n\nMaterial:\n{ctx.text}"
    title = {"simple": "In simple words", "story": "As a story", "analogy": "With an analogy", "example": "With real-life examples",
             "worked": "Worked examples", "steps": "Step by step", "memory": "Memory tricks"}[p.style]
    return {"title": f"{title}: {target}", "content": await llm.call_text(system, user, temperature=0.7)}


FEATURE = Feature(
    key="explain",
    title="Explain it",
    description="Explain a chapter or a tricky word as a story, with examples, an analogy or in simple words.",
    icon="Lightbulb",
    handler=run,
    needs_context=True,
    require_subject=True,
    fields=[
        field_spec("style", "How should it be explained?", "select", default="simple", options=list(STYLES)),
        field_spec("concept", "A specific idea or term (optional)", "text", help="Leave empty to explain the whole chapter"),
    ],
)
