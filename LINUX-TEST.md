# Testing the build on Linux (no VPN needed)

The integrations (syllabus content per language, videos, homework rendering and AI feedback, announcements, Arabic UI) do not
need the company database. `./linux-local.sh` runs everything against a **local MongoDB** that it creates and seeds with the demo
school (code `DEMO`), the textbooks and the videos. Your `backend/.env` (Atlas URI, Gemini key...) is left untouched: the script only
overrides `MONGODB_URI` and `MONGODB_DB_NAME` for the commands it starts.

```bash
cd school-erp-linux                  # the unzipped folder
cp /path/to/your/old/backend/.env backend/.env      # your env file (GEMINI_API_KEY etc.); never commit it
chmod +x *.sh
./linux-setup.sh                     # once: venv, pip, npm
./linux-local.sh test                # local MongoDB + seed + textbooks + videos + 15 automated checks
./linux-local.sh run                 # backend :8000 + frontend :5173 on the same local database
./linux-local.sh reset               # (optional) wipe the local test database and start clean
./linux-diagnose.sh                  # if something is missing: report of schools/classes/subjects/notes/videos
```
Local MongoDB comes from Podman/Docker (`docker.io/library/mongo:7`, done for you; on Fedora `sudo dnf install -y podman` if missing) or an installed `mongod`. Logins after the test seed:
school code `DEMO`; student `DEMO-STU-001` / `Student@123`; teacher `DEMO-TCH-001` / `Teacher@123`; principal `principal@demo` /
`Principal@123`; admin `admin@demo` / `Admin@123`; parent `9876543210` / `Parent@123`.

Reading the real database later (needs the VPN) only changes `MONGODB_URI`; use `./linux-test-flow.sh` / `./linux-run.sh` without `linux-local.sh`.

---

Needs: python3 (3.11-3.13) with venv, Node 22 (or 20.19+), npm, and either Docker (local MongoDB) or an Atlas URI.
Run everything from the project folder (the one with `backend/` and `frontend/`).

```bash
chmod +x linux-*.sh
./linux-setup.sh          # venv, pip install, npm install, creates backend/.env
nano backend/.env         # set GEMINI_API_KEY (and MONGODB_URI if not using the local Docker one)
./linux-mongo.sh          # local MongoDB in Docker (skip when using Atlas)
./linux-test-flow.sh      # seed demo school, load textbooks (EN+AR), sync into the syllabus, run 13 automated checks
./linux-run.sh            # backend :8000 + frontend :5173  ->  http://localhost:5173
```

`linux-test-flow.sh` prints PASS/FAIL per check. Expected: all PASS; the translation check is SKIPPED until GEMINI_API_KEY is set.

## Manual flow (after ./linux-run.sh)
School code `DEMO`. Logins: student `DEMO-STU-001` / `Student@123`, teacher `DEMO-TCH-001` / `Teacher@123`,
principal `principal@demo` / `Principal@123`, admin `admin@demo` / `Admin@123`, parent `9876543210` / `Parent@123`.

1. **Syllabus content (student)**: Syllabus > pick *Social Studies* > chapter "Oman in the Rashidun Caliphate Era": the textbook notes show.
   Switch EN | العربية at the top: chapter name and notes switch to the other edition (nothing mixed).
2. **Generators follow the language (teacher)**: Homework > AI Copilot > Class 6 > Social Studies > chapter; choose English, Generate:
   English output. Choose العربية: Arabic output. Same in Teacher Copilot (lesson plan / question paper / worksheet). Needs GEMINI_API_KEY.
3. **Announcements (principal)**: sidebar > Announcements > create one; log in as student: Notifications shows it.
4. **AI homework feedback (student)**: Homework > upload a photo/PDF/.docx of an answer > Submit: the AI Feedback window opens with score,
   per-question comments, in the app language. Needs GEMINI_API_KEY.
5. **Full Arabic**: switch to Arabic and click through every menu item of every login: no English should remain, except
   emails/IDs and file-type names (PDF, CSV). Names/titles/notices typed in English are translated on screen (needs GEMINI_API_KEY).
6. **One Copilot button** (round, bottom corner) on every login.

## If something fails
- `check_connection` fails: MongoDB not running (`docker ps`), wrong `MONGODB_URI`, or Atlas needs VPN/IP allow-list.
- Port in use: `fuser -k 8000/tcp 5173/tcp`.
- Logs of the checks: `/tmp/school-erp-smoke.log`.
- Re-running `linux-test-flow.sh` is safe (seed and sync are idempotent).
- Send me the exact failing line.

## Video lessons (Class 6 Social Studies, chapter 1)
`./linux-test-flow.sh` attaches the two videos in `media/` automatically (or run `./linux-load-videos.sh`; Windows: `load-videos.bat`).
Student > Syllabus > Social Studies > chapter 1 ("Maps: Symbols & Geographic Names"): a video player sits above the notes.
UI in English: the English video; switch to العربية: the Arabic video (and the notes switch too). If a chapter has only one
language's video, that one plays with a note saying so. More chapters/subjects later: same command with `--subject`/`--unit`,
or the upload endpoint `POST /syllabus/{id}/chapters/{index}/video` with `language=en|ar`.
