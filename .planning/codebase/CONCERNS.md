# Codebase Concerns

**Analysis Date:** 2026-03-05

## Security Considerations

**No authentication on the ingest endpoint:**
- Risk: Any caller can POST logs to `/ingest` — there is no API key, bearer token, or any auth mechanism.
- Files: `apps/api/src/routes/ingest.ts`, `apps/api/src/plugins/`
- Current mitigation: None.
- Recommendations: Add an API key header check (e.g., via a Fastify plugin) before the ingest route handler.

**CORS allows all origins:**
- Risk: `origin: true` in the CORS plugin reflects the request's Origin back, effectively allowing any origin.
- Files: `apps/api/src/plugins/cors.ts`
- Current mitigation: None.
- Recommendations: Restrict `origin` to known client origins in production environments.

**`DATABASE_URL` falls back to empty string:**
- Risk: If `DATABASE_URL` is not set, the Postgres adapter is initialized with `""` which either fails silently at connect time or produces a confusing error rather than a clear startup failure.
- Files: `apps/api/src/config/index.ts` (line 15)
- Current mitigation: None.
- Recommendations: Throw at startup if `DATABASE_URL` is absent.

## Tech Debt

**`app` field is not part of the `Log` type but is extracted via type cast:**
- Issue: `postgres.ts` casts `log` to `Log & { app?: string }` to extract an `app` field that is not defined in the canonical `Log` interface. This field is set by the `App` layer in `packages/arbre`, which mutates `payload.app`, not a top-level `app` property. The column exists in the database schema but will always be `null` unless callers manually attach a top-level `app` property outside the type system.
- Files: `apps/api/src/storage/postgres.ts` (lines 15, 20), `packages/arbre/src/layer/app-layer.ts`, `packages/arbre/src/types/log.ts`
- Impact: The `app` database column is structurally broken — the `App` layer puts `app` inside `payload`, but the adapter reads it from the top level. Log queries filtered by `app` will always return nothing.
- Fix approach: Either add `app` as a first-class optional field on `Log` in `packages/arbre/src/types/log.ts` and have the `App` layer set it there, or extract `app` from `payload` in `toRow()`.

**`init()` is not part of the `StorageAdapter` interface:**
- Issue: `PostgresStorageAdapter.init()` runs DDL migrations (CREATE TABLE, CREATE INDEX) but the method is not declared on the `StorageAdapter` interface in `apps/api/src/storage/index.ts`. It is called directly in `apps/api/src/index.ts` by casting to the concrete class.
- Files: `apps/api/src/storage/index.ts`, `apps/api/src/storage/postgres.ts`, `apps/api/src/index.ts`
- Impact: Any alternative `StorageAdapter` implementation must be initialized outside the abstraction. There is no enforced contract for initialization.
- Fix approach: Add `init(): Promise<void>` to the `StorageAdapter` interface, or move schema management to a separate migration step outside the adapter.

**Ingest route casts `request.body` to a union type:**
- Issue: `ingest.ts` line 36 uses `as Parameters<StorageAdapter["insert"]>[0] | Parameters<StorageAdapter["insertMany"]>[0]`. This type assertion bypasses TypeScript's inference after Fastify's JSON Schema validation. The validated body is `unknown` and the cast is unsafe.
- Files: `apps/api/src/routes/ingest.ts` (line 36)
- Impact: Type safety is illusory at this boundary — a malformed request that passes JSON Schema could still reach storage with unexpected shape.
- Fix approach: Use Fastify's generic route typing (`RouteGenericInterface`) or `@sinclair/typebox` to derive types from the JSON Schema directly.

**`demo` app does not use the `arbre` logging library:**
- Issue: `apps/demo` is an Express server with a `/message/:name` and `/status` endpoint. It has no integration with `packages/arbre` despite the stated purpose of the demo being to demonstrate the logging system.
- Files: `apps/demo/src/server.ts`, `apps/demo/src/index.ts`
- Impact: The demo provides no demonstration value for the core library.
- Fix approach: Wire up `arbre` layers in the demo server and have routes emit logs.

## Missing Critical Features

**No query/read API on the ingest server:**
- Problem: `apps/api` exposes only `POST /ingest`. There are no endpoints to query, filter, or retrieve stored logs.
- Blocks: The dashboard (`apps/web`) cannot retrieve real log data — it currently renders entirely hardcoded test data.
- Files: `apps/api/src/routes/`, `apps/web/app/dashboard/page.tsx`

**Dashboard renders no real data:**
- Problem: `apps/web/app/dashboard/page.tsx` passes `chartData` from `apps/web/data/test/area-chart.ts` (hardcoded fixture data with `desktop`/`mobile` keys) directly into chart components. No API calls are made. The three placeholder `div` blocks in the grid are empty.
- Files: `apps/web/app/dashboard/page.tsx`, `apps/web/data/test/area-chart.ts`
- Blocks: A usable log viewer/dashboard cannot be built until query endpoints exist and the web app fetches from them.

**No schema migrations — DDL runs on every startup:**
- Problem: `PostgresStorageAdapter.init()` runs `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` on every process start. This pattern does not support schema evolution (adding columns, altering types) and couples schema state to runtime startup.
- Files: `apps/api/src/storage/postgres.ts` (lines 33-48), `apps/api/src/index.ts`
- Fix approach: Introduce a proper migration tool (e.g., `node-pg-migrate`, `drizzle-kit`) and separate the migration step from server startup.

## Fragile Areas

**Singleton `Arbre` instance has no reset mechanism:**
- Files: `packages/arbre/src/arbre.ts`
- Why fragile: `Arbre._instance` is a module-level singleton. Tests that add layers in one test will bleed state into subsequent tests. There is no `reset()` or `clearLayers()` method.
- Safe modification: Add a `static reset()` method (or expose `_layers` setter) for use in test teardown.
- Test coverage: The existing tests in `packages/arbre/src/__tests__/log.test.ts` are the only coverage.

**`Filter` layer uses `indexOf` on a log level array:**
- Files: `packages/arbre/src/layer/filter-layer.ts`
- Why fragile: `Filter.ORDER` is `["debug", "trace", "info", "warn", "error", "fatal"]`. Note that `debug` ranks below `trace`, which inverts the conventional severity ordering where `trace` is the lowest level. Filtering at `info` or above behaves correctly, but filtering at `trace` will pass `debug` through unexpectedly.
- Risk: Callers setting `minimum: "trace"` intend to see all messages, but will actually suppress `debug` logs.

**`web` root page (`/`) and `/dashboard` are decoupled:**
- Files: `apps/web/app/page.tsx`, `apps/web/app/dashboard/page.tsx`
- Why fragile: The root page renders a component showcase (`ComponentExample`) entirely unrelated to the dashboard. Navigation between the two is not wired.

## Test Coverage Gaps

**No tests for `PostgresStorageAdapter`:**
- What's not tested: `insert`, `insertMany`, `init`, the `toRow` mapping, and the `app` field extraction.
- Files: `apps/api/src/storage/postgres.ts`
- Risk: The broken `app` field extraction (see Tech Debt above) would be caught by even a minimal unit test.
- Priority: High

**No tests for `packages/arbre` layer pipeline beyond basic dispatch:**
- What's not tested: `App` layer output, `Json` layer output, `Filter` layer edge cases (the `debug`/`trace` ordering issue), layer interaction when one returns `null`.
- Files: `packages/arbre/src/layer/`
- Priority: Medium

**`apps/demo` has a test file that tests only Express routing, not arbre integration:**
- What's not tested: Any interaction between the demo server and the `arbre` library.
- Files: `apps/demo/src/__tests__/server.test.ts`
- Priority: Low (until demo is wired to arbre)

---

*Concerns audit: 2026-03-05*
