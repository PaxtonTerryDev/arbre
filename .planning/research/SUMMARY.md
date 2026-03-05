# Project Research Summary

**Project:** Arbre
**Domain:** Node.js structured logging library + self-hosted log aggregator (Turborepo monorepo)
**Researched:** 2026-03-05
**Confidence:** HIGH

## Executive Summary

Arbre is a self-contained structured logging ecosystem: a composable library (`packages/arbre`), an HTTP ingest API (`apps/api`), and a log browser dashboard (`apps/web`), all sharing a Postgres database via `packages/database`. The architecture is already well-formed — the layer pipeline, Fastify ingest endpoint, Prisma schema, and Next.js dashboard shell exist. What is missing is the connective tissue that makes the system end-to-end functional: the HTTP transport layer that sends logs from the library to the API, the Prisma storage adapter that persists them, the in-memory queue that decouples ingest latency from DB write latency, the GET endpoint the dashboard needs to read logs, and the npm publish configuration.

The recommended approach is to build in dependency order: wire Prisma persistence first (it unblocks everything downstream), then layer on the async HTTP transport and API queue together (they close the write path), then build the dashboard read path (GET endpoint + log browser), then add the standalone layers (file output, sampling), and finally prepare for npm publish. This order avoids building UI against a read path that doesn't exist and avoids shipping the HTTP transport before the API can persist what it receives.

The primary risk category is async correctness: fire-and-forget HTTP transport without `.catch()` handlers, in-memory queues without size caps, and process exit without flushing all produce silent log loss that is invisible in development. Every async boundary in this system — HTTP layer flush, queue drain, file stream errors — requires explicit error handling from day one. These are not polish items; omitting them causes data loss and process crashes in production.

## Key Findings

### Recommended Stack

The existing stack (Fastify 5, Next.js 16, Prisma, TypeScript strict, bunchee, tsdown, Turborepo) covers all needs. Two new libraries are required: `fastq@^1.20.1` in `apps/api` for the in-memory ingest queue, and `pino-roll@^4.0.0` in `packages/arbre` for the file rotation layer. Native Node 18+ `fetch` handles HTTP transport with no additional dependency. `pino-abstract-transport` is explicitly NOT used — it is designed for pino's worker_thread pipeline and is the wrong abstraction for Arbre's synchronous `Layer` interface.

**Core technologies:**
- `fastq`: In-memory ingest queue — made by the Fastify author (mcollina), ships its own types, provides backpressure primitives (`pause()`/`resume()`, `drain`) at zero dependency cost
- `pino-roll`: File rotation layer — SonicBoom-backed async writes, handles size and time-based rotation, officially maintained in the pino ecosystem
- Node built-in `fetch`: HTTP transport — available since Node 18 (this project targets `>=18`); no additional dependency warranted

### Expected Features

**Must have (table stakes):**
- HTTP transport layer (async, non-blocking) — closes the library → API loop; core value prop is broken without it
- Prisma adapter wired to Postgres — persistent logs are a prerequisite for any dashboard value
- GET /logs endpoint with level + scope + time range filters — dashboard cannot function without a read path
- Paginated log browser in dashboard — minimum viable log viewing UI
- In-memory queue in API — decouples ingest HTTP latency from DB write latency
- File output layer with rotation — disk persistence is table stakes for any logger
- npm publish of `packages/arbre` as v0.x — library must be installable to have real users

**Should have (competitive):**
- Sampling/rate-limiting layer — prevents high-volume callers from overwhelming the DB; Arbre's composable pipeline makes this a natural fit
- Scoped child logger API — request-scoped context is standard in pino/winston; `scope` field already threads through the system
- Log detail view (expanded payload) — add after log browser is shipped and used
- Full-text search on `message` field — meaningful diagnostic value once browsing is working

**Defer (v2+):**
- Real-time WebSocket/SSE log streaming — polling at 5–10s gives 90% of the UX; WebSocket adds persistent connection management and auth complexity
- Alerting and notification delivery — easily becomes a separate product; high ongoing maintenance cost
- Aggregate metric dashboards — competes with Grafana; not worth building until users are captive in Arbre
- Multi-tenancy / access control — single-org self-hosted is the target for v1
- External queue (Redis/BullMQ) — in-memory queue with documented durability trade-offs is honest and appropriate for v1

### Architecture Approach

The system has a clean three-tier write path (library → API queue → Postgres) and a direct read path (dashboard → Postgres via Prisma). The key architectural rule is that no layer awaits I/O in the hot path: `packages/arbre` returns logs synchronously, the HTTP layer flushes in the background, and the API route responds 202 before any DB write occurs. Both `apps/api` and `apps/web` share a single `PrismaClient` singleton via `packages/database` — this is the correct pattern for a Turborepo monorepo and must not be changed to per-app or per-request instantiation.

**Major components:**
1. `HttpLayer` (`packages/arbre`) — internal buffer + `setTimeout` flush loop; `fetch` to `/ingest`; fire-and-forget with `.catch()` required
2. `IngestQueue` (`apps/api`) — `fastq` queue; route handler enqueues and replies 202; drain loop calls `storage.insertMany(batch)`
3. `PrismaStorageAdapter` (`apps/api`) — replaces current `PostgresStorageAdapter`; wraps `db` from `packages/database`; no runtime DDL
4. `packages/database` — Prisma singleton with `globalThis` guard; schema managed via `prisma migrate`; shared by API and web
5. GET /logs route (`apps/api`) — new read endpoint; level + scope + time range filters; required by dashboard
6. Log browser (`apps/web`) — paginated log list via server components; reads from Postgres via `packages/database`

### Critical Pitfalls

1. **Unhandled promise rejection in HTTP transport** — every `fetch` call in the HTTP layer must be wrapped in `.catch()` or it crashes the process (Node 15+) or silently loses logs. No bare fire-and-forget.

2. **Logs lost on process exit** — the HTTP layer buffer and API queue must be drained before the process exits. Expose `arbre.flush()` and wire it to Fastify's `onClose` hook. SIGTERM handler alone is insufficient for tests.

3. **Unbounded queue causes OOM** — the in-memory queue must have a hard `MAX_QUEUE_SIZE` cap. When full, `/ingest` must return `429`, not `202`. Without this, any DB hiccup causes runaway memory growth and an OOM-killed process.

4. **Queue flush timer leaks in tests** — `setInterval` inside the queue must be cleared in a `stop()` method called from Fastify's `onClose` hook. Failure produces Jest hangs requiring `--forceExit`, which masks real issues.

5. **Prisma client per hot-reload exhausts Postgres connections** — `packages/database` already implements the `globalThis` guard correctly. Do not move PrismaClient instantiation to consuming apps; preserve the singleton in the shared package.

6. **Dual package hazard breaks the Arbre singleton** — if both CJS and ESM outputs of `packages/arbre` are loaded in the same process, `Arbre._instance` exists twice. Layers added in one context are invisible to the other. Add a `globalThis` detection guard before npm publish.

## Implications for Roadmap

Based on the dependency graph and pitfall-to-phase mapping from research, the recommended phase structure is:

### Phase 1: Prisma Persistence Wiring
**Rationale:** Everything downstream depends on logs being persisted. The dashboard cannot read, the end-to-end demo cannot work, and the HTTP transport is useless without storage. This is the single highest-leverage unblocking phase.
**Delivers:** Working Postgres persistence via Prisma; `PrismaStorageAdapter` replacing the raw SQL adapter; schema owned by `prisma migrate` (no more runtime DDL); `packages/database` wired into `apps/api`.
**Addresses:** Prisma adapter wired to Postgres (P1 feature); removes runtime DDL anti-pattern.
**Avoids:** Prisma client per hot-reload (Pitfall 5); runtime DDL divergence from schema.prisma (Pitfall in anti-patterns).

### Phase 2: HTTP Transport Layer + API In-Memory Queue
**Rationale:** These two components form the write path and must ship together — the HTTP transport is useless without a functioning API queue, and the queue adds no value until the library can send logs. Together they close the library → API → DB loop for the first time.
**Delivers:** End-to-end log flow: `arbre.info()` in a consumer app results in a persisted row in Postgres. Async 202 ingest with backpressure. Non-blocking log calls in the library.
**Uses:** `fastq@^1.20.1` for queue; native `fetch` for HTTP transport.
**Implements:** `HttpLayer` with internal buffer + flush loop; `IngestQueue` with `fastq`; `MAX_QUEUE_SIZE` cap with 429 response; `flush()` on shutdown.
**Avoids:** Pitfall 1 (unhandled fetch rejection), Pitfall 2 (logs lost on exit), Pitfall 3 (unbounded queue OOM), Pitfall 4 (timer leak in tests).

### Phase 3: Dashboard Read Path
**Rationale:** The dashboard shell exists but cannot display real logs because there is no GET endpoint. This phase makes the product observable — a developer can instrument their app, run it, and see logs in the UI.
**Delivers:** `GET /logs` API endpoint with level + scope + time range filters; paginated log browser in `apps/web`; newest-first sort; payload display.
**Addresses:** GET /logs (P1 feature); paginated log browser (P1 feature); filter by level/scope/time range (table stakes dashboard features).
**Avoids:** `SELECT *` on large tables (add composite index on `(timestamp DESC, level)` in this phase).

### Phase 4: File Output Layer + Sampling Layer
**Rationale:** These are standalone additions to `packages/arbre` that do not depend on the API or dashboard. They are best added after the write path is proven, so the layer interface is stable. They can ship together since both are contained within the library package.
**Delivers:** `FileLayer` with `pino-roll` rotation; `SampleLayer` with configurable rate (0–1 drop probability).
**Uses:** `pino-roll@^4.0.0` for file rotation.
**Implements:** `FileLayer` with `fs.mkdirSync` directory auto-creation; stream `error` event handler; `close()` method. `SampleLayer` in ~10 lines.
**Avoids:** Pitfall 8 (file layer silent failure on missing directory or stream errors).

### Phase 5: npm Publish
**Rationale:** Publishing `packages/arbre` as v0.x is what turns this from a private monorepo component into a usable library. All layers must be stable before publishing to avoid breaking API changes on public consumers.
**Delivers:** `packages/arbre` published to npm as v0.x; verified `exports` map with `types` condition first; CI check for TypeScript consumers on `moduleResolution: bundler`.
**Avoids:** Pitfall 6 (dual package hazard); Pitfall 7 (missing `types` export condition).

### Phase Ordering Rationale

- Prisma first because it is a blocking dependency for all persistence-dependent work (API queue writes, dashboard reads, end-to-end demo).
- HTTP transport and API queue together because they are a unit — neither delivers value in isolation and they share the critical async error handling requirements that must be addressed as a set.
- Dashboard read path after the write path is proven, so there are real logs to display during development.
- Standalone layers (file, sampling) after the core pipeline is stable, to avoid wiring new layers against an interface that might still change.
- npm publish last, after all layers are stable and the full system is proven end-to-end.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (npm publish):** ESM/CJS dual package configuration with bunchee and the `exports` map has known edge cases; worth a focused research pass on the dual package hazard guard implementation before execution.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Prisma wiring):** Well-documented monorepo Prisma pattern; `globalThis` singleton and `prisma migrate` are canonical.
- **Phase 2 (HTTP transport + queue):** Both patterns (buffer+flush, fastq queue with drain) are well-documented in official sources with concrete examples already in ARCHITECTURE.md.
- **Phase 3 (dashboard read path):** Standard Next.js server component + Prisma query pattern; no novel integration.
- **Phase 4 (file + sampling layers):** `pino-roll` API is straightforward; sampling is ~10 lines of pure logic.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | npm versions verified against registry 2026-03-05; patterns verified against official repos (fastq, pino-roll) |
| Features | HIGH (library), MEDIUM (dashboard) | Library feature landscape is well-established; dashboard feature prioritization is inference from competitive analysis |
| Architecture | HIGH | Patterns sourced from official Prisma monorepo guide, pino transport docs, and existing codebase analysis |
| Pitfalls | HIGH (async, queue, ESM/CJS), MEDIUM (Prisma monorepo) | Async transport and queue pitfalls are well-documented with case studies; Prisma monorepo edge cases are community-sourced |

**Overall confidence:** HIGH

### Gaps to Address

- **`app` field mapping:** PITFALLS.md flags that the `app` field is always null in the DB — the `App` layer sets `payload.app` but the adapter reads top-level `app`. This is a data correctness bug that must be fixed in Phase 1 (Prisma wiring) before any logs are considered valid.
- **Auth on `/ingest`:** No auth currently exists on the ingest endpoint. PITFALLS.md flags this as a security issue. Determine during Phase 2 planning whether API key validation is in scope for v1 or deferred.
- **CORS restriction:** `origin: true` is currently set. Should be locked to a configurable origin list before any non-local deployment.

## Sources

### Primary (HIGH confidence)
- [mcollina/fastq GitHub](https://github.com/mcollina/fastq) — API, benchmarks, concurrency model
- [pino-roll npm](https://www.npmjs.com/package/pino-roll) — rotation options, current version
- [Node.js modules — Dual package hazard](https://nodejs.org/api/packages.html#dual-package-hazard) — ESM/CJS singleton risk
- [Prisma documentation — Database connections](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections) — singleton pattern
- [Prisma monorepo guide](https://www.prisma.io/docs/guides/use-prisma-in-pnpm-workspaces) — Turborepo integration
- npm registry version checks (2026-03-05): `pino-roll@4.0.0`, `fastq@1.20.1`

### Secondary (MEDIUM confidence)
- [Better Stack: Top 8 Node.js Logging Libraries](https://betterstack.com/community/guides/logging/best-nodejs-logging-libraries/) — feature landscape
- [Better Stack: Pino vs Winston](https://betterstack.com/community/comparisons/pino-vs-winston/) — competitive feature comparison
- [AppSignal: Next.js monorepo with Prisma](https://blog.appsignal.com/2025/11/26/manage-a-nextjs-monorepo-with-prisma.html) — Turborepo Prisma wiring
- [Trendyol Tech: Memory ran out in Node.js app](https://medium.com/trendyol-tech/everything-looked-fine-until-memory-ran-out-in-our-node-js-app-cae5ba587c92) — unbounded queue OOM case study
- [Prisma GitHub Discussion #19444](https://github.com/prisma/prisma/discussions/19444) — multiple packages using Prisma in monorepo

### Tertiary (LOW confidence)
- [SigNoz: Top 8 Open Source Log Management Tools](https://signoz.io/blog/open-source-log-management/) — competitive positioning (dashboard feature set inferences)

---
*Research completed: 2026-03-05*
*Ready for roadmap: yes*
