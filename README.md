# Cogniitec AI School ERP — v1

Multi-tenant school ERP with role-based AI assistants, built with FastAPI +
MongoDB (backend) and React + TypeScript (frontend).

## Stack

- **Backend**: FastAPI, Beanie (MongoDB ODM) / Motor, JWT auth, boto3 (S3),
  Vertex AI (Gemini 2.5 Flash Lite), PayU (hosted-checkout hash flow),
  ReportLab (PDF).
- **Frontend**: React + TypeScript + Vite, Tailwind CSS v4, TanStack Query,
  React Router, Zustand.
- **Database**: MongoDB, shared cluster with `school_id` tenant scoping on
  every collection.

## Security note

⚠️ This repo's root `.env` originally contained an exposed
`ANTHROPIC_API_KEY`. Rotate that key and never commit real secrets — the
`.gitignore` at the repo root excludes `.env*` (except `.env.example`) and
service-account JSON files, but a key that was already generated should still
be rotated.

## Local development

### 1. MongoDB
```
docker run -d --name school-erp-mongo -p 27017:27017 mongo:7
```

### 2. Backend
```

 py -3.11 -m venv .venv311
 .\.venv311\Scripts\Activate.ps1
cd backend
pip install -r requirements.txt
cp .env.example .env      # fill in MongoDB URI, JWT secret, AWS/Gemini/PayU creds
python -m scripts.create_super_admin
uvicorn app.main:app --reload
```
API docs: http://localhost:8000/docs

### 3. Frontend
```
cd frontend
npm install
cp .env.example .env      # VITE_API_BASE_URL -> your backend URL
npm run dev
```
App: http://localhost:5173

### 4. Tests
```
cd backend
python -m pytest tests/ -q
```
Tests run against an in-memory MongoDB (mongomock) — no real database needed.

## Required credentials for full functionality

These are read from `backend/.env` / a mounted service-account file; without
them the corresponding feature fails with a clear error rather than silently
no-op'ing:

| Feature | Env vars |
|---|---|
| File/image uploads (S3) | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME` |
| AI assistants (Gemini via Vertex AI) | `GOOGLE_APPLICATION_CREDENTIALS` (path to a GCP service-account JSON key), `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION` |
| Online fee payments (PayU) | `PAYU_MERCHANT_KEY`, `PAYU_MERCHANT_SALT`, `PAYU_BASE_URL`, plus `BACKEND_BASE_URL` (must be publicly reachable — PayU redirects the browser back to it) |
| Fee refunds (PayU) | `PAYU_POSTSERVICE_URL` (uses the same key/salt as checkout) |

## Project layout

```
backend/app/
  core/      config, DB connection, JWT/RBAC, S3, PDF, audit helpers
  models/    Beanie documents (MongoDB collections)
  schemas/   Pydantic request/response DTOs
  services/  business logic, shared by REST routes and AI tools
  api/v1/    FastAPI routes
  ai/        Gemini client, per-role tools, assistant orchestration
frontend/src/
  auth/      login, auth store, protected routes
  layouts/   per-role dashboard shell
  pages/     admin/ principal/ teacher/ parent/ student/ super-admin/
  api/       typed API client
```

## Scope

v1 covers: multi-tenant auth/RBAC, admissions, students, teachers, guardians,
academics (years/classes/sections/subjects/timetable/calendar), attendance
(student + staff), homework, exams/marks/report cards, fees/invoices +
PayU payments, document uploads (S3), and all 5 role-based AI assistants.

### PayU integration notes
PayU's classic hosted-checkout flow is a browser redirect via HTML form POST
(not a JS SDK modal): the frontend calls `POST /payments/payu/initiate`,
gets back a hash + form fields, and submits a hidden form straight to PayU's
page. PayU then POSTs the result back to `POST /payments/payu/callback`
(our backend, `surl`/`furl`) with a reverse hash we verify before trusting
anything, then redirects the browser on to the frontend with
`?payment=success|failed`. The same result can also be configured as a
server-to-server webhook (`POST /payments/payu/webhook`, more reliable than
the browser callback since it doesn't depend on the redirect completing —
see "PayU dashboard webhook setup" below).

**Verified against PayU's real test sandbox** (not just internal hash math):
posting a live-generated checkout request directly to `https://test.payu.in/_payment`
with real `PAYU_MERCHANT_KEY`/`PAYU_MERCHANT_SALT` returned a `302` to a real
`apitest.payu.in/public/#/...` checkout session — proof PayU accepted the
hash and credentials, not just that our own verification logic is
self-consistent. The refund hash (`sha512(key|command|var1|salt)`) was
verified the same way: probing PayU's live `postservice.php` with
`cancel_refund_transaction`/`verify_payment` commands returned authenticated
business responses (`"transaction does not exists"`) rather than a hash
error, confirming the formula and endpoint. What's *not* yet been exercised:
a full completed transaction (needs a browser to enter test card details on
PayU's hosted page) and a real refund against an actual `mihpayid`.

### PayU refunds
`POST /payments/payu/refund` (SCHOOL_ADMIN/PRINCIPAL only) calls PayU's v1
`cancel_refund_transaction` API (same key/salt as checkout). PayU accepts the
request synchronously (`Payment.status → REFUND_PENDING`) and confirms actual
completion asynchronously via the refund webhook — PayU's refund/dispute
webhook payloads carry **no hash** (confirmed against PayU's own docs), so
authenticity is enforced structurally instead: a refund webhook can only
resolve a Payment that's genuinely `REFUND_PENDING` with a matching
`refund_token` this app generated itself.

### PayU dashboard webhook setup
In the PayU merchant dashboard: **Developers → Webhooks → Create Webhook**.
Two separate webhooks, both `Type: Payments`:

| Event(s) | Webhook URL |
|---|---|
| Successful, Failed | `{BACKEND_BASE_URL}/api/v1/payments/payu/webhook` |
| Refund | `{BACKEND_BASE_URL}/api/v1/payments/payu/webhook/refund` |

`BACKEND_BASE_URL` **must be a publicly reachable URL** — PayU's servers call
these from the internet, so `http://localhost:8010` only works for local
testing via a tunnel (e.g. `ngrok http 8010`), never for a real deployment.

`PAYU_CLIENT_ID`/`PAYU_CLIENT_SECRET` (OAuth) are stored in config but not
used by checkout, callback, webhook, or refund — those all authenticate with
`PAYU_MERCHANT_KEY`/`PAYU_MERCHANT_SALT` per PayU's own docs. The OAuth
client credentials are for a separate PayU API family (e.g. Payouts) that
this app doesn't currently integrate.

Explicitly out of scope for v1: library, transport, hostel, inventory, HR &
payroll, a school knowledge-base/RAG document Q&A layer, and SMS/push
notification delivery.
# school-erp
# school-erp
