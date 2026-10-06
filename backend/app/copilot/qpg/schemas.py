"""Question paper catalogue (types, marks, limits) and request models, ported from Skillorea's qpg/schemas."""
import re

from pydantic import BaseModel, Field

from app.core.exceptions import ValidationAppError

MAX_PAPER_MARKS = 100
PER_CHAPTER_MARK_CAP = 25

# Marks are fixed per type: a drawn question's stored marks are normalised to these so the paper total always
# matches what the picker showed. Dict order is the section order of the paper (ascending marks).
MARKS_BY_TYPE: dict[str, int] = {"mcq": 1, "short": 2, "state_precisely": 3, "answer_in_brief": 4, "long": 5}
TYPE_LABELS = {
    "mcq": "Multiple choice", "short": "Short answer", "state_precisely": "State precisely",
    "answer_in_brief": "Answer in brief", "long": "Long answer",
}


def class_number(class_name: str) -> int | None:
    m = re.search(r"\d+", class_name or "")
    return int(m.group()) if m else None


def allowed_types(class_name: str) -> dict[str, int]:
    """Question type -> the most the picker offers per chapter. Classes 11-12 also get the two middle-weight types."""
    n = class_number(class_name)
    if n is not None and n >= 11:
        return {"mcq": 20, "short": 10, "state_precisely": 3, "answer_in_brief": 2, "long": 5}
    return {"mcq": 20, "short": 10, "long": 5}


def per_chapter_caps(num_chapters: int) -> list[int]:
    """Up to 4 chapters get the full 25 marks each; beyond that the 100-mark paper cap is shared out evenly."""
    if num_chapters <= 0:
        return []
    if num_chapters <= 4:
        return [PER_CHAPTER_MARK_CAP] * num_chapters
    base, extra = divmod(MAX_PAPER_MARKS, num_chapters)
    return [base + (1 if i < extra else 0) for i in range(num_chapters)]


class ChapterSelection(BaseModel):
    chapter: str = Field(min_length=1, max_length=300)
    counts: dict[str, int] = Field(default_factory=dict)  # question type -> how many


class GenerateRequest(BaseModel):
    class_id: str
    subject_id: str
    chapters: list[ChapterSelection] = Field(min_length=1, max_length=40)
    language: str = "English"


def validate_selection(req: GenerateRequest, class_name: str) -> None:
    allowed = allowed_types(class_name)
    seen: set[str] = set()
    total = 0
    for cap, sel in zip(per_chapter_caps(len(req.chapters)), req.chapters):
        if sel.chapter in seen:
            raise ValidationAppError(f"'{sel.chapter}' is listed twice")
        seen.add(sel.chapter)
        marks = 0
        for qtype, count in sel.counts.items():
            if count <= 0:
                continue
            if qtype not in allowed:
                raise ValidationAppError(f"'{qtype}' isn't an available question type for {class_name}")
            if count > allowed[qtype]:
                raise ValidationAppError(f"Too many {TYPE_LABELS[qtype].lower()} questions for '{sel.chapter}' (most {allowed[qtype]})")
            marks += count * MARKS_BY_TYPE[qtype]
            total += count
        if marks > cap:
            raise ValidationAppError(f"'{sel.chapter}' is over its {cap}-mark limit ({marks} marks chosen)")
    if total == 0:
        raise ValidationAppError("Add at least one question to the paper")


class PaperHeader(BaseModel):
    """Free-text header the teacher edits before exporting; blank fields are left out."""
    school_name: str = Field(default="", max_length=200)
    exam_title: str = Field(default="", max_length=200)
    date_label: str = Field(default="", max_length=100)
    time_label: str = Field(default="", max_length=100)
    instructions: str = Field(default="", max_length=1000)


class ExportRequest(BaseModel):
    header: PaperHeader = Field(default_factory=PaperHeader)
    include_answers: bool = False
    format: str = "pdf"  # pdf | text


class BankItemIn(BaseModel):
    class_id: str
    subject_id: str
    chapter: str = Field(min_length=1, max_length=300)
    question_type: str
    text: str = Field(min_length=3, max_length=5000)
    options: list[str] | None = None
    answer: str | None = Field(default=None, max_length=5000)
    keywords: str | None = Field(default=None, max_length=1000)
