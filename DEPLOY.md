# Deploying

The app is two parts: a static React frontend and a FastAPI backend (MongoDB, optional S3, headless Chromium for PDFs,
streaming chat). **Vercel hosts the frontend. The backend cannot run on Vercel's serverless functions** (Chromium is too big,
chat streams for a long time, uploads/videos need real file storage) so it goes on a container host (Render, Railway, Fly,
AWS) or your own server.

## 1. Frontend on Vercel
1. Vercel > Add New > Project > import the GitHub repo, **Root Directory = `frontend`** (framework Vite is detected; `vercel.json` handles routing).
2. Environment variable `VITE_API_BASE_URL` = `https://<your-backend>/api/v1`.
3. Deploy. Every push to the branch redeploys.

*Demo only, no backend:* set `VITE_STANDALONE_DEMO=1` instead of `VITE_API_BASE_URL`; the site then runs on built-in sample data.

## 2. Backend (Render shown; `render.yaml` is included)
- New > Blueprint > pick the repo. Fill the secrets it asks for: `MONGODB_URI`, `GEMINI_API_KEY`, `CORS_ORIGINS` (the Vercel URL),
  `BACKEND_BASE_URL` (the backend's public URL), `FRONTEND_BASE_URL`, and S3 keys.
- **MongoDB**: use Atlas and allow the host's outbound IPs in Atlas > Network Access. A database that is only reachable over a
  company VPN cannot be used from a cloud host.
- **Files** (homework uploads, chapter videos, profile photos): set the S3 variables. Without S3 the backend stores files on the
  container disk, which most hosts wipe on every deploy.
- First run against the new database: `python -m scripts.seed_sample_data` (only for an empty demo database), then
  `python -m scripts.load_textbooks cls6_all_units_mongodb.ndjson` and `python -m scripts.attach_chapter_videos ...`
  (Render > Shell, or locally pointing `MONGODB_URI` at the same database).

## 3. Check
Open the Vercel URL, sign in as a student, open Syllabus. API health: `https://<backend>/health`.
