# Roadmap: Arbre

## Overview

Starting from a functional core library and API shell, this roadmap closes the connective tissue gaps to deliver a complete log aggregation system: Prisma persistence wired first (everything downstream depends on it), then the async write path (HTTP transport + API queue together close the library → API → DB loop), then the dashboard read path (real logs visible in UI), then standalone library layers (file output and sampling), and finally npm publish to make `packages/arbre` available as a public package.

## Phases

- [ ] **Phase 1: Postgres Persistence** - Fix schema ownership, app field bug, and remove Prisma
- [ ] **Phase 2: Write Path** - HTTP transport layer + in-memory API queue closes the end-to-end log flow
- [ ] **Phase 3: Dashboard Read Path** - GET /logs endpoint + paginated log browser makes the system observable
- [ ] **Phase 4: Standalone Layers** - FileLayer and SamplingLayer added to packages/arbre
- [ ] **Phase 5: npm Publish** - packages/arbre published to npm as v0.x with correct exports map

## Phase Details

### Phase 1: Postgres Persistence
**Goal**: Logs are persisted correctly to Postgres via the native postgres adapter with schema owned by a migration file, app field flowing end-to-end, and Prisma removed
**Depends on**: Nothing (first phase)
**Requirements**: PERS-01, PERS-02, PERS-03
**Success Criteria** (what must be TRUE):
  1. Running `npm run db:migrate --workspace=apps/api` creates the logs table — no DDL executes at API startup
  2. A log sent to POST /ingest appears in Postgres with the correct `app` field value (not null)
  3. The `packages/database` Prisma package is fully removed — no `@repo/database` references remain
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Add app to Log type and Arbre constructor, remove App layer
- [ ] 01-02-PLAN.md — Extract DDL to migration, clean adapter, remove packages/database

### Phase 2: Write Path
**Goal**: A call to `arbre.info()` in a consumer app results in a persisted row in Postgres, asynchronously and without blocking the caller
**Depends on**: Phase 1
**Requirements**: HTTP-01, HTTP-02, HTTP-03, HTTP-04, HTTP-05, HTTP-06, QUEUE-01, QUEUE-02, QUEUE-03
**Success Criteria** (what must be TRUE):
  1. `arbre.info("hello")` returns immediately — no await, no observable latency in the caller
  2. After the batch window elapses, the log row appears in Postgres
  3. POST /ingest responds 202 before any DB write occurs
  4. When the ingest queue is full, POST /ingest returns 429 instead of accepting the log
  5. Calling `await arbre.flush()` before process exit drains all buffered logs to Postgres
**Plans**: TBD

### Phase 3: Dashboard Read Path
**Goal**: A developer can open the dashboard and browse, filter, and inspect logs persisted from their app
**Depends on**: Phase 2
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04
**Success Criteria** (what must be TRUE):
  1. GET /logs returns a paginated list of logs filterable by level, scope, and time range
  2. The dashboard displays a table of log entries with newest-first ordering
  3. UI controls for level and scope filter the visible rows without a page reload
  4. Clicking a log row shows a detail view with the full payload
**Plans**: TBD

### Phase 4: Standalone Layers
**Goal**: packages/arbre ships a FileLayer for disk persistence and a SamplingLayer for volume control
**Depends on**: Phase 2
**Requirements**: FILE-01, FILE-02, SAMP-01, SAMP-02
**Success Criteria** (what must be TRUE):
  1. Adding `FileLayer` to the pipeline writes log files to disk with automatic rotation by size or frequency
  2. File output path, rotation strategy, and max size are configurable via constructor options
  3. Adding `SamplingLayer` drops all logs below a configured level threshold
  4. Sample rate is configurable — e.g., keep 1 in N logs above the threshold
**Plans**: TBD

### Phase 5: npm Publish
**Goal**: packages/arbre is published to npm as v0.x and installable by external consumers
**Depends on**: Phase 4
**Requirements**: NPM-01, NPM-02
**Success Criteria** (what must be TRUE):
  1. A TypeScript consumer can `npm install arbre` and import with full type safety under both `moduleResolution: bundler` and `node16`
  2. The package.json exports map exposes CJS and ESM entry points with the `types` condition declared first
  3. The README documents install and quick-start examples for HttpLayer, FileLayer, SamplingLayer, and Filter
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Postgres Persistence | 0/2 | Planned | - |
| 2. Write Path | 0/TBD | Not started | - |
| 3. Dashboard Read Path | 0/TBD | Not started | - |
| 4. Standalone Layers | 0/TBD | Not started | - |
| 5. npm Publish | 0/TBD | Not started | - |
