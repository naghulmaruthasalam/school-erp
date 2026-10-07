"""Read-only check: does this ERP database already hold syllabus content or files matching some text?

Usage (from backend/, with MONGODB_URI etc. in .env like the app):
    python -m scripts.check_content                       # all schools, default search terms
    python -m scripts.check_content --school-id <id> --term map --term caliphate

It only reads. It reports, per school: syllabus chapters (name / topics / notes) that match, uploaded files
(by file name) that match or are PDF/JSON, and the classes and subjects whose names match.
"""
import argparse
import asyncio
import re

from app.core.database import close_db, init_db
from app.models.academic import Class, Subject
from app.models.document import Document
from app.models.syllabus import Syllabus

DEFAULT_TERMS = ["map", "symbol", "geography", "history", "social", "caliphate", "abu bakr", "oman", "sultanate", "unit"]


def _hit(text: str | None, terms: list[str]) -> list[str]:
    low = (text or "").lower()
    return [t for t in terms if re.search(rf"\b{re.escape(t.lower())}", low)]


async def check(school_id: str | None, terms: list[str]) -> dict:
    q_syl = Syllabus.find(Syllabus.school_id == school_id) if school_id else Syllabus.find_all()
    q_doc = Document.find(Document.school_id == school_id) if school_id else Document.find_all()
    syllabi = await q_syl.to_list()
    docs = await q_doc.to_list()
    classes = await (Class.find(Class.school_id == school_id) if school_id else Class.find_all()).to_list()
    subjects = await (Subject.find(Subject.school_id == school_id) if school_id else Subject.find_all()).to_list()

    chapters = []
    for s in syllabi:
        for c in s.chapters:
            found = {t for field in (c.name, c.description, " ".join(c.topics), c.content) for t in _hit(field, terms)}
            if found:
                chapters.append({"school_id": s.school_id, "syllabus": s.title, "chapter": c.name, "matches": sorted(found),
                                 "has_notes": bool((c.content or "").strip()), "topics": len(c.topics)})
    files = []
    for d in docs:
        name = d.original_filename
        ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
        found = _hit(name, terms)
        if found or ext in ("pdf", "json"):
            files.append({"school_id": d.school_id, "file": name, "type": ext, "module": str(d.module), "matches": found})
    return {
        "totals": {"syllabi": len(syllabi), "chapters": sum(len(s.chapters) for s in syllabi),
                   "chapters_with_notes": sum(1 for s in syllabi for c in s.chapters if (c.content or "").strip()),
                   "documents": len(docs)},
        "matching_classes": [c.name for c in classes if _hit(c.name, terms)],
        "matching_subjects": [s.name for s in subjects if _hit(s.name, terms)],
        "all_subjects": sorted({s.name for s in subjects}),
        "matching_chapters": chapters,
        "pdf_json_or_matching_files": files,
    }


def print_report(r: dict) -> None:
    t = r["totals"]
    print(f"Syllabi: {t['syllabi']} | chapters: {t['chapters']} ({t['chapters_with_notes']} with notes) | uploaded files: {t['documents']}")
    print("Subjects in the database:", ", ".join(r["all_subjects"]) or "(none)")
    print("Classes matching:", r["matching_classes"] or "none", "| subjects matching:", r["matching_subjects"] or "none")
    print(f"\nChapters matching the search ({len(r['matching_chapters'])}):")
    for c in r["matching_chapters"]:
        print(f"  - [{c['school_id']}] {c['syllabus']} > {c['chapter']}  (matched: {', '.join(c['matches'])}; notes: {c['has_notes']}, topics: {c['topics']})")
    print(f"\nFiles that match, or are PDF/JSON ({len(r['pdf_json_or_matching_files'])}):")
    for f in r["pdf_json_or_matching_files"]:
        print(f"  - [{f['school_id']}] {f['file']}  ({f['type']}, {f['module']})")


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--school-id")
    ap.add_argument("--term", action="append", help="text to look for (repeatable)")
    args = ap.parse_args()
    await init_db()
    try:
        print_report(await check(args.school_id, args.term or DEFAULT_TERMS))
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
