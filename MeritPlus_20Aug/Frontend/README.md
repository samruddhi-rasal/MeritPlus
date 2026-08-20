# Resume & Cover Letter Generator — backend + auth

Implements the JWT-only auth design (no refresh tokens) in front of your existing
n8n `searchJobs` / `generateResume` workflows, and keeps your existing HTML/CSS/JS
dashboard functionality intact. **No database** — all data (users, sessions,
password reset tokens, application history) lives in tabs of a single Google
Sheet, read and written through the Sheets API. Deploys to Vercel as serverless
functions, and also runs as a normal Express server locally.

## Project structure

```
api/
  auth/[...path].js       -> serverless function for /api/auth/*
  jobs/[...path].js       -> serverless function for /api/jobs/*
  history/[...path].js    -> serverless function for /api/history/*
src/
  routes/                 -> route logic (shared by Vercel + local server)
  middleware/authenticate.js
  sheets/
    client.js              -> Google Sheets auth + generic get/append/update-row
    helpers.js              -> row array <-> object conversion
    usersRepo.js             -> replaces the `users` table
    sessionsRepo.js          -> replaces the `user_sessions` table
    passwordResetsRepo.js    -> replaces the `password_reset_tokens` table
    historyRepo.js           -> replaces the `application_history` table
  server.js                -> local dev entry point only (not used by Vercel)
scripts/setup-sheet.js     -> one-time script that creates the tabs + headers
public/                    -> static frontend, served automatically by Vercel
vercel.json                -> per-function timeout settings
```

## How the "no database" part works

One Google Sheet acts as the whole datastore, with **one tab per table**:

| Tab              | Replaces               | Columns |
|-------------------|-------------------------|---------|
| `Users`            | `users`                 | id, first_name, last_name, email, password_hash, is_active, created_at |
| `Sessions`         | `user_sessions`         | id, user_id, session_id, ip_address, user_agent, created_at, expires_at, logged_out_at |
| `PasswordResets`   | `password_reset_tokens` | id, user_id, token_hash, created_at, expires_at, used_at |
| `History`          | `application_history`   | id, user_id, session_id, company_name, job_title, location, apply_link, resume_url, cover_letter_url, resume_content, cover_letter_content, generated_at |

`src/sheets/client.js` has three generic operations — `getRows`, `appendRow`,
`updateRow` — and each `*Repo.js` file builds the specific lookups each route
needs on top of them (e.g. "find user by email" = read all rows in `Users`,
filter in code). IDs are UUIDs (`crypto.randomUUID()`) instead of
auto-increment integers, since a spreadsheet has no such concept.

This is genuinely free and needs no database server, but it's worth being
upfront about the trade-off: every read scans the whole tab, and every write is
a separate API call. Fine for personal use / light traffic; not something you'd
want under heavy concurrent load.

## One-time Google Sheets setup

1. Go to [Google Cloud Console](https://console.cloud.google.com), create a
   project (or reuse one), then enable the **Google Sheets API** for it
   (APIs & Services → Enable APIs → search "Google Sheets API").
2. Create a **Service Account** (APIs & Services → Credentials → Create
   Credentials → Service Account). Give it any name.
3. Open the service account, go to **Keys → Add Key → Create new key → JSON**,
   and download it. Inside the JSON you'll find `client_email` and
   `private_key` — those become `GOOGLE_SERVICE_ACCOUNT_EMAIL` and
   `GOOGLE_PRIVATE_KEY` in your `.env`.
4. Create a new, empty Google Sheet in your normal Google account. Click
   **Share** and share it with the service account's email (the
   `client_email` value) as an **Editor**. This step is required — the
   service account can't see the sheet otherwise.
5. Copy the Sheet ID out of its URL: `https://docs.google.com/spreadsheets/d/THIS_PART_HERE/edit`
   — that's `GOOGLE_SHEET_ID`.
6. Fill in `.env` (see `.env.example`), then run:
   ```bash
   npm install
   npm run setup-sheet
   ```
   This creates the four tabs and writes their header rows automatically.

## What changed vs. your original frontend

- The dashboard (`public/index.html`) now requires login and calls **your own backend**
  (`/api/jobs/search`, `/api/jobs/generate-resume`) instead of calling the n8n webhooks
  directly. The backend forwards those requests to n8n unchanged, then logs the result
  to the `History` tab against the logged-in user's session.
- Added `login.html`, `register.html`, `forgot-password.html`, `reset-password.html`.
- Added a "Download History" button that streams a freshly generated `.xlsx` built
  from the `History` tab — nothing is written to disk, and JWTs are never included.
  (This is a separate, on-demand export file — unrelated to the Google Sheet used
  for storage.)
- No email service — `forgot-password` returns the reset link directly in the
  response instead of sending it anywhere.

## Deploying to Vercel

1. Push this folder to a GitHub repo, then import it in Vercel ("Add New Project").
   Vercel will detect `/api` and `/public` automatically — no build command needed.
2. In the Vercel project's **Settings → Environment Variables**, add every variable
   from `.env.example`: `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
   `GOOGLE_PRIVATE_KEY` (paste it including the `\n` escape sequences exactly as
   they appear in the JSON key file — don't reformat it), `JWT_SECRET`,
   `N8N_SEARCH_JOBS_URL`, `N8N_GENERATE_RESUME_URL`, etc. Set `FRONTEND_URL` to
   your Vercel domain once you know it (e.g. `https://your-app.vercel.app`).
3. Deploy. `login.html`, `index.html`, etc. are served directly from `/public`;
   `/api/auth/login`, `/api/jobs/search`, etc. hit the serverless functions.

### A real limitation worth knowing

Vercel serverless functions have a hard execution timeout — 10s on the Hobby plan,
up to 60s by default on Pro (configurable higher, up to 300s on Pro / 800s with
Fluid Compute, more on Enterprise). `vercel.json` here already raises the `jobs`
function to 60s, but if your n8n `searchJobs` or `generateResume` workflows
genuinely take several minutes (your original frontend allowed up to ~16 minutes
for search), **that will still time out on Vercel**, no matter how the timeout is
configured, once you exceed your plan's ceiling.

If that turns out to be the case in practice, the fix isn't more Vercel
configuration — it's changing the shape of the request: e.g. have `/api/jobs/search`
kick off the n8n workflow and return immediately with a job ID, have n8n write
results to a sheet (or call back to a webhook) when done, and have the frontend
poll `/api/jobs/status/:id` until results are ready. Worth testing your real
workflow's timing against a deployed function before assuming it's fine.

## Local development

1. `npm install`
2. Complete the Google Sheets setup above, including `npm run setup-sheet`.
3. Copy `.env.example` to `.env` and fill in the Google Sheets credentials and
   `JWT_SECRET` (a long random string).
4. `npm start` — serves the API and the frontend together on `http://localhost:3000`.

## Notes

- No email service is used. `POST /api/auth/forgot-password` generates the reset
  token and returns the reset URL directly in the JSON response; the "Forgot
  password" page displays it as a clickable link on screen instead of sending it
  anywhere. This means the response also reveals whether an email is registered
  (a 404 if not) — a reasonable trade-off for a no-email setup, but worth
  reconsidering if this app is ever exposed publicly.
- No refresh tokens exist anywhere in this codebase, per the original design doc:
  no table, no endpoint, no cookie, no field on `Sessions`. JWTs expire after
  `JWT_EXPIRES_IN` (default 1h) and the user simply logs in again.
- `req.user.id`, taken from the verified JWT, is the only source of truth for "whose
  history/session is this" — nothing from the request body or query string is trusted
  for authorization.
- The JWT is stored in `localStorage` for simplicity (see comment in
  `public/js/auth-client.js`). If you later move this behind a real domain with the
  frontend and backend on the same site, switching to an HttpOnly Secure cookie is a
  worthwhile hardening step.
- The Google Sheets API has generous free-tier rate limits (read/write quotas per
  minute) that are unlikely to matter for personal use, but would become a real
  constraint if this app ever got meaningful concurrent traffic.
