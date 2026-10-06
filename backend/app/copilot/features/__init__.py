"""Feature registry. To add a tool: create a module exposing FEATURE, add it to ALL below, then list its key in
the `tools` of the roles that should see it (app/copilot/profiles.py)."""
from app.copilot.features import announcement, child_report, lesson_plan, parent_note, quiz, study_plan, worksheet
from app.copilot.features.base import Feature

ALL: list[Feature] = [
    quiz.FEATURE,
    study_plan.FEATURE,
    child_report.FEATURE,
    worksheet.FEATURE,
    lesson_plan.FEATURE,
    parent_note.FEATURE,
    announcement.FEATURE,
]

FEATURES: dict[str, Feature] = {f.key: f for f in ALL}
