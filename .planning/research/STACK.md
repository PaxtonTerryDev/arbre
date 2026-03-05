# Stack Research

**Domain:** Structured logging library extensions — async HTTP transport, in-memory queue, file rotation
**Researched:** 2026-03-05
**Confidence:** HIGH (npm versions verified; patterns verified against pino source docs and mcollina/fastq)

---

## Context: What This Research Covers

The existing stack (Fastify 5, Next.js 16, Prisma, TypeScript strict, bunchee, tsdown, Turborepo) is already decided and documented in `.planning/codebase/STACK.md`. This file covers only the **new libraries and patterns** needed for the three active workstreams:

1. Bundled layers in `packages/arbre` (HTTP transport, file output, filter/sampling)
2. In-memory queue in `apps/api` for decoupled ingest
3. Functional log browser in `apps/web` (no new libraries expected — existing Prisma + Next.js is sufficient)

---

## Recommended Stack

### New Libraries

| Library | Version | Purpose | Why Recommended |
|---------|---------|---------|-----------------|
| `pino-abstract-transport` | `^3.0.0` | Base for HTTP transport layer in `packages/arbre` | Canonical pattern from the pino ecosystem for async, worker-safe transports; exposes an async iterator over parsed log objects; handles clean shutdown via `close()` hook — **however, see note below on direct use** |
| `fastq` | `^1.20.1` | In-memory queue for `apps/api` ingest pipeline | 64M weekly downloads, made by the same author (mcollina) as Fastify; single dependency; supports both callback and Promise APIs; provides `concurrency`, `pause()`/`resume()`, `drain` lifecycle — exactly the right scope for an in-memory buffer without external infra |
| `pino-roll` | `^4.0.0` | File rotation for `packages/arbre` file layer | Official pino transport by mcollina; handles size-based and time-based rotation natively; SonicBoom-backed (fully async writes); zero dependency drift from the rest of the pino ecosystem |

### No New Libraries for `apps/web`

The log browser only needs Prisma queries via `packages/database` and Next.js Server Components. No additional libraries are required.

---

## Pattern Recommendations by Workstream

### 1. HTTP Transport Layer (`packages/arbre`)

**Pattern: Native async `handle()` with internal micro-batch buffer**

Do NOT use `pino-abstract-transport` directly in `packages/arbre`. That library is designed for pino's `worker_thread`-based transport pipeline. Arbre's `Layer` interface already supports `Promise` return from `handle()`, and the dispatcher (`Arbre.handleLog`) already `await`s each layer. The correct pattern is:

- `HttpLayer.handle()` pushes the log into an internal array buffer and returns the log immediately (non-blocking to caller).
- A `setInterval`/`setTimeout` flush loop drains the buffer and `POST`s batches to the ingest URL using Node.js built-in `fetch` (available since Node 18; this project targets Node >=18).
- On `process.beforeExit`, flush remaining items synchronously.

This is how winston's HTTP transport and pino's own transports handle the async delivery problem: **decouple receipt from delivery**. The caller never waits for the HTTP round-trip.

**Key design points:**
- Buffer is a plain `Log[]` array — no library needed.
- Flush interval configurable (default 1000ms), max batch size configurable (default 100).
- Fire-and-forget `fetch` inside the flush; swallow delivery errors (log to stderr at most). Log calls must never throw.
- No retry logic in v0.x — acceptable per project scope.

**What NOT to use:**
- `axios` or `node-fetch` — Node 18+ `fetch` is built-in; adding a dependency for HTTP is unnecessary.
- `pino-abstract-transport` — correct for pino's worker_thread pipeline, wrong abstraction for Arbre's synchronous layer interface.
- `worker_threads` for the HTTP layer — overkill for v0.x; the async flush loop keeps delivery off the hot path without the complexity of a worker thread.

### 2. In-Memory Queue for API Ingest (`apps/api`)

**Pattern: `fastq` queue with a single async database-write worker**

The ingest route (`POST /ingest`) currently calls `storage.insert()` / `storage.insertMany()` directly and `await`s the DB write before responding. Adding a queue decouples receipt (202 immediately) from persistence (async in background).

Recommended structure:
- One `fastq.promise(worker, concurrency)` queue at server startup, injected into Fastify as a plugin/decorator.
- `worker` is an async function that calls `storage.insertMany(batch)` for a batch of logs.
- Route handler pushes received logs to the queue and responds `202` without waiting.
- Concurrency set to `1` initially to prevent write contention; can be increased if Postgres write throughput becomes the bottleneck.

**Why fastq over alternatives:**
- `async.queue` — 3x slower in benchmarks, larger package.
- `BullMQ` — Redis-backed, external infra, explicitly out of scope per PROJECT.md.
- `better-queue` — supports persistence but adds complexity; in-memory-only is the stated v1 requirement.
- A plain `Array` with `setInterval` drain — workable but lacks backpressure, `pause()`/`resume()`, and `drain` lifecycle hooks that fastq provides for free.

**Memory / durability tradeoff:** If the process crashes, queued logs are lost. This is explicitly accepted in PROJECT.md ("in-memory is sufficient for v1").

### 3. File Rotation Layer (`packages/arbre`)

**Library: `pino-roll` v4.0.0**

`pino-roll` creates a SonicBoom stream that automatically rotates files by size, frequency, or both. It is the recommended rotation mechanism in the pino ecosystem and supports:
- `frequency: '1d'` — rotate daily
- `size: '10m'` — rotate at 10 MB
- `limit: { count: 7 }` — retain 7 rotated files
- `mkdir: true` — create log directory if absent

For Arbre's file layer, `pino-roll` is used as the underlying writable stream. The `FileLayer` will:
- Accept `destination`, `frequency`, `size`, `limit` config.
- Open a rolling stream via `pino-roll` at construction time.
- In `handle()`, write the JSON-serialized log line synchronously via the SonicBoom stream (SonicBoom's write is non-blocking by default; it buffers internally).
- Expose a `close()` method that flushes and destroys the stream.

**What NOT to use:**
- `winston-daily-rotate-file` v5.0.0 — coupled to winston's transport system; Arbre's layer pattern has no compatibility surface with winston transports.
- `rotating-file-stream` — viable generic alternative, but `pino-roll` is more actively maintained, SonicBoom-backed, and consistent with the pino ecosystem already used in production logging tooling.
- Rolling your own with `fs.createWriteStream` + manual rename — high complexity, edge cases around mid-write rotation.

### 4. Filter/Sampling Layer (`packages/arbre`)

**No new libraries.** The existing `Filter` layer already gates by log level. The sampling extension is pure logic: accept a `sampleRate` number (0–1), generate `Math.random()`, drop if above threshold. This fits in ~10 lines inside a new `SampleLayer` class implementing `Layer`.

---

## Installation

```bash
# In packages/arbre (new layer dependencies)
npm install pino-roll --workspace=packages/arbre

# In apps/api (queue)
npm install fastq --workspace=apps/api
```

`pino-abstract-transport` is NOT added — it is not needed for the Arbre layer pattern.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Native `fetch` + array buffer (HTTP layer) | `axios` with interceptors | If you need request interceptors, cancellation, or Node <18 support — none of which apply here |
| `fastq` (API queue) | Plain `Array` + `setInterval` drain | If you need zero dependencies and are comfortable reimplementing backpressure manually |
| `fastq` (API queue) | `BullMQ` + Redis | When you need durability across restarts — explicitly deferred to v2 |
| `pino-roll` (file layer) | `rotating-file-stream` | If you are not in the pino/SonicBoom ecosystem and want a framework-agnostic solution |
| `pino-roll` (file layer) | `logrotate` (OS utility) | In Docker/Linux deployments where you control the host — offloads rotation entirely out of process |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `node-fetch` | Built-in `fetch` is available in Node 18+; adding a polyfill is pure overhead | Node built-in `fetch` |
| `axios` | Same reason; also adds 2MB to the library bundle | Node built-in `fetch` |
| `pino-abstract-transport` in `packages/arbre` | Designed for pino's `worker_thread` transport pipeline, not Arbre's `Layer` interface | Native async `handle()` with buffer flush pattern |
| `worker_threads` for HTTP layer | Over-engineered for v0.x; the async flush loop is sufficient and simpler | `setInterval` flush + native `fetch` |
| `winston-daily-rotate-file` | Coupled to winston's transport system; incompatible with Arbre's layer interface | `pino-roll` |
| `BullMQ` / Redis | Requires external Redis infra; PROJECT.md explicitly rules this out for v1 | `fastq` in-memory queue |
| `async.queue` | 3x slower than `fastq` in benchmarks; heavier package | `fastq` |

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `fastq` | `^1.20.1` | Node >=8, TypeScript 5.x | Ships its own types; no `@types/` package needed |
| `pino-roll` | `^4.0.0` | Node >=18 | v4 is the current major; requires ESM or dual-CJS/ESM bundle (matches bunchee output) |
| `pino-abstract-transport` | `^3.0.0` | — | Listed for reference; **NOT added to this project** |

---

## Sources

- [pinojs/pino-abstract-transport README](https://github.com/pinojs/pino-abstract-transport/blob/main/README.md) — async iterator transport pattern (HIGH confidence — official repo)
- [NearForm: Welcome to pino@7.0.0 — worker_thread transport era](https://www.nearform.com/blog/pino7-0-0-pino-transport-worker_thread-transport/) — rationale for worker_thread vs main-thread async (MEDIUM confidence — authored by pino maintainers)
- [mcollina/fastq GitHub](https://github.com/mcollina/fastq) — API, benchmarks, concurrency model (HIGH confidence — official repo)
- [pino-roll npm](https://www.npmjs.com/package/pino-roll) — current version, rotation options (HIGH confidence — official package registry)
- npm registry version checks (2026-03-05): `pino-roll@4.0.0`, `fastq@1.20.1`, `pino-abstract-transport@3.0.0`, `winston-daily-rotate-file@5.0.0` — all current

---

*Stack research for: Arbre — async HTTP transport, in-memory queue, file rotation layers*
*Researched: 2026-03-05*
