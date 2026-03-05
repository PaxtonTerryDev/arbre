# Architecture Research

**Domain:** Self-hosted structured logging system — library + ingestion API + dashboard
**Researched:** 2026-03-05
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Consumer Apps                          │
│  ┌─────────────────────────────────────────────────────┐    │
│  │   packages/arbre  (logger singleton + layer chain)  │    │
│  │   info() → dispatch() → Layer[] → HttpLayer         │    │
│  └───────────────────────┬─────────────────────────────┘    │
└──────────────────────────┼──────────────────────────────────┘
                           │ POST /ingest (async, batched)
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                        apps/api                             │
│  ┌───────────┐     ┌──────────────┐     ┌───────────────┐   │
│  │  Fastify  │────▶│ IngestQueue  │────▶│StorageAdapter │   │
│  │  /ingest  │     │ (in-memory)  │     │  (Prisma)     │   │
│  └───────────┘     └──────────────┘     └───────┬───────┘   │
└────────────────────────────────────────────────┼────────────┘
                                                 │
┌────────────────────────────────────────────────┼────────────┐
│                   packages/database             │            │
│  ┌──────────────────────────────────────────────┘           │
│  │   PrismaClient singleton (globalThis guard)              │
│  │   schema.prisma → arbre.log table                        │
│  └──────────────────────────────┬───────────────────────────┘
└─────────────────────────────────┼───────────────────────────┘
                                  │
┌─────────────────────────────────┼───────────────────────────┐
│                      Postgres                                │
│                    arbre.log table                           │
└─────────────────────────────────────────────────────────────┘
                                  ↑
┌─────────────────────────────────┼───────────────────────────┐
│                        apps/web                              │
│  ┌──────────────────────────────┘                           │
│  │   Server components → db (Prisma) → log browser          │
│  └──────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Boundary |
|-----------|----------------|----------|
| `packages/arbre` | Logging pipeline, layer composition, public API | No network calls; pure in-process |
| `HttpLayer` (new) | Non-blocking HTTP dispatch to `/ingest` | Batches logs, fire-and-forget, never throws to caller |
| `apps/api` | HTTP ingest endpoint, schema validation, queue management | Owns the write path to DB |
| `IngestQueue` (new) | Decouple HTTP receipt from DB write; buffer and drain | In-process only; no external broker |
| `PrismaStorageAdapter` (new) | Wraps `packages/database` `db` client; implements `StorageAdapter` | Replaces raw `postgres` driver adapter |
| `packages/database` | Prisma schema, generated client, singleton `db` export | Single source of truth for DB types and connection |
| `apps/web` | Log browsing UI; reads from Postgres via `packages/database` | Read-only; no ingest path |

## Architectural Patterns

### Pattern 1: Async Fire-and-Forget HTTP Layer

**What:** The `HttpLayer` enqueues log sends without blocking the caller. Log functions return synchronously; HTTP delivery happens in the background on the event loop.

**When to use:** Any layer that has I/O side effects. The contract is that `handle()` returns the log immediately while I/O resolves later.

**Trade-offs:** Logs can be lost on process exit if the queue hasn't drained. For v0.x with the explicit out-of-scope constraint on durability, this is acceptable.

**Pattern:**
```typescript
export class HttpLayer implements Layer {
  private buffer: Log[] = []
  private timer: ReturnType<typeof setTimeout> | null = null

  handle(log: Log): Log {
    this.buffer.push(log)
    if (this.buffer.length >= this.batchSize) {
      this.flush()
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.flushIntervalMs)
    }
    return log  // caller is never blocked
  }

  private flush(): void {
    if (!this.buffer.length) return
    const batch = this.buffer.splice(0)
    this.timer = null
    fetch(this.url, { method: "POST", body: JSON.stringify(batch) })
      .catch(() => {})  // swallow; logs are best-effort for v0.x
  }
}
```

**Key rule:** `handle()` must be synchronous and return the log immediately. The `Layer` interface already allows `Promise<Log | null>` but HTTP should avoid awaiting to prevent back-pressure on the caller.

### Pattern 2: In-Memory Ingest Queue with Drain

**What:** The API receives logs via HTTP and pushes them into an in-memory queue. A separate drain loop periodically flushes batches to the storage adapter. The HTTP handler responds 202 immediately after enqueue, not after DB write.

**When to use:** Any ingest path where the receiver (DB) is slower or less reliable than the producer (HTTP client). Decouples latency of DB writes from HTTP response time.

**Trade-offs:** In-process queue loses unwritten logs on crash. Sufficient for v1; Redis/BullMQ would be needed for durability guarantees.

**Pattern:**
```typescript
class IngestQueue {
  private queue: Log[] = []
  private draining = false

  push(logs: Log[]): void {
    this.queue.push(...logs)
    if (!this.draining) this.drain()
  }

  private async drain(): Promise<void> {
    this.draining = true
    while (this.queue.length) {
      const batch = this.queue.splice(0, BATCH_SIZE)
      await storage.insertMany(batch).catch(() => {
        // on error, re-enqueue or drop depending on policy
      })
    }
    this.draining = false
  }
}
```

**Integration point:** The ingest route calls `queue.push(logs)` and immediately returns `202`. The queue drains asynchronously. The `StorageAdapter` interface is unchanged.

### Pattern 3: Shared Prisma Singleton via `packages/database`

**What:** Both `apps/api` and `apps/web` import `db` from `packages/database`. The package uses a `globalThis` guard to ensure a single `PrismaClient` instance regardless of hot-reloading in development.

**When to use:** Any Turborepo monorepo where multiple apps share a single Postgres database. Prevents connection pool exhaustion, ensures type consistency, centralizes migrations.

**Trade-offs:** The `packages/database` package must be built before consuming apps. Turbo's `^build` dependency handles this automatically. In Next.js, `serverComponentsExternalPackages` or `outputFileTracingIncludes` may be needed to ensure Prisma query engine binaries are bundled correctly.

**Existing implementation in `packages/database/src/index.ts`:** Already follows the correct `globalThis` singleton pattern. The API currently uses a separate raw `postgres` driver adapter that duplicates schema management. The migration path is to replace `PostgresStorageAdapter` with a `PrismaStorageAdapter` that consumes `db` from `packages/database`.

**Key wiring for `apps/api`:**
- Add `packages/database` as a workspace dependency
- Replace `PostgresStorageAdapter` with a `PrismaStorageAdapter` implementing `StorageAdapter` using `db.log.create()` / `db.log.createMany()`
- Remove the `adapter.init()` call (schema is managed via Prisma migrations, not runtime DDL)

**Key wiring for `apps/web`:**
- Add `packages/database` as a workspace dependency
- Use `db` in server components/route handlers directly for log queries
- No client-side DB access

## Data Flow

### Log Write Path (library → API → DB)

```
Consumer App
  ↓ info("message")
packages/arbre: createHandleLog() → dispatch() → Arbre.handleLog()
  ↓ each Layer.handle(log) in sequence
HttpLayer.handle(log)
  → pushes to internal buffer
  → returns log synchronously (caller unblocked)
  ↓ (background, on timeout or batch size reached)
HttpLayer.flush()
  → POST /ingest with Log[]
  ↓
apps/api: Fastify validates schema → ingestRoute handler
  → queue.push(logs)
  → reply 202 { accepted: N }
  ↓ (async drain loop)
IngestQueue.drain()
  → storage.insertMany(batch)
  ↓
PrismaStorageAdapter
  → db.log.createMany({ data: batch })
  ↓
packages/database: PrismaClient → @prisma/adapter-pg → pg Pool → Postgres
  → INSERT INTO arbre.log ...
```

### Log Read Path (DB → web dashboard)

```
Browser → apps/web Next.js App Router
  ↓ Server Component
  db.log.findMany({ where, orderBy, take })
  ↓
packages/database: PrismaClient → Postgres
  → SELECT FROM arbre.log ...
  ↓
Server Component renders log rows → HTML to browser
```

### Key Data Flow Rules

1. `packages/arbre` never awaits I/O. The HTTP layer is fire-and-forget.
2. `apps/api` responds before DB write. The queue is the buffer.
3. `apps/web` reads directly from DB via Prisma. No API proxy for reads.
4. Type consistency: `Log` type from `packages/arbre`; Prisma-generated `Log` model from `packages/database`. These are separate types — the `PrismaStorageAdapter` maps between them.

## Component Boundaries

| Boundary | Communication | Direction | Notes |
|----------|---------------|-----------|-------|
| `packages/arbre` → `apps/api` | HTTP POST /ingest | One-way, async | Never waits for response |
| `apps/api` → `packages/database` | TypeScript import, Prisma | One-way, async | Via `StorageAdapter` abstraction |
| `apps/web` → `packages/database` | TypeScript import, Prisma | One-way, read-only | Server components only |
| `packages/database` → Postgres | TCP via pg Pool | One-way | Single pool, singleton client |
| `apps/api` route → `IngestQueue` | In-process call | One-way | No shared state outside the queue |

## Build Order Implications

Turborepo's `^build` dependency handles this, but the logical dependency order is:

```
1. packages/config-typescript
2. packages/config-eslint
3. packages/arbre          ← types/arbre (Layer, Log)
4. packages/database       ← Prisma client generation must run before build
5. packages/types          ← any cross-app shared types
6. packages/ui
7. apps/api                ← depends on packages/arbre, packages/database
8. apps/web                ← depends on packages/arbre, packages/database, packages/ui
9. apps/demo               ← depends on packages/arbre only
```

`packages/database` must have `prisma generate` run before the build step of any consuming app. This is typically wired as a `db:generate` task in the database package's `turbo.json` that `build` tasks in `apps/api` and `apps/web` depend on.

## Anti-Patterns

### Anti-Pattern 1: Awaiting HTTP in Layer.handle()

**What people do:** Make `handle()` return `Promise<Log>` and await the `fetch()` call to the ingest API.

**Why it's wrong:** Every log call blocks the caller until the HTTP round-trip completes. This defeats the purpose of structured logging — latency spikes, back-pressure propagates to application code, and a flaky API endpoint degrades the host application.

**Do this instead:** Buffer internally. Return the log synchronously. Flush in the background.

### Anti-Pattern 2: Writing to DB synchronously in the Ingest Route

**What people do:** `await storage.insert(log)` inside the Fastify route handler before replying 202.

**Why it's wrong:** DB write latency is now visible to the HTTP caller. A slow or unavailable DB causes the ingest endpoint to time out, which blocks the `HttpLayer` flush, which blocks the layer buffer from draining.

**Do this instead:** Enqueue immediately, reply 202, drain asynchronously. The HTTP caller only sees queue latency, not DB latency.

### Anti-Pattern 3: Creating a New PrismaClient Per Request

**What people do:** `new PrismaClient()` inside a route handler or server component.

**Why it's wrong:** Each instance opens its own connection pool. In a long-running API process, this exhausts Postgres connections. In Next.js dev mode with hot-reload, it creates a new pool on every file change.

**Do this instead:** Import the singleton `db` from `packages/database`. The `globalThis` guard handles deduplication across hot-reloads.

### Anti-Pattern 4: Schema Init at Runtime via DDL

**What people do:** Call `adapter.init()` at server start to `CREATE TABLE IF NOT EXISTS` — which is what the current `PostgresStorageAdapter` does.

**Why it's wrong:** Once Prisma manages the schema, runtime DDL and Prisma migrations diverge. Schema state becomes ambiguous. The table structure in `adapter.init()` already differs from `schema.prisma` (e.g., `id` type: `BIGSERIAL` vs `uuid`, `scope` type: `JSONB` vs `String`).

**Do this instead:** Remove runtime DDL. Manage schema exclusively via `prisma migrate`. The `PrismaStorageAdapter` has no `init()` method.

## Scaling Considerations

| Scale | Architecture Adjustment |
|-------|------------------------|
| 0–10k logs/day | Current architecture is fine; in-memory queue with single DB writer |
| 10k–1M logs/day | Add `createMany` batching in queue drain (already the plan); add Postgres indexes on `timestamp`, `level`, `scope` |
| 1M+ logs/day | Replace in-memory queue with Redis/BullMQ; consider Timescale or ClickHouse for the log table; add a read replica for `apps/web` |

For v0.x, the in-memory queue with `db.log.createMany()` is the correct and sufficient choice.

## Sources

- Prisma monorepo guide: https://www.prisma.io/docs/guides/use-prisma-in-pnpm-workspaces
- Prisma Turborepo prompt: https://www.prisma.io/docs/ai/prompts/turborepo
- AppSignal monorepo with Prisma: https://blog.appsignal.com/2025/11/26/manage-a-nextjs-monorepo-with-prisma.html
- pino-http-send batching pattern: https://github.com/technicallyjosh/pino-http-send
- pino-abstract-transport: https://github.com/pinojs/pino-abstract-transport
- Pino v7 worker_thread transport model: https://www.nearform.com/blog/pino7-0-0-pino-transport-worker_thread-transport/

---
*Architecture research for: Arbre — self-hosted structured logging system*
*Researched: 2026-03-05*
