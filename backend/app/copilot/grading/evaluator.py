"""Marks for one extracted answer. Multiple choice is matched against the answer key without the AI first (the AI is only a
narrow fallback for notation the normaliser doesn't know); everything else is marked by the AI against a rubric built from the
question, its model answer and key points, with half-mark steps."""
import re

from app.copilot import llm

_GREEK = {"alpha": "α", "beta": "β", "gamma": "γ", "delta": "δ", "theta": "θ", "lambda": "λ", "mu": "μ", "pi": "π", "sigma": "σ",
          "omega": "ω", "Delta": "Δ", "Omega": "Ω", "infty": "∞", "pm": "±", "leq": "≤", "geq": "≥", "neq": "≠", "approx": "≈",
          "times": "×", "div": "÷", "cdot": "·", "to": "→", "rightarrow": "→", "degree": "°", "left": "", "right": ""}
_SUB = str.maketrans("₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹", "01234567890123456789")


def normalize(text: str) -> str:
    """Canonical form for comparing a handwritten/OCR answer with a (possibly LaTeX) key: strips math delimiters, maps common
    commands to symbols, folds sub/superscript digits, arrows, thousands commas, case and spacing."""
    t = text or ""
    t = re.sub(r"\$+|\\\(|\\\)|\\\[|\\\]", "", t)
    t = re.sub(r"\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}", r"\1/\2", t)
    t = re.sub(r"\\sqrt\[([^\[\]]*)\]\{([^{}]*)\}", r"\1√\2", t)
    t = re.sub(r"\\sqrt\{([^{}]*)\}", r"√\1", t)
    t = re.sub(r"\\(?:text|mathrm|mathbf|mathbb|vec|hat|bar|overline|operatorname)\{([^{}]*)\}", r"\1", t)
    t = re.sub(r"\\([A-Za-z]+)", lambda m: _GREEK.get(m.group(1), m.group(1)), t)
    t = re.sub(r"[\^_]\{([^{}]+)\}", r"\1", t).replace("^", "").replace("_", "")
    t = t.translate(_SUB)
    t = re.sub(r"[→⇌⇔↔⇒⟶]+|->|-->", "→", t)
    t = re.sub(r"(?<=\d),(?=\d{3}\b)", "", t)
    t = re.sub(r"[°%]", "", t)
    t = re.sub(r"[{}\\]", "", t)
    return re.sub(r"[\s.,;:]+$", "", re.sub(r"\s+", "", t.lower()))


def resolve_mcq_answer(student: str, options: list[str]) -> str:
    """The option the student chose, normalised: a letter ("b", "(b)", "B."), or the option text itself."""
    s = (student or "").strip()
    letter = re.fullmatch(r"\(?\s*([a-dA-D])\s*[\).:]?", s)
    if letter and ord(letter.group(1).lower()) - 97 < len(options):
        return normalize(options[ord(letter.group(1).lower()) - 97])
    lead = re.match(r"^\(?([a-dA-D])[\).:]\s+(.+)$", s)  # "b) Keratin"
    if lead and ord(lead.group(1).lower()) - 97 < len(options):
        picked = normalize(options[ord(lead.group(1).lower()) - 97])
        if normalize(lead.group(2)) == picked:
            return picked
    return normalize(s)


_GRADER_SYSTEM = "Follow the grading instructions exactly and return ONLY the JSON object they specify."


async def _llm_same_mcq(question: dict, student: str) -> bool:
    prompt = (
        "A student answered a multiple-choice question. Decide ONLY whether the student's answer is the same choice as the "
        "correct answer, allowing for notation differences (LaTeX vs plain text, symbols, spacing, a letter instead of the "
        "text). A different value, formula or option is NOT the same. When unsure, say false.\n"
        f"Question: {question['text']}\nOptions: {question.get('options')}\nCorrect answer: {question.get('answer')}\n"
        f"Student answer: {student}\nReturn JSON: {{\"is_correct\": true|false}}"
    )
    try:
        return bool((await llm.call_json(_GRADER_SYSTEM, prompt)).get("is_correct"))
    except llm.LLMNotConfigured:
        return False  # grading without an AI key still works for the clear-cut multiple-choice matches


async def evaluate_mcq(question: dict, student: str) -> tuple[float, str, bool]:
    marks = question["marks"]
    correct = normalize(question.get("answer") or "")
    given = resolve_mcq_answer(student, question.get("options") or [])
    if given and correct and given == correct:
        return float(marks), "Correct.", False
    if correct and student.strip() and await _llm_same_mcq(question, student):
        return float(marks), "Correct.", False
    return 0.0, f"Incorrect, expected '{question.get('answer') or ''}'.", False


def _rubric(question: dict, student: str, subject: str) -> str:
    marks = question["marks"]
    key = (question.get("answer") or "").strip() or "(none provided)"
    if question.get("keywords"):
        key += f"\nKey points / keywords: {question['keywords']}"
    maths = bool(re.search(r"math|physics|chem|account", subject, re.I))
    method = (
        "This is a worked-solution subject: give credit for each correct step of the method even if the final answer is "
        "wrong, and cap a bare final answer with no working below full marks."
        if maths else
        "Mark by points: split the model answer into its distinct expected points and give credit in proportion to how many "
        "the student covers correctly, in their own words. Synonyms and equivalent explanations count."
    )
    return (
        f"You are a fair, consistent school examiner marking a {marks}-mark {question['question_type'].replace('_', ' ')} question"
        f"{' in ' + subject if subject else ''}.\n{method}\n"
        "Presentation (spelling, grammar, neatness) matters only when it hides a technical term. The student's text comes from "
        "scanned handwriting and may contain transcription slips: be generous where the intent is clear. Penalise statements that "
        "contradict the correct answer. Do not reward length or restating the question. Award marks in steps of 0.5, never more "
        f"than {marks}. If the answer does not address the question at all, award 0.\n\n"
        f"Question: {question['text']}\nModel answer: {key}\nStudent answer: {student}\n\n"
        'Return JSON: {"score": <number>, "rationale": "<2-3 sentences for the teacher: what earned marks and what is missing>", '
        '"needs_review": <true if you are unsure how to mark this>}'
    )


async def evaluate_subjective(question: dict, student: str, subject: str) -> tuple[float, str, bool]:
    marks = float(question["marks"])
    try:
        data = await llm.call_json(_GRADER_SYSTEM, _rubric(question, student, subject))
        score = round(max(0.0, min(float(data["score"]), marks)) * 2) / 2
        return score, str(data.get("rationale", "")).strip() or "Marked by the AI.", bool(data.get("needs_review"))
    except llm.LLMNotConfigured:
        raise
    except (llm.LLMError, KeyError, TypeError, ValueError):
        return 0.0, "Could not auto-mark this answer; please mark it by hand.", True


async def evaluate_question(question: dict, student_answer: str, subject: str = "") -> tuple[float, str, bool]:
    """(marks, feedback, needs_review)."""
    if not student_answer.strip():
        return 0.0, "No answer given.", False
    if question["question_type"] == "mcq":
        return await evaluate_mcq(question, student_answer)
    return await evaluate_subjective(question, student_answer, subject)
