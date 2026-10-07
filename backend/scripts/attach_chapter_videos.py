"""Attach a chapter's video lessons (one per language) to a school's syllabus.

Usage (from backend/):
    python -m scripts.attach_chapter_videos <school_id> --grade 6 --subject "Social Studies" --unit 1 \
        --en media/english.mp4 --ar media/arabic.mp4

The files are stored where the app stores uploads (S3 when configured, else the local uploads folder) and the chapter keeps
only their keys; the playable links are signed on every read. Students watch the video of the language they use in the app
(the other language's video when only that one exists). Re-running replaces the videos. Unit = the chapter's number in the
textbook (its position in the syllabus).
"""
import argparse
import asyncio
import mimetypes
import subprocess
from pathlib import Path

from app.core.database import close_db, init_db
from app.core.enums import DocumentModule
from app.core.s3 import build_object_key, upload_bytes
from app.models.academic import Class, Subject
from app.models.syllabus import ChapterText, Syllabus
from app.services.academic_keys import class_key, subject_key


def duration_minutes(path: Path) -> int | None:
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                             capture_output=True, text=True, timeout=30).stdout.strip()
        return max(1, round(float(out) / 60))
    except Exception:  # noqa: BLE001 - ffprobe is optional
        return None


async def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("school_id")
    ap.add_argument("--grade", required=True)
    ap.add_argument("--subject", required=True)
    ap.add_argument("--unit", type=int, required=True, help="chapter number (1 = first chapter)")
    ap.add_argument("--en", help="English video file")
    ap.add_argument("--ar", help="Arabic video file")
    args = ap.parse_args()
    if not (args.en or args.ar):
        ap.error("give --en and/or --ar")

    await init_db()
    try:
        classes = {str(c.id) for c in await Class.find(Class.school_id == args.school_id).to_list() if class_key(c.name) == class_key(args.grade)}
        subjects = {str(s.id) for s in await Subject.find(Subject.school_id == args.school_id).to_list()
                    if subject_key(s.name, s.code) == subject_key(args.subject)}
        syllabi = [s for s in await Syllabus.find(Syllabus.school_id == args.school_id).to_list()
                   if s.class_id in classes and s.subject_id in subjects]
        if not syllabi:
            raise SystemExit("No syllabus for that class and subject. Run sync_curriculum / import the syllabus first.")
        done = 0
        for syl in syllabi:
            chapter = next((c for c in syl.chapters if c.order == args.unit), None)
            if chapter is None:
                continue
            for lang, file in (("en", args.en), ("ar", args.ar)):
                if not file:
                    continue
                path = Path(file)
                if not path.is_file():
                    raise SystemExit(f"File not found: {file}")
                key = build_object_key(args.school_id, DocumentModule.SYLLABUS_DOCUMENT, path.name)
                upload_bytes(key, path.read_bytes(), mimetypes.guess_type(path.name)[0] or "video/mp4")
                minutes = duration_minutes(path)
                if lang == "en":
                    chapter.video_s3_key, chapter.video_url, chapter.duration_minutes = key, None, minutes
                else:
                    tr = chapter.translations.get("ar") or ChapterText()
                    tr.video_s3_key, tr.video_url, tr.duration_minutes = key, None, minutes
                    chapter.translations["ar"] = tr
                print(f"{syl.title} / chapter {args.unit} '{chapter.name}': {lang} video stored as {key}")
                done += 1
            await syl.save()
        if not done:
            raise SystemExit(f"No chapter {args.unit} found in that syllabus.")
    finally:
        await close_db()


if __name__ == "__main__":
    asyncio.run(main())
