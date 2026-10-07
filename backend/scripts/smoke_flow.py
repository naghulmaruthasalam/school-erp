"""End-to-end check of the new flow against a RUNNING backend (no extra packages needed).

    python -m scripts.smoke_flow [--base http://localhost:8000/api/v1] [--school DEMO]

Logs in as the demo student, teacher and principal and checks:
  1. the syllabus tree has chapters for the student's class, in English and in Arabic (different text, no mixing)
  2. opening a chapter returns its textbook notes in the requested language
  3. the textbook library answers in the requested language (curriculum API)
  4. the principal can publish an announcement and the student sees it
  5. data-text translation endpoint (needs GEMINI_API_KEY on the backend: reported, not failed, when absent)
Run the seed / ingest / sync steps first (linux-test-flow.sh does).
"""
import argparse
import json
import re
import sys
import urllib.error
import urllib.request

ARABIC = re.compile(r"[؀-ۿ]")
results: list[tuple[str, bool, str]] = []


def call(base, method, path, token=None, body=None, lang="en"):
    req = urllib.request.Request(base + path, method=method, data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type", "application/json")
    req.add_header("Accept-Language", lang)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or "null")
    except urllib.error.HTTPError as e:
        return e.code, {"detail": e.read().decode()[:300]}


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail else ""))


def login(base, school, username, password):
    code, data = call(base, "POST", "/auth/login", body={"username": username, "password": password, "school_code": school})
    return data.get("access_token") if code == 200 else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000/api/v1")
    ap.add_argument("--school", default="DEMO")
    a = ap.parse_args()
    b = a.base

    student = login(b, a.school, "DEMO-STU-001", "Student@123")
    teacher = login(b, a.school, "DEMO-TCH-001", "Teacher@123")
    principal = login(b, a.school, "principal@demo", "Principal@123")
    check("logins (student, teacher, principal)", student and teacher and principal, "run seed-demo-data first" if not (student and teacher and principal) else "")
    if not student:
        sys.exit(1)

    # 1 + 2: syllabus tree and chapter content, per language
    seen = {}
    for lang in ("en", "ar"):
        code, tree = call(b, "GET", "/syllabus/tree", student, lang=lang)
        classes = [c for c in (tree.get("classes") or []) if c.get("subjects")] if code == 200 else []
        check(f"[{lang}] student sees class > subject > chapter", classes, f"HTTP {code}")
        if not classes:
            continue
        for subj in classes[0]["subjects"]:
            for ch in subj["chapters"]:
                if ch.get("has_content"):
                    code, syl = call(b, "GET", f"/syllabus/{subj['syllabus_id']}", student, lang=lang)
                    full = next((c for c in syl.get("chapters", []) if c["id"] == ch["id"]), {})
                    seen.setdefault(lang, []).append((subj["name"], ch["name"], full.get("content") or "", full.get("content_language")))
        check(f"[{lang}] at least one chapter has textbook notes", seen.get(lang), "load-textbooks / sync step not run?" if not seen.get(lang) else "")
    if seen.get("en") and seen.get("ar"):
        en_names = {n for _, n, _, _ in seen["en"]}
        ar_names = {n for _, n, _, _ in seen["ar"]}
        check("chapter names follow the language (Arabic names are Arabic)", any(ARABIC.search(n) for n in ar_names) and not any(ARABIC.search(n) for n in en_names))
        both = [(e, r) for e in seen["en"] for r in seen["ar"] if e[0] == r[0] and e[1] != r[1] and e[3] == "en" and r[3] == "ar"]
        check("same chapter: English notes are English, Arabic notes are Arabic",
              any(not ARABIC.search(e[2][:300]) and ARABIC.search(r[2][:300]) for e, r in both) if both else None, "no chapter has both editions" if not both else "")

    # 2b: video lessons, one per language (only when scripts.attach_chapter_videos / load-videos was run)
    vids = {}
    for lang in ("en", "ar"):
        code, tree = call(b, "GET", "/syllabus/tree", student, lang=lang)
        for c in tree.get("classes", []) if code == 200 else []:
            for subj in c.get("subjects", []):
                for ch in subj["chapters"]:
                    if ch.get("has_video"):
                        code, syl = call(b, "GET", f"/syllabus/{subj['syllabus_id']}", student, lang=lang)
                        full = next((x for x in syl.get("chapters", []) if x["id"] == ch["id"]), {})
                        vids.setdefault(ch["key"], {})[lang] = (full.get("video_language"), (full.get("video_url") or "").split("?")[0])
    if vids:
        for key, per in vids.items():
            if "en" in per and "ar" in per and per["en"][0] == "en" and per["ar"][0] == "ar":
                check(f"video lesson '{key[:40]}': English and Arabic students get different videos", per["en"][1] != per["ar"][1])
    else:
        print("SKIP video lessons: none attached yet (run load-videos / linux-load-videos.sh)")

    # 3: curriculum library
    for lang in ("en", "ar"):
        code, data = call(b, "GET", "/curriculum/chapters?grade=6&subject=Social%20Studies", teacher, lang=lang)
        chapters = data.get("chapters", []) if code == 200 else []
        ok = bool(chapters) and all(bool(ARABIC.search(c["title"])) == (lang == "ar") for c in chapters)
        check(f"[{lang}] curriculum chapters list one entry per unit in {lang}", ok, f"{len(chapters)} units" if chapters else "empty: run load-textbooks")
    code, c = call(b, "GET", "/curriculum/content?grade=6&subject=Social%20Studies&unit_number=2&lang=en", teacher)
    if code == 200 and c.get("full_text"):
        check("English request returns English text", not ARABIC.search(c["full_text"][:400]), f"served language: {c.get('language')}")
    code, c = call(b, "GET", "/curriculum/content?grade=6&subject=Social%20Studies&unit_number=2&lang=ar", teacher)
    if code == 200 and c.get("full_text"):
        check("Arabic request returns Arabic text", bool(ARABIC.search(c["full_text"][:400])), f"served language: {c.get('language')}")

    # 4: principal announcement
    if principal:
        code, n = call(b, "POST", "/notifications", principal, {"title": "Smoke test notice", "content": "Created by smoke_flow.py", "notification_type": "ANNOUNCEMENT", "priority": "NORMAL", "target_roles": ["STUDENT"]})
        check("principal can publish an announcement", code in (200, 201), f"HTTP {code}")
        code, lst = call(b, "GET", "/notifications", student)
        titles = [x.get("title") for x in (lst.get("items") if isinstance(lst, dict) else []) or []]
        check("student sees the announcement", "Smoke test notice" in titles, f"HTTP {code}")

    # 5: translation of data text
    code, t = call(b, "POST", "/i18n/translate", student, {"texts": ["Mid-Term Examination"], "target": "ar"})
    if code == 200 and t.get("available"):
        check("data-text translation works (Arabic)", bool(t["translations"]) and all(ARABIC.search(v) for v in t["translations"].values()))
    else:
        print("SKIP data-text translation: no GEMINI_API_KEY configured on the backend (UI text is still fully Arabic; data text stays as typed)")

    failed = [r for r in results if r[1] is False]
    print(f"\n{len(results) - len(failed)} passed, {len(failed)} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
