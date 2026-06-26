# Deploying the Kivo backend

The Kivo backend is an Express + Firebase Admin + Redis/BullMQ + Socket.IO app. It
runs in two distinct shapes:

1. **Serverless (Vercel)** — the HTTP API only. Stateless, request/response.
2. **Persistent host (Railway / Render / Fly / a VM)** — the full system, including
   the long-running pieces Vercel cannot run (background workers, real-time sockets,
   cron-style schedulers).

---

## 1. Vercel (serverless HTTP API)

### How it works

- `api/index.ts` is the function entrypoint. It imports the **compiled** app from
  `../dist/app` and `export default`s the Express instance. It never calls
  `app.listen()`.
- It imports `dist/`, **not** `src/` and **not** `@/`-aliased paths. Vercel's
  `@vercel/node` bundles functions with esbuild, which does **not** resolve the
  project's `@/*` TypeScript path aliases at runtime. `npm run build`
  (`tsc` + `tsc-alias`) emits `dist/**` with every alias rewritten to a real
  relative path, so the compiled output is safe to `require`.
- `vercel.json`:
  - `buildCommand: "npm run build"` generates `dist/**` in the build step.
  - `functions["api/index.ts"].includeFiles: "dist/**"` ships the compiled output
    alongside the function so `require('../dist/app')` resolves at runtime.
  - `rewrites` route **every** path (`/(.*)`) to `/api/index`, so `/health`,
    `/health/ready`, and `/api/v1/*` all hit the single function.

`dist/` is git-ignored on purpose — Vercel rebuilds it from source on every deploy.

### Required environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (Production,
and Preview if you use preview deploys).

| Variable               | Required | Notes |
| ---------------------- | -------- | ----- |
| `FIREBASE_PROJECT_ID`  | Yes\*    | Firebase / GCP project id. |
| `FIREBASE_CLIENT_EMAIL`| Yes\*    | Service-account client email. |
| `FIREBASE_PRIVATE_KEY` | Yes\*    | Service-account private key. **Preserve the newlines** — paste the full key including `-----BEGIN PRIVATE KEY-----` … `-----END PRIVATE KEY-----`. If your value uses literal `\n` sequences instead of real newlines, that is fine: the app converts `\n` → real newlines at load. |
| `JWT_ACCESS_SECRET`    | Yes      | ≥ 16 chars. Signs short-lived access tokens. |
| `JWT_REFRESH_SECRET`   | Yes      | ≥ 16 chars. Signs long-lived refresh tokens. |
| `NODE_ENV`             | Recommended | Set to `production`. |
| `CORS_ORIGINS`         | Recommended | Comma-separated allowed origins, e.g. `https://app.kivo.com,https://kivo.com`. Empty = reflect any origin. |
| `REDIS_URL`            | Optional | Upstash (or any) Redis connection string, e.g. `rediss://default:<password>@<host>:6379`. Enables the distributed rate limiter and lets the API enqueue background jobs. **Without it the API still works** — the rate limiter falls back to in-memory and job enqueues are skipped (logged as warnings). |
| `R2_ACCOUNT_ID`        | Optional | Cloudflare R2 (uploads). |
| `R2_ACCESS_KEY_ID`     | Optional | Cloudflare R2. |
| `R2_SECRET_ACCESS_KEY` | Optional | Cloudflare R2. |
| `R2_BUCKET`            | Optional | Defaults to `kivo-uploads`. |
| `R2_PUBLIC_BASE_URL`   | Optional | Public base URL for served objects. |

\* **Firebase is loaded lazily.** The function boots and serves `GET /health` even
with **no** Firebase credentials. Any route that touches Firestore returns a clean
`503 SERVICE_UNAVAILABLE` until the three `FIREBASE_*` vars are set. So Firebase is
"required" for the API to be useful, but its absence will not crash the function.

> Do **not** set `FIREBASE_SERVICE_ACCOUNT_PATH` on Vercel — there is no persistent
> filesystem to read a JSON file from. Use the three inline `FIREBASE_*` vars.

### Verifying a deploy

```bash
curl -i https://<your-deployment>.vercel.app/health          # 200, zero external deps
curl -i https://<your-deployment>.vercel.app/health/ready    # 200 if Redis+Firestore reachable, else 503
curl -i https://<your-deployment>.vercel.app/api/v1/notes    # 401 (auth required) — proves routing works
```

`GET /health` returns 200 with **no** external dependencies — it never touches
Redis, Firestore, or any secret.

---

## 2. What Vercel serverless does NOT run

Vercel functions are short-lived and stateless. They cannot host the parts of Kivo
that need a process that stays alive between requests:

- **BullMQ workers** (`npm run start:worker`) — consume queued jobs (revision
  reminders, push notifications, weekly reports, streak recalculation, token
  cleanup).
- **Repeatable/cron schedulers** (`registerSchedules()` in `src/server.ts`) — the
  15-minute revision sweep and the daily/weekly cron jobs.
- **Socket.IO** real-time channel — needs a persistent connection-bearing server.

On Vercel these are inert by design: socket `emit*` helpers no-op when no server is
running, and `enqueue*` helpers no-op (and warn) when Redis is unconfigured.

To run them, deploy this same repo to a **persistent host** (Railway, Render, Fly,
or any VM/container), or move the scheduled work to **Vercel Cron** hitting dedicated
HTTP endpoints. A typical split:

- **Vercel** → the HTTP API (this serverless setup).
- **Persistent host** → `npm run start:worker` (the worker) and, if you want
  real-time + schedulers, `npm run start` (the full server, which also serves HTTP
  and runs Socket.IO + `registerSchedules()`).

Both shapes share the same `dist/`, the same env vars above, plus the BullMQ/Redis
tuning vars (`BULLMQ_PREFIX`, `BULLMQ_CONCURRENCY`, `REDIS_*`). The worker and the
schedulers require `REDIS_URL` (or the discrete `REDIS_HOST`/`REDIS_PORT`/
`REDIS_PASSWORD`/`REDIS_TLS`) to be set.

---

## 3. Local development

```bash
cp .env.example .env      # fill in real values
npm install
npm run dev               # API server (src/server.ts) on http://localhost:8080
npm run dev:worker        # in a second terminal — BullMQ workers
```

`npm run dev` / `npm run start` use the persistent-host entrypoint (`src/server.ts`),
which keeps the listener, Socket.IO, and schedulers running. That path is unchanged
by the serverless setup.
