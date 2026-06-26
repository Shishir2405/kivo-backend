# Kivo — Backend

The backend service for **Kivo**, a student productivity & learning platform. It owns business
logic, the **Smart Revision Engine**, background processing, push-notification orchestration, real-time
events, and file storage. Firestore remains the system of record; this service is the brain on top of it.

Built the way a senior engineer would: **layered architecture**, strict TypeScript, validated config,
typed errors, structured logging, and a clean separation between transport, business, and data layers.

---

## Tech stack

| Concern            | Technology                                      |
| ------------------ | ----------------------------------------------- |
| Runtime / language | Node.js 20, TypeScript (strict)                 |
| HTTP framework     | Express 4                                       |
| Data / system of record | Cloud Firestore (Firebase Admin SDK)       |
| Auth               | Firebase Authentication + backend JWT sessions  |
| Cache / queues     | Redis (ioredis)                                 |
| Background jobs    | BullMQ (queues, workers, repeatable schedulers) |
| Real-time          | Socket.IO                                        |
| Push notifications | Firebase Cloud Messaging (FCM)                  |
| File storage       | Cloudflare R2 (S3-compatible)                   |
| Validation         | Zod                                             |
| Logging            | Pino                                            |

---

## Architecture (layered)

```
HTTP request
   │
   ▼
routes/         ── declare endpoints, attach middleware
   │
   ▼
middleware/     ── auth, validation, rate-limit, logging, error handling
   │
   ▼
controllers/    ── parse request → call service → shape HTTP response
   │
   ▼
services/       ── business logic, orchestration, transactions, job enqueues
   │
   ▼
repositories/   ── data access only (Firestore reads/writes)
   │
   ▼
firebase/       ── Firestore + Admin SDK clients
```

Cross-cutting infrastructure lives in its own folders: `jobs/` (BullMQ), `notifications/` (FCM),
`socket/` (Socket.IO), `storage/` (R2), `config/`, `utils/`, `constants/`, `types/`, `validators/`.

A controller never touches Firestore directly; a repository never contains business rules. Each
domain module is a vertical slice (validator → controller → service → repository → route).

### Project structure

```
src/
 ├── config/          env validation, redis, singletons
 ├── constants/       enums, spaced-repetition intervals, http
 ├── types/           shared TS types + Express augmentation
 ├── utils/           logger, ApiError, ApiResponse, asyncHandler, pagination, dates
 ├── firebase/        Admin SDK init, Firestore, auth helpers
 ├── middleware/      auth, error, validate, rateLimiter, requestLogger, notFound
 ├── repositories/    base Firestore repository (generic CRUD)
 ├── storage/         Cloudflare R2 client + presigned uploads
 ├── notifications/   FCM sender + message templates
 ├── socket/          Socket.IO server + authenticated rooms
 ├── jobs/            BullMQ connection, queues, workers, scheduler, worker entrypoint
 ├── modules/         domain modules (auth, users, revisions, dsa, tasks, notes)
 ├── routes/          top-level API router registry
 ├── app.ts           Express app assembly
 └── server.ts        bootstrap + graceful shutdown
```

> The PRD's flat `controllers/ services/ ...` layout is realised here as **per-feature modules** so each
> domain owns its full vertical slice — the same layers, grouped by feature instead of by file-type.
> This is the modern senior default; it scales far better as the feature set grows.

---

## Getting started

```bash
cd backend
cp .env.example .env          # fill in Firebase / Redis / R2 values
npm install

# start Redis (or use docker compose up redis)
npm run dev                   # API with hot reload
npm run dev:worker            # BullMQ worker (separate process)
```

### Useful scripts

| Script              | Purpose                              |
| ------------------- | ------------------------------------ |
| `npm run dev`       | API server with hot reload (tsx)     |
| `npm run dev:worker`| BullMQ worker process with hot reload|
| `npm run build`     | Compile to `dist/`                   |
| `npm start`         | Run compiled API                     |
| `npm run typecheck` | `tsc --noEmit`                       |
| `npm run lint`      | ESLint                               |
| `npm run format`    | Prettier write                       |
| `npm test`          | Vitest                               |

### Docker

```bash
docker compose up --build     # api + worker + redis
```

---

## Smart Revision Engine

The flagship feature. When a user completes a topic/problem, the service computes a spaced-repetition
schedule (default `D+3, 7, 15, 30, 60, 90`), persists each revision, and enqueues a **delayed BullMQ
job** per revision. When a job fires, the worker re-checks the revision is still due, sends an FCM push,
emits a Socket.IO event, and records delivery. Confidence ratings (`easy/medium/hard`) adapt the next
interval. See [src/modules/revisions](src/modules/revisions) and [src/jobs](src/jobs).

---

## Health & ops

- `GET /health` — liveness (process up)
- `GET /health/ready` — readiness (Redis + Firestore reachable)
- Graceful shutdown drains the HTTP server, BullMQ workers, Redis, and Socket.IO on `SIGTERM`/`SIGINT`.
