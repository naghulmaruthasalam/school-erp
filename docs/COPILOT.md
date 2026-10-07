# Copilot

An AI assistant inside the ERP, built from the Skillorea Teacher Copilot backend (chat pipeline, safety gate,
worksheet and lesson-plan generators) and adapted to the ERP's own login, roles, database and syllabus data.

It appears as **one floating round button on every dashboard, for every login**: student, parent, teacher, principal,
school admin and super admin. There is no other assistant button anywhere: what the button offers (modes, quick
actions, tools, history) depends on the role (see "What each login gets" and "Other roles"). Demo mode runs the same
Copilot on sample data in the browser.

## What each login gets

| | Student - *Study Buddy* | Parent - *Parent Companion* | Teacher - *Teaching Copilot* |
|---|---|---|---|
| **Study help** (chat grounded in the class's syllabus) | Explains lessons step by step, gives hints before answers, never hands over finished homework | Explains topics in plain language and suggests simple ways to help at home | Explains concepts, misconceptions, analogies, activities and teaching strategies |
| **My school** (the user's own ERP data) | Homework due, attendance, timetable, exams and results | Own children's attendance, homework, results, fees, events | Today's classes, absentees, homework submissions, timetable |
| **Tools** | Explain it, Practice quiz, Study plan (from your homework + exams) | Explain it, Child progress summary (with tips for home) | Homework ideas, Worksheet generator, Lesson plan, Practice quiz (class test), Explain it, Parent note |
| **Picks** | Own class is automatic; chooses subject + chapter | Chooses the child (own class is automatic) | Chooses class, subject, chapter |

Every chat is saved per user (History tab), can be reopened or deleted, and is visible only to its owner.
Replies stream in live, render Markdown, tables and maths (KaTeX), and can be requested in English, Arabic,
Hindi or Tamil (default follows the app language). Worksheets, plans and quizzes have Copy and Print / PDF.

## Syllabus in the database drives everything

The curriculum lives in the `syllabus` collection: **class -> subject -> chapter**, and each chapter can carry
**topics** and **study notes**. The Copilot reads it on every message, so what it explains, quizzes and sets as
homework always matches what the school teaches.

* **Browse**: Syllabus pages (teacher, student, parent, admin) open with a Class -> Subject -> Chapter browser,
  scoped by role (students and parents only see published syllabi of their own class; teachers see their classes).
* **Teachers, inside a chapter**: *Create homework* (opens the Homework form with subject, chapter and class
  filled in; homework now carries a `chapter`), *Homework ideas* (AI suggestions that avoid what the chapter
  already has; each has a *Create this homework* button), Worksheet, Lesson plan, Class quiz.
* **Students and parents, inside a chapter**: *Explain it to me*, *Quiz me*, *Ask the Copilot*. A pending
  homework has *Get a hint from the Copilot*, grounded in that homework's chapter.
* **Free explanation**: the notes are the primary source, but for clarification the Copilot may go beyond them
  (saying so) and explain **in simple words, as a story, with an analogy, real-life examples, worked examples,
  step by step or with memory tricks** (*Explain it* tool, or just ask in chat).
* **Loading the syllabus**: Import on the admin/teacher Syllabus page (CSV or JSON, preview before saving,
  re-runs update chapters by name), or `python -m scripts.import_syllabus <school_id> file.csv [--apply]
  [--create-missing] [--replace]`. Template: `GET /api/v1/syllabus/import/template`. Columns:
  `class, subject, chapter, topics (; separated), description, content, order`. "Class 8", "Grade 8", "8" and
  "VIII" are the same class. Unknown classes/subjects are reported and skipped unless *create missing* is on.
  Topics and notes can also be edited per chapter in the syllabus editor.
* API: `GET /syllabus/tree`, `POST /syllabus/import` (multipart: `file`, `dry_run`, `create_missing`, `mode`).

### Curriculum source: give a link, the Copilot starts using it

If the curriculum lives in a bucket (for example S3), the school admin or principal opens **Syllabus -> Connect
source**, pastes the link (a pre-signed S3 URL needs no key; otherwise add an API key and, if needed, the header
name) and presses **Test link** (nothing is saved), then **Save and sync now**. Syncs can also run hourly or daily.

* **Formats**: one JSON file, a CSV, or a ZIP of them. JSON may be a list, `{"data": [...]}` (also `chapters`,
  `items`, `results`...) or nested `{"classes": [{"subjects": [{"chapters": [...]}]}]}`.
* **One record per chapter or unit**, e.g. `{"class": 6, "subject": "Social Studies", "language": "en",
  "unit_number": 2, "unit_title_en": "Oman in the Rashidun Caliphate Era", "full_text": "..."}`. Recognised names
  include class/grade/gradeName/gradeId, subject/subjectName/subjectId, chapter/chapterName/unit_title_en/title,
  unit_number/chapterNo/order, topics, description, content/full_text/notes. A bare number like `6` becomes
  "Class 6". `full_text` extracted from a PDF is tidied (translator watermark, stray glyphs, page numbers).
  When a unit arrives in several languages the English record is the one kept.
* **Other field names, or ids only**: use *field mapping* in the dialog (`unit_title_en = chapter`, and
  `class: <id> = Class 8` for ids). Rows that can't be understood are listed, not silently dropped.
* **Re-syncing** updates chapters by name and is skipped when the file hasn't changed (unless forced).
* **Safety**: the key is encrypted at rest and never returned; only https links to public addresses are fetched
  (set `CURRICULUM_ALLOW_PRIVATE_URLS=true` for local development only); redirects aren't followed; files over
  `CURRICULUM_FETCH_MAX_MB` (50) are refused; failures say what happened (expired link, wrong key, not found).
* API: `GET/PUT/DELETE /syllabus/source`, `POST /syllabus/source/test`, `POST /syllabus/source/sync?force=`.
* PDFs and images in the bucket are not read yet; only the JSON/CSV text is used.

## How it stays safe and grounded

- **Access is decided on the server.** A student can only use their own class; a parent only their own child's;
  a teacher only classes they teach (timetable / subject assignment / assigned classes). Drafts of a syllabus
  are never shown to students or parents. "My school" answers go through the same permission-checked services
  as the REST API, so nobody sees another user's records.
- **Grounding.** Study help and the tools use the school's syllabus for that class + subject: the outline, the
  selected chapter, and the text of PDF / text documents attached to the syllabus. It is re-read on every message,
  never taken from the client. With no material the model uses its subject knowledge and says when unsure.
- **Gate.** Every message is classified (unsafe / off-topic) before the chat model sees it; those get a fixed,
  localised reply. The gate fails open if the classifier is down; the main prompt's own rules are the backstop.
- **Limits.** 2,000 characters per message, `COPILOT_MESSAGES_PER_MINUTE` messages per user (default 20),
  uploaded document text capped at `COPILOT_MAX_CONTEXT_CHARS`.
- **Without an AI key** "My school" still answers (built-in assistant); Study help and the tools explain that the
  key is missing (tools return 503 with the variable name). Nothing crashes.

## Setup

```
GEMINI_API_KEY=...                 # https://aistudio.google.com/apikey  (default provider)
GEMINI_MODEL_NAME=gemini-2.0-flash
# optional
COPILOT_LLM_PROVIDER=gemini        # or openai (then set OPENAI_API_KEY / OPENAI_MODEL)
COPILOT_ENABLED_ROLES=STUDENT,PARENT,TEACHER,PRINCIPAL,SCHOOL_ADMIN,SUPER_ADMIN   # the default: every login
COPILOT_MESSAGES_PER_MINUTE=20
COPILOT_MAX_CONTEXT_CHARS=60000
```
For good study answers, publish a **Syllabus** (Admin / Teacher > Syllabus) for each class + subject with chapters,
and attach the chapter PDFs: the Copilot reads them.

## API (all under `/api/v1/copilot`, bearer token)

| | |
|---|---|
| `GET /profile` | persona, modes, quick actions, tools and their form specs; `{"enabled": false}` if not on for this role |
| `GET /context` | classes > subjects > chapters this user may use (+ a parent's children) |
| `POST /sessions` | `{mode: "study"\|"school", language, class_id?, subject_id?, chapter?, student_id?}` |
| `GET /sessions`, `GET/DELETE /sessions/{id}` | the user's chat history |
| `POST /sessions/{id}/messages` | `{message}` -> `{reply, title}` |
| `POST /sessions/{id}/messages/stream` | same, as Server-Sent Events (`chunk`, `done`, `error`) |
| `POST /tools/{key}` | `{context: {class_id, subject_id, chapter, student_id}, params: {...}, language}` |

## Architecture (backend/app/copilot)

```
llm.py        Gemini (default) / OpenAI, retries, streaming, clear "not configured" error
safety.py     unsafe + on-topic gate          off_topic.py  localised fixed replies
grounding.py  access rules + syllabus/document context + the picker options
profiles.py   ONE PROFILE PER ROLE  <- where roles are added or tuned
features/     the tools                      <- where tools are added
service.py    the two chat modes (study / school), streaming
sessions.py   owner-scoped history, rate limiting     models/copilot.py  the collection
```
Frontend: `frontend/src/copilot/` (`CopilotWidget` + `ToolRunner`, `ContextPicker`, `Markdown`, `results`).
`DashboardLayout` mounts `CopilotWidget`, the only assistant button. If the server can't be reached it shows the same
round button with a short explanation and "Try again"; it shows nothing only when an operator removed the role from
`COPILOT_ENABLED_ROLES`. Demo mode (`copilot/demo/`, `api/demo*.ts`) answers from sample data in the browser.

## Other roles

**Principal** ("School Insights"), **school admin** ("Operations Copilot") and **super admin** ("Platform Copilot")
are on by default. They get "My school" answers over their role's ERP tools (school summary, attendance trend, fee
collection, admissions) and the Announcement draft tool; principals also get Study help. The super admin has no
school, so theirs is a single chat about platform data (no saved sessions, tools or files). To switch a role off,
remove it from `COPILOT_ENABLED_ROLES`.

### Add a role or tune one
Edit its `Profile` in `profiles.py`: `persona`, `scope` (what the gate treats as on-topic), `quick_actions` per
mode, `tools`, `study_enabled`. Then add the role to `COPILOT_ENABLED_ROLES`.

### Add a tool
1. Create `features/my_tool.py` exposing `FEATURE = Feature(key, title, description, icon, handler, fields=[...])`.
   The handler is `async def run(current, ctx, params) -> dict`; `ctx` is the grounded `StudyContext` when
   `needs_context=True`. Use `llm.call_text/call_json` and `features/erp_data.call(...)` for the user's own data.
2. Add it to `ALL` in `features/__init__.py`.
3. List its key in the `tools` of the roles that should see it.
The UI builds the form from `fields` (text, textarea, number, select, date, child) and renders `questions` (quiz) or
`content` (Markdown) results; multi-step tools (worksheet, lesson plan) have their own panels in `ToolRunner.tsx`.

## Question papers, answer-sheet grading and PDFs (teachers)

Ported from the Skillorea backend and rebuilt on the ERP's own data, auth and storage.

**Question paper** (Tools -> Question paper, `/api/v1/copilot/qpg`)
* Pick class, subject and chapters (from the syllabus) and how many of each question type per chapter: multiple
  choice 1 mark, short 2, long 5 (classes 11-12 also get "state precisely" 3 and "answer in brief" 4). Limits: 25
  marks per chapter (shared out evenly beyond 4 chapters) and 100 per paper.
* Questions come from the **school's question bank** first (shared by the school's teachers; teachers can also add
  their own). When the bank can't fill a chapter, the AI writes the shortfall (plus two spare) from that chapter's
  syllabus notes and saves them to the bank, so papers get more varied over time.
* **Shuffle-bag rotation** per teacher, chapter and type: every question is used once before any repeats, and
  newly added questions join the current pass. Papers are saved (last 30 per teacher) with the full answer key.
* Export the question paper or the answer key as PDF (or text) with the teacher's own header (school, exam title,
  date, time). Files land in the Files history.
* API: `GET /options`, `POST /generate`, `GET /papers`, `GET|DELETE /papers/{id}`, `POST /papers/{id}/export`,
  `GET|POST /bank`, `DELETE /bank/{id}`.

**Grading** (Tools -> Grade answer sheets, `/api/v1/copilot/grading`)
* Choose one of your generated papers, upload a student's pages (JPG, PNG, WEBP or PDF, up to 20 pages, 15 MB each)
  and the AI reads all pages together and finds each answer wherever it falls, even across page breaks.
* **Marking**: multiple choice is matched against the key without the AI (letters, option text, LaTeX vs plain
  notation, sub/superscripts, arrows...), with a narrow AI check only when that doesn't match; every other type is marked
  by the AI against the model answer and key points (step marks for maths-type subjects, point-by-point otherwise),
  in half-mark steps. Unclear matches and failed marks are flagged "check" for the teacher.
* **Several students**: a class set is graded in the background (four at a time, up to 80 students) with live
  progress ("Question 3 of 6"); one failure doesn't stop the others. One batch per teacher at a time.
* Teachers can **adjust marks and feedback** per question (half-mark steps, within the question's marks); totals update.
* **Report**: a class summary plus one table per student, as PDF or text, saved to the Files history.
* API: `POST /evaluate`, `POST /batch`, `GET /batch/{id}`, `GET /results`, `GET|PATCH|DELETE /results/{id}`, `POST /report`.
* Answer sheets are processed in memory and never stored; only the transcribed answers, marks and feedback are kept.
* Not ported: grading of diagrams/drawings by comparing against reference images, and HEIC photos (convert to JPG).

**PDF export** needs Chromium. The backend Docker image installs it; elsewhere run
`playwright install --with-deps chromium`, or point `COPILOT_CHROMIUM_PATH` at an existing Chromium/Chrome.
Without it exports return a clear 503 and the text export still works.

## Not included from the Skillorea backend

Cognito login, plans/payments/entitlements and generation quotas, the admin console, app-version gating and the AWS
pipeline (the ERP has its own auth, roles and deployment). The profile/tool registry is where more would plug in.
