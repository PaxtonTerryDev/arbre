# Pitfalls Research

**Domain:** Structured logging library + self-hosted log aggregator (Turborepo monorepo)
**Researched:** 2026-03-05
**Confidence:** HIGH (async transport, queue, ESM/CJS); MEDIUM (Prisma monorepo)

---

## Critical Pitfalls

### Pitfall 1: Async HTTP Transport Swallows Errors Silently

**What goes wrong:**
The HTTP layer fires a `fetch`/`http.request` call and returns immediately. If the request fails — network error, API down, non-2xx response — the rejected promise is unobserved and Node.js either crashes (default behavior in Node 15+) or emits an `UnhandledPromiseRejection` warning that is swallowed in production. The caller's log call succeeds from their perspective, but the log is lost.

**Why it happens:**
The fire-and-forget pattern is correct for a non-blocking transport, but developers forget that "fire and forget" still requires catching the rejection. A bare `fetch(...).then(...)` with no `.catch()` is a silent failure path. The problem is invisible during development when the API is always up.

**How to avoid:**
Every async dispatch call in the HTTP layer must be wrapped in `.catch()` (or try/catch inside an async IIFE). The catch handler should emit to an internal `error` event or call a configurable `onError` callback rather than re-throwing. At minimum it should `console.error` so the failure is visible. Never let a promise from a transport escape unhandled.

```ts
this.dispatch(log).catch((err) => this.onError?.(err));
```

**Warning signs:**
- Log calls return normally but API receives zero requests under load
- Node prints `UnhandledPromiseRejectionWarning` during API downtime tests
- Unit tests pass but integration tests with a dead server never fail

**Phase to address:** HTTP layer implementation phase (first async transport)

---

### Pitfall 2: Async Transport Blocks on Process Exit — Logs Lost at Shutdown

**What goes wrong:**
When the process receives SIGTERM or SIGINT, Node begins exiting. Any in-flight `fetch` calls or queued items in the async transport are abandoned mid-flight. The last burst of logs before shutdown (often the most important ones — shutdown errors, final state) is silently dropped.

**Why it happens:**
`process.exit()` and the end of the event loop do not wait for pending promises. The HTTP layer dispatches without any mechanism to drain before exit. Pino solves this explicitly with `pino.final()` which forces synchronous writes; Winston has `rejectionHandlers`. Without equivalent treatment, all async transports share this problem.

**How to avoid:**
Register a `SIGTERM`/`SIGINT` handler on the `Arbre` singleton (or expose a `flush(): Promise<void>` method) that awaits completion of all in-flight dispatches and drains the queue before resolving. Fastify's `onClose` hook is the right place to call this in the API. The library's public API should document that callers must await `arbre.flush()` before `process.exit()`.

**Warning signs:**
- Logs always stop a few entries before the shutdown log you expected
- Tests that kill the process and check log count come up short
- Graceful shutdown completes instantly despite a non-empty queue

**Phase to address:** HTTP layer implementation phase; revisit during API in-memory queue phase

---

### Pitfall 3: Unbounded In-Memory Queue Causes OOM Under Back-Pressure

**What goes wrong:**
The ingest API receives logs faster than Postgres can write them. The in-memory queue grows without bound, consuming heap until the process is OOM-killed. This is especially acute on startup (migration, slow first-connection) or during a DB hiccup. The queue can grow to millions of entries before anyone notices.

**Why it happens:**
The naive implementation is `const queue: Log[] = []`. Items are pushed on ingest and shifted on DB flush. No cap is enforced. The feedback cycle described in Node.js back-pressure literature is: more items → more GC pressure → slower throughput → more items queue up.

**How to avoid:**
Set a hard `MAX_QUEUE_SIZE` constant (e.g. 10,000). When the queue is at capacity, the ingest route should return `429 Too Many Requests` or `503 Service Unavailable` — not silently drop the log, and not block. The HTTP layer in `packages/arbre` should treat a 429 response as a signal to back off. Log a warning when the queue crosses 50% capacity so the operator is alerted before it becomes a crisis.

**Warning signs:**
- API process RSS memory climbs monotonically under load
- Postgres write latency spikes → queue depth spikes → both feed each other
- Load tests show API accepting 200s indefinitely while DB is disconnected

**Phase to address:** API in-memory queue implementation phase

---

### Pitfall 4: Queue Flush Timer Leaks — Process Won't Exit in Tests

**What goes wrong:**
The queue uses `setInterval` to batch-flush to Postgres. If the interval is not cleared on shutdown, Jest (or the process) hangs waiting for the timer. This is a common cause of `--forceExit` appearing in test commands, which masks other real hangs.

**Why it happens:**
`setInterval` keeps the event loop alive. The flush interval is created at startup and never cleared because there is no lifecycle hook wired to server close. Tests spin up the Fastify server, run assertions, then call `server.close()` — but the interval outlives the server.

**How to avoid:**
Store the interval handle and clear it in the queue's `stop()` method. Call `stop()` in Fastify's `onClose` hook, not in a SIGTERM handler alone (tests don't send SIGTERM). Verify by running the test suite without `--forceExit` and confirming it exits cleanly.

**Warning signs:**
- Jest hangs after all tests pass; requires `--forceExit` or `--detectOpenHandles`
- `--detectOpenHandles` output points to a `setInterval` in queue code

**Phase to address:** API in-memory queue implementation phase

---

### Pitfall 5: Prisma Client Instantiated Per Hot-Reload in Next.js Dev

**What goes wrong:**
In Next.js development, every file save triggers a hot-reload that re-evaluates module code. If `new PrismaClient()` is called at module scope in `packages/database`, each reload creates a new client with its own connection pool. After 10–20 reloads, Postgres hits its connection limit and queries start timing out.

**Why it happens:**
Node module caching does not survive Next.js hot-reload boundaries. The `packages/database` singleton pattern is correct for a long-lived server but Next.js dev mode re-imports modules on each reload. Without a global singleton guard, `globalThis.__prisma` is recreated each time.

**How to avoid:**
Use the standard Next.js/Prisma singleton pattern: assign the client to `globalThis` in development, read from it if it exists, and only instantiate in production per-module-load.

```ts
const globalForPrisma = globalThis as { prisma?: PrismaClient };
export const prisma =
  globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

This guard must live in `packages/database`, not in each consuming app.

**Warning signs:**
- `too many clients` Postgres errors that appear only during active development (never in production)
- Connection errors after 10–20 file saves in a row
- `docker stats` shows PG connection count climbing with each save

**Phase to address:** Prisma persistence wiring phase (API); web dashboard phase (apps/web adds its own Prisma usage)

---

### Pitfall 6: Dual Package Hazard — Arbre Singleton Broken When Both CJS and ESM Are Loaded

**What goes wrong:**
The `Arbre` class relies on a module-level singleton (`Arbre._instance`). If a consumer's bundler or test runner loads both the CJS and ESM outputs of `packages/arbre` simultaneously (which is possible when transitive dependencies mix `require` and `import`), two separate module instances are created. Each has its own `_instance`, so layers added in one context are invisible in the other.

**Why it happens:**
This is the "dual package hazard" documented in the Node.js modules spec. It occurs when a package ships both CJS and ESM and both end up resolved in the same process — once via `import` and once via `require`. Bundlers like webpack 5 and Vitest are known to trigger this when mixing CJS host code with ESM packages.

**How to avoid:**
The safest mitigation for a singleton-reliant library is to ship ESM-only, or use the "ESM wrapper over CJS" pattern where the `import` condition wraps the same CJS module (ensuring only one copy runs). Bunchee's dual output is the right DX choice but requires documentation warning consumers not to mix `require('arbre')` and `import 'arbre'` in the same build. Add a detection guard in `Arbre.get_instance()` that throws if two instances are detected via a well-known symbol on `globalThis`.

**Warning signs:**
- Layers added via `addLayer()` in one file are not visible when `handleLog` is called from another file
- `instanceof Arbre` checks return `false` for objects that visually appear to be Arbre instances
- Vitest or Jest test isolation causes layers to reset between imports despite no explicit reset

**Phase to address:** npm publish phase

---

### Pitfall 7: Missing `types` Export Condition Breaks TypeScript Consumers

**What goes wrong:**
The published package has an `exports` field. TypeScript resolves types through the `exports` map when `moduleResolution` is `bundler` or `node16`. If the `"types"` condition is absent or ordered after `"import"`/`"require"`, TypeScript falls back or errors: `Could not find a declaration file for module 'arbre'`. Consumers get implicit `any` for every import.

**Why it happens:**
The current `package.json` in `packages/arbre` is correctly structured (types condition is present and ordered first under each condition). The risk is that a future refactor swaps condition order or removes the `types` field thinking `main`/`module` are sufficient — they are not when `exports` is present.

**How to avoid:**
The `"types"` condition must be the first key under each export condition object. This is currently correct. Protect it with a CI check: `tsc --moduleResolution bundler --traceResolution` against the built output should resolve types without error. Add this to the publish checklist.

**Warning signs:**
- TypeScript consumers report `TS7016` or `implicitly has 'any' type` for arbre imports
- `tsc --traceResolution` shows the types file is not found or resolved from the wrong path
- Only breaks for consumers using `"moduleResolution": "bundler"` or `"node16"` — CJS consumers with classic resolution may not notice

**Phase to address:** npm publish phase

---

### Pitfall 8: File Layer Writes to a Non-Existent Directory — Silent No-Op

**What goes wrong:**
The File layer opens a write stream to a path like `./logs/app.log`. If the `logs/` directory does not exist, `fs.createWriteStream` throws `ENOENT`. If this error is unhandled (or only caught at stream open time but not on subsequent writes), the layer silently stops writing. Logs appear to succeed but nothing reaches disk.

**Why it happens:**
Stream errors after open fire on the `error` event of the stream, not as thrown exceptions. Developers handle the constructor call but forget to attach a `stream.on('error', ...)` listener. Additionally, ENOSPC (disk full) fires only on the stream event — not as a write-call exception — making it easy to miss.

**How to avoid:**
- Call `fs.mkdirSync(dir, { recursive: true })` before opening the stream.
- Always attach a `stream.on('error', (err) => ...)` listener that calls the layer's `onError` callback and closes the stream.
- Handle ENOSPC and EACCES distinctly: ENOSPC should disable the layer and emit a warning; EACCES should throw at construction time.

**Warning signs:**
- Log file is missing or has zero bytes; log calls return without error
- Node warns about `unhandled 'error' event` pointing to a `WriteStream`
- Disk-full scenarios produce no diagnostic output from the application

**Phase to address:** File layer implementation phase

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| DDL in `StorageAdapter.init()` on every startup | No migration tooling needed | Can't evolve schema without data loss; no rollback | Never in production; acceptable in early dev only — must be removed before first real deployment |
| No queue size cap | Simpler implementation | OOM kill under any sustained DB unavailability | Never — cap is required from the first iteration |
| `process.env.DATABASE_URL \|\| ""` fallback | App starts without config | Silent misconfiguration; Postgres errors instead of clear startup failure | Never |
| `fetch` without `.catch()` in HTTP layer | Less boilerplate | Unhandled rejection crash or silent log loss | Never |
| Single Prisma client shared between web and API via `packages/database` | Type sharing, no duplication | Connection pool contention if both apps run in the same process | Acceptable — they run in separate processes; correct pattern for this architecture |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Postgres via `packages/database` | Importing PrismaClient at module scope in Next.js (creates new pool per hot-reload) | `globalThis` singleton guard scoped to dev environment |
| Prisma in Turborepo | Running `prisma generate` only in one package; other consumers get stale types | Add `prisma generate` to the `build` script in `packages/database` and make it a dependency in `turbo.json` |
| Fastify + async queue | Forgetting to drain queue in `onClose` hook | Register `server.addHook('onClose', async () => queue.stop())` before registering routes |
| bunchee dual output | Relying on `main`/`module` fields instead of `exports` for type resolution | Always use the `exports` map with `types` first; the current config is correct — preserve it |
| HTTP layer in `packages/arbre` | Using global `fetch` which is only available in Node 18+ | The Node.js engines field says `>=18`; `fetch` is safe. Document this constraint. |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-log HTTP request in the HTTP layer | API request count equals log count; high latency under volume | Batch: accumulate logs for N ms then send array to `POST /ingest` | Above ~100 logs/sec to a remote API |
| Synchronous JSON serialization in hot log path | `JSON.stringify` blocks event loop for deeply nested payloads | Keep payloads shallow; defer serialization to the transport layer, not the core pipeline | Any payload with circular refs (throws) or >100KB objects |
| Postgres `INSERT` per log (no batching) | DB write latency multiplied by log volume; connection pressure | Queue flushes should use `insertMany` with a batch of up to N records | Above ~50 logs/sec sustained write rate |
| `SELECT *` on the logs table in the web dashboard | Full scan on large tables; slow first load | Always filter by time range; add composite index on `(timestamp DESC, level)` | Above ~100K rows |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| No auth on `POST /ingest` (currently exists) | Any process can inject arbitrary logs into the store | Add API key header validation as a Fastify plugin before route handlers |
| Logging user PII in payload without scrubbing | Log store becomes a PII data store subject to data regulations | Add a `Redact` layer that strips or hashes known sensitive keys before any transport |
| `origin: true` in CORS config (currently exists) | Any web origin can POST to the API | Restrict to known origins in production via environment variable |
| Log injection via unsanitized message strings | Log viewer renders attacker-controlled content | Escape log message content in the web dashboard before rendering into the DOM |

---

## "Looks Done But Isn't" Checklist

- [ ] **HTTP layer:** Appears to work in tests against a live API — verify it handles `fetch` rejection (network error), non-2xx response, and SIGTERM with queued items still pending
- [ ] **In-memory queue:** Appears to decouple ingest from DB — verify it enforces a max size and returns 429 when full, not 202
- [ ] **File layer:** Writes log files in tests — verify directory auto-creation, stream `error` event handling, and ENOSPC behavior
- [ ] **Prisma wiring:** API stores logs — verify the `app` field is populated correctly (currently broken: `App` layer sets `payload.app`, adapter reads top-level `app`)
- [ ] **npm publish:** Package builds and exports look correct — verify TypeScript consumers on `moduleResolution: bundler` can import types without `// @ts-ignore`
- [ ] **Queue flush on shutdown:** API stops accepting requests and exits — verify queue is drained (not abandoned) before process exits

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Unhandled rejection in HTTP layer crashes prod | HIGH | Add global `process.on('unhandledRejection')` as stopgap; then add `.catch()` to transport dispatch; redeploy |
| OOM from unbounded queue | HIGH | Restart API process; add `MAX_QUEUE_SIZE` + 429 response; redeploy; investigate DB write latency root cause |
| Dual package hazard breaks singleton | MEDIUM | Identify which dep is mixing CJS/ESM; pin resolution in consuming app's bundler config; long-term move to ESM-only output |
| Connection pool exhaustion from Next.js hot-reload | LOW | Restart Next.js dev server; add `globalThis` singleton guard immediately |
| Lost logs on SIGTERM | MEDIUM | Add flush-on-shutdown hook; lost logs cannot be recovered — only prevented going forward |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Async transport swallows errors | HTTP layer implementation | Integration test: point HTTP layer at a dead server, confirm no unhandled rejection, confirm `onError` fires |
| Logs lost on SIGTERM | HTTP layer implementation | Test: enqueue 100 logs, send SIGTERM, assert all 100 arrive at API |
| Unbounded queue OOM | In-memory queue implementation | Load test: disable DB, flood ingest, assert queue caps at MAX_QUEUE_SIZE and returns 429 |
| Queue timer leak in tests | In-memory queue implementation | Run Jest without `--forceExit`; confirm suite exits cleanly |
| Prisma per-hot-reload pool exhaustion | Prisma persistence wiring | Watch dev server through 20+ file saves; `docker stats` shows stable connection count |
| Dual package hazard breaks singleton | npm publish | Publish to local registry; consume from a CJS project and an ESM project in the same test harness |
| Missing `types` export condition | npm publish | `tsc --moduleResolution bundler` against published package; no TS7016 errors |
| File layer silent failure | File layer implementation | Unit test: point file layer at a read-only path, confirm `onError` fires and process does not crash |
| `app` field always null in DB | Prisma persistence wiring | Insert a log via `App` layer, query DB, assert `app` column is populated |

---

## Sources

- Node.js modules documentation — Dual package hazard: https://nodejs.org/api/packages.html#dual-package-hazard
- GeoffreyBooth/dual-package-hazard (canonical example): https://github.com/GeoffreyBooth/dual-package-hazard
- Liran Tal — TypeScript in 2025 with ESM and CJS npm publishing: https://lirantal.com/blog/typescript-in-2025-with-esm-and-cjs-npm-publishing
- Prisma documentation — Database connections and connection pool: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections
- Prisma GitHub Discussion #19444 — Multiple packages using Prisma in monorepo: https://github.com/prisma/prisma/discussions/19444
- Loguru Issue #1419 — Unbounded memory growth with slow sinks (missing back-pressure): https://github.com/Delgan/loguru/issues/1419
- Node.js — Backpressuring in Streams: https://nodejs.org/en/learn/modules/backpressuring-in-streams
- Node.js Issue #31908 — fs.createWriteStream doesn't report ENOSPC on single write: https://github.com/nodejs/node/issues/31908
- Pino transports documentation (worker_thread model, async flush): https://github.com/pinojs/pino/blob/main/docs/transports.md
- Winston Issue #1617 — Exception handler and UnhandledPromiseRejectionWarning: https://github.com/winstonjs/winston/issues/1617
- Trendyol Tech — Memory ran out in Node.js app (queue back-pressure case study): https://medium.com/trendyol-tech/everything-looked-fine-until-memory-ran-out-in-our-node-js-app-cae5ba587c92
- TypeScript npm exports guide (types condition ordering): https://www.velopen.com/blog/typescript-npm-package-json-exports/
- Existing codebase concerns audit (.planning/codebase/CONCERNS.md)

---
*Pitfalls research for: structured logging library + self-hosted log aggregator (Arbre)*
*Researched: 2026-03-05*
