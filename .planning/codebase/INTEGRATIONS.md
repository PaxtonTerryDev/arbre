# External Integrations

**Analysis Date:** 2026-03-05

## APIs & External Services

No third-party external APIs or SaaS services are integrated. The system is self-contained: the `arbre` library posts logs to the self-hosted `apps/api` ingest endpoint.

## Data Storage

**Databases:**
- PostgreSQL 17 (alpine)
  - Connection: `DATABASE_URL` environment variable (e.g., `postgres://arbre:arbre@postgres:5432/arbre`)
  - Client: `postgres` npm package ^3.4.5 (raw SQL, no ORM)
  - Adapter: `apps/api/src/storage/postgres.ts` — implements `StorageAdapter` interface from `apps/api/src/storage/index.ts`
  - Schema: single `logs` table auto-created via `init()` on startup; columns: `id`, `timestamp`, `level`, `message`, `app`, `scope` (JSONB), `payload` (JSONB)
  - Indexes: `idx_logs_timestamp` (DESC), `idx_logs_level`, `idx_logs_app`
  - Dev instance: `docker-compose.yml` at repo root, port `5432`

**File Storage:**
- Local filesystem only — no cloud object storage

**Caching:**
- None

## Authentication & Identity

**Auth Provider:**
- None — no authentication on the ingest API or web dashboard

## Monitoring & Observability

**Error Tracking:**
- None

**Logs:**
- Fastify built-in logger enabled when `NODE_ENV !== "test"` (`apps/api/src/server.ts`)
- `arbre` core library used for structured logging in `apps/api` and `apps/demo`

## CI/CD & Deployment

**Hosting:**
- API: Docker container via `apps/api/Dockerfile` (multi-stage, `node:22-alpine`)
- Web: Compatible with Vercel (`.vercel/**` listed in Turborepo build outputs)
- Orchestration: `docker-compose.yml` runs `postgres` + `api` services for development/production

**CI Pipeline:**
- None detected

## Environment Configuration

**Required env vars (API):**
- `DATABASE_URL` — PostgreSQL connection string; no default, empty string if unset
- `PORT` — HTTP port; defaults to `3000`
- `HOST` — Bind address; defaults to `0.0.0.0`
- `NODE_ENV` — Runtime environment; defaults to `development`

**No `.env` files** are present in the repository. Configuration is injected via environment at runtime or via `docker-compose.yml` for local dev.

## Webhooks & Callbacks

**Incoming:**
- `POST /ingest` — Accepts log payloads from instrumented applications; not a webhook but serves the same ingestion role

**Outgoing:**
- None

---

*Integration audit: 2026-03-05*
