# Phase 1: Postgres Persistence - Research

**Researched:** 2026-03-05
**Domain:** Native Postgres persistence, SQL migrations, Log type extension
**Confidence:** HIGH

## Summary

This phase rewires log persistence to use the existing `postgres` npm package (v3.4.8) directly, removes the unused Prisma/`packages/database` package, moves DDL out of runtime into a migration file, and adds `app` as a first-class property on the `Arbre` class. The existing `PostgresStorageAdapter` is already functional -- the work is mostly about cleanup, schema ownership, and type/API changes.

The codebase is in good shape for this. The adapter pattern is clean, the `postgres` library is already wired correctly, and the changes are surgical. The riskiest part is ensuring the `app` field flows end-to-end: from `Arbre` constructor through `Log` type, through the API's JSON Schema validation, into the database.

**Primary recommendation:** Keep the existing `PostgresStorageAdapter` nearly as-is, extract DDL to a migration SQL file run via `sql.file()`, add `app` to the `Log` type, and update the `Arbre` class constructor to accept and attach it.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Drop Prisma entirely -- remove `packages/database` and all `@prisma/*` dependencies
- Keep and improve the existing `PostgresStorageAdapter` using the raw `postgres` npm package
- No Prisma schema, no Prisma client, no migration CLI from Prisma
- DDL must NOT run at API startup -- remove `adapter.init()` DDL call from `apps/api/src/index.ts`
- Add a SQL migration file (e.g. `apps/api/migrations/001_create_logs.sql`) with the `CREATE TABLE` and index DDL
- Add an `npm run db:migrate` script to `apps/api/package.json` that applies the migration against `DATABASE_URL`
- Developer runs `npm run db:migrate --workspace=apps/api` once before first start
- Standard `.env` file (e.g. `apps/api/.env`) with `DATABASE_URL` -- already supported by the config loader
- `app` is a first-class constructor option on the `Arbre` instance: `new Arbre({ app: 'payments-service' })`
- `app` is automatically attached to every `Log` emitted by that instance
- The `Log` type in `packages/arbre` gains an optional `app` field
- The postgres adapter stores `app` in the database
- The `app` value originates from the library consumer, not from the API or environment

### Claude's Discretion
- Exact migration file format and whether to use a migration runner library or plain psql
- Whether `app` is a top-level `Arbre` constructor option or part of an options object
- Index strategy on the `logs` table beyond what already exists

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PERS-01 | Migrations own the database schema -- runtime DDL removed from `PostgresStorageAdapter` | Extract `init()` DDL to `apps/api/migrations/001_create_logs.sql`, run via `sql.file()` in a migrate script, remove `init()` method and its call in `apps/api/src/index.ts` |
| PERS-02 | `app` field mapping bug fixed -- stored value reflects actual app identifier, not null | Add `app?: string` to `Log` type, accept `app` in `Arbre` constructor, attach to every log. Update ingest JSON Schema to allow `app` field. The adapter's `toRow()` already reads `app` correctly once it exists on the type. |
| PERS-03 | Original: `PrismaStorageAdapter` replaces `PostgresStorageAdapter`. **OVERRIDDEN by user decision**: Keep `PostgresStorageAdapter`, remove Prisma entirely. Requirement is satisfied by the existing adapter continuing to work with the corrected `app` field. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `postgres` | 3.4.8 | PostgreSQL client (tagged template SQL) | Already in use. Zero-dependency, fast, supports `sql.file()` for migration scripts |

### Supporting
No additional libraries needed. The `postgres` package's `sql.file()` method handles running migration SQL files directly -- no migration runner library required.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain `sql.file()` for migrations | `postgres-shift`, `ley`, `pgmg` | Overkill for a single table. Plain SQL file + a 10-line script is simpler and has no dependency |

## Architecture Patterns

### Migration File Structure
```
apps/api/
├── migrations/
│   └── 001_create_logs.sql    # DDL extracted from adapter.init()
├── scripts/
│   └── migrate.ts             # Reads and runs migration files via sql.file()
└── src/
    └── storage/
        └── postgres.ts        # init() method removed
```

### Pattern 1: Migration Script via `sql.file()`
**What:** A minimal script that connects to Postgres and runs SQL migration files in order.
**When to use:** At setup time, before first `npm run dev`.
**Example:**
```typescript
// Source: postgres npm README - sql.file() API
import postgres from "postgres"

const sql = postgres(process.env.DATABASE_URL!)
await sql.file("migrations/001_create_logs.sql")
await sql.end()
```

### Pattern 2: `app` as Constructor Option on Arbre
**What:** `Arbre` constructor accepts an options object with optional `app` string. Every log dispatched through that instance gets `app` attached automatically.
**When to use:** When a service wants all its logs tagged with an application identifier.
**Example:**
```typescript
const arbre = new Arbre({ app: "payments-service" })
// arbre.handleLog() now attaches app to every log before dispatching to layers
```

### Pattern 3: Keeping StorageAdapter Interface Stable
**What:** `StorageAdapter` interface stays unchanged (`insert`, `insertMany`). The `Log` type gains `app` natively, so `toRow()` no longer needs a type cast.
**When to use:** Always -- the adapter pattern is already clean.

### Anti-Patterns to Avoid
- **Running DDL at startup:** The whole point of this phase. Never `CREATE TABLE` in application boot.
- **Burying `app` in `payload`:** The existing `App` layer puts `app` inside `payload`. The user wants `app` as a top-level `Log` field instead.
- **Keeping `packages/database` around "just in case":** Remove it completely. Dead code breeds confusion.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Migration versioning/tracking | A migration state table, checksums, rollback system | Simple numbered SQL files run via `sql.file()` | Single table, single migration. Versioning infra is pure overhead at this scale |

## Common Pitfalls

### Pitfall 1: Forgetting to Update the Ingest JSON Schema
**What goes wrong:** The `app` field is added to the `Log` type and Arbre constructor, but the API's JSON Schema for `POST /ingest` doesn't include `app` in its `properties`. Fastify's schema validation may strip unrecognized properties (depending on `removeAdditional` config) or silently pass them through without validation.
**Why it happens:** The schema is defined inline in `apps/api/src/routes/ingest.ts` and is easy to overlook.
**How to avoid:** Add `app: { type: "string" }` to the `logSchema.properties` in the ingest route. Do NOT make it `required` -- it's optional.
**Warning signs:** Logs arrive in the database with `app: null` despite the client sending an `app` value.

### Pitfall 2: Breaking the Arbre Singleton Pattern
**What goes wrong:** `Arbre` is currently a strict singleton via `get_instance()` with a private constructor. Adding constructor options means the singleton pattern needs rethinking -- you can't pass options to `get_instance()` after first call.
**Why it happens:** The singleton was designed before `app` was a concept.
**How to avoid:** Change `Arbre` to allow instantiation with `new Arbre({ app })`. The singleton can remain as a default instance (no app), but named instances should also be possible. OR: add a static configure method. The user's CONTEXT.md says `new Arbre({ app: 'payments-service' })` -- this implies dropping or relaxing the singleton constraint.
**Warning signs:** TypeScript errors about private constructor.

### Pitfall 3: Not Removing All `@repo/database` References
**What goes wrong:** Build fails or confusing dead references remain.
**Why it happens:** `@repo/database` is referenced in: `apps/api/package.json`, `apps/web/package.json`, `apps/web/next.config.ts` (transpilePackages), root `package-lock.json`, and the `packages/database/` directory itself.
**How to avoid:** Grep for `@repo/database` and `packages/database` across the whole repo. Remove all references, delete the directory, run `npm install` to regenerate lock file.

### Pitfall 4: Leaving the `App` Layer Orphaned
**What goes wrong:** The `App` layer in `packages/arbre/src/layer/app-layer.ts` puts `app` into `payload`. With `app` now a top-level `Log` field set by the constructor, this layer is redundant and confusing.
**Why it happens:** The layer was the original approach before the user decided on constructor-level `app`.
**How to avoid:** Remove or repurpose the `App` layer. Remove its export from `packages/arbre/src/index.ts`.

### Pitfall 5: `sql.file()` Path Resolution
**What goes wrong:** `sql.file()` resolves paths relative to `process.cwd()`, not relative to the script file. If the migrate script is run from the repo root vs `apps/api`, the path breaks.
**Why it happens:** Node.js path resolution behavior.
**How to avoid:** Use `path.resolve(__dirname, '../migrations/001_create_logs.sql')` or similar absolute path construction in the migrate script. Or use `import.meta.url` since the project is ESM.

## Code Examples

### Current `init()` DDL to Extract
```sql
-- Source: apps/api/src/storage/postgres.ts lines 34-47
CREATE TABLE IF NOT EXISTS logs (
  id        BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  level     TEXT        NOT NULL,
  message   TEXT        NOT NULL,
  app       TEXT,
  scope     JSONB,
  payload   JSONB
);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs (level);
CREATE INDEX IF NOT EXISTS idx_logs_app ON logs (app);
```

### Updated Log Type
```typescript
// packages/arbre/src/types/log.ts
export interface Log<Payload = object, Scope extends string = string> {
  timestamp: Date;
  level: LogLevel;
  message: string;
  scope?: Scope;
  payload?: Payload;
  app?: string;  // NEW
}
```

### Updated Arbre Constructor
```typescript
// packages/arbre/src/arbre.ts
interface ArbreOptions {
  app?: string;
}

export class Arbre {
  private _app?: string;

  constructor(options?: ArbreOptions) {
    this._app = options?.app;
  }

  // handleLog attaches app before dispatching to layers
}
```

### Migrate Script
```typescript
// apps/api/scripts/migrate.ts
import postgres from "postgres"
import { fileURLToPath } from "node:url"
import path from "node:path"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sql = postgres(process.env.DATABASE_URL!)
await sql.file(path.resolve(__dirname, "../migrations/001_create_logs.sql"))
await sql.end()
```

### Updated `apps/api/src/index.ts` (init() call removed)
```typescript
const config = loadConfig();
const adapter = new PostgresStorageAdapter(config.database.url);
// NO adapter.init() -- schema owned by migration
const server = createServer(config, adapter);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `adapter.init()` runs DDL at startup | Migration SQL file run manually before first start | This phase | Schema ownership moves to developer, not runtime |
| `App` layer injects `app` into `payload` | `app` is a top-level `Log` field set by `Arbre` constructor | This phase | Clean data model, `app` queryable as its own column |
| `packages/database` with Prisma | Direct `postgres` npm package usage | This phase | Removes ~50MB of Prisma dependencies |

**Deprecated/outdated:**
- `packages/database`: Entire package removed. Was never used by the adapter (adapter uses `postgres` directly).
- `App` layer (`app-layer.ts`): Superseded by constructor-level `app` property.
- `adapter.init()`: Superseded by migration script.

## Open Questions

1. **Singleton vs Instance**
   - What we know: User says `new Arbre({ app: 'payments-service' })` which implies direct instantiation, not singleton.
   - What's unclear: Whether the existing singleton (`get_instance()`) and top-level convenience functions (`info()`, `debug()`, etc.) should still work for the no-app case.
   - Recommendation: Keep `get_instance()` as a default (no-app) instance. Allow `new Arbre(opts)` for named instances. The convenience functions continue to use the singleton. This is Claude's discretion per CONTEXT.md.

2. **Whether to keep `IF NOT EXISTS` in migration SQL**
   - What we know: The migration file will be run manually once.
   - What's unclear: Whether idempotency matters.
   - Recommendation: Keep `IF NOT EXISTS` -- it's harmless and prevents errors on re-runs. No downside.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30 + ts-jest |
| Config file | `apps/api/package.json` (jest key) |
| Quick run command | `npx jest apps/api/src/__tests__/ingest.test.ts` |
| Full suite command | `npm run test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERS-01 | `init()` method removed, DDL in migration file only | manual | Verify `init()` method and call are gone from source | N/A -- structural check |
| PERS-02 | `app` field flows through ingest to storage | unit | `npx jest apps/api/src/__tests__/ingest.test.ts` | Exists but needs `app` field test case |
| PERS-03 | `PostgresStorageAdapter` remains sole adapter (Prisma removed) | manual | Verify `packages/database` directory deleted, no `@repo/database` imports | N/A -- structural check |

### Sampling Rate
- **Per task commit:** `npx jest apps/api/src/__tests__/ingest.test.ts`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- NOTE: User's CLAUDE.md says "Do not write 'test' files or functions. I will handle the actual testing of features myself." -- no new test files should be created.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `apps/api/src/storage/postgres.ts`, `apps/api/src/index.ts`, `packages/arbre/src/arbre.ts`, `packages/arbre/src/types/log.ts`, `apps/api/src/routes/ingest.ts`
- `postgres` npm package README (github.com/porsager/postgres) -- `sql.file()` API, connection lifecycle

### Secondary (MEDIUM confidence)
- `postgres` package version 3.4.8 confirmed from installed `node_modules`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- `postgres` 3.4.8 already installed and working, no new dependencies needed
- Architecture: HIGH -- changes are surgical edits to existing, well-understood code
- Pitfalls: HIGH -- identified from direct code inspection, all verifiable

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stable domain, no fast-moving dependencies)
