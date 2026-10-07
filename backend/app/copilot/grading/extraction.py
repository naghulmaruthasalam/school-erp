"""Page images -> the student's answer text per question. A student's answers don't line up with page boundaries, so all
pages go to the vision model together with the numbered question list and it finds each answer wherever it falls."""
from app.copilot import llm

_SYSTEM = (
    "You are transcribing a scanned student answer sheet. You are shown one or more page images, in reading order, and a "
    "numbered list of the exam questions they answer. Handwriting may run across page boundaries: read all pages as one "
    "continuous document. Students label questions inconsistently (numbers, roman numerals, letters, set names, or no "
    "label at all), and the same label style can mean different things on different sheets, so never trust a label's role "
    "from its format alone. Match primarily by CONTENT: find the answer that actually addresses each listed question, using "
    "the student's label only as a clue; never assume the Nth block is question N. For a multiple-choice question the "
    "written answer is often just a short option text or a letter that does not restate the question: check which "
    "question's [Options] it matches. If a student splits one question into sub-parts, combine them into ONE answer; if "
    "consecutive blocks address different questions, keep them separate. If a question was left unanswered, mark it "
    "unanswered; never invent an answer, and never let a skipped question shift later answers up or down. If you cannot "
    "tell which question a block answers, make your best guess and set needs_review to true. Transcribe faithfully; do not "
    "correct the student's mistakes. For maths use plain text or LaTeX. Return ONLY JSON: "
    '{"answers": [{"question_number": <int>, "extracted_text": <string>, "unanswered": <bool>, "needs_review": <bool>}]} '
    "with exactly one entry per listed question, question_number being its 1-based position in the list."
)


def question_list(questions: list[dict]) -> str:
    lines = []
    for i, q in enumerate(questions, 1):
        line = f"{i}. ({q['question_type']}, {q['marks']} marks) {q['text']}"
        if q.get("options"):
            line += " [Options: " + ", ".join(f"{chr(96 + j)}) {o}" for j, o in enumerate(q["options"], 1)) + "]"
        lines.append(line)
    return "Questions on this paper, in order:\n" + "\n".join(lines)


async def extract_answers(questions: list[dict], page_images: list[bytes]) -> dict[int, dict]:
    """{question_number: {extracted_text, unanswered, needs_review}}. A reply in the wrong shape leaves every question unanswered."""
    data = await llm.call_vision_json(_SYSTEM, question_list(questions), page_images)
    answers = data.get("answers", [])
    result: dict[int, dict] = {}
    for item in answers if isinstance(answers, list) else []:
        if not isinstance(item, dict) or not isinstance(item.get("question_number"), int):
            continue
        n = item["question_number"]
        if not 1 <= n <= len(questions):
            continue
        if n not in result:
            result[n] = {"extracted_text": str(item.get("extracted_text") or ""), "unanswered": bool(item.get("unanswered")),
                         "needs_review": bool(item.get("needs_review"))}
            continue
        # two entries claiming the same question: merge them and have a teacher check the match
        old = result[n]
        old["extracted_text"] = "\n".join(t for t in (old["extracted_text"], str(item.get("extracted_text") or "")) if t)
        old["unanswered"] = old["unanswered"] and bool(item.get("unanswered"))
        old["needs_review"] = True
    return result
