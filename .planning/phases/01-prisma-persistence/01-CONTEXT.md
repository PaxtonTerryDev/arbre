# Phase 1: Postgres Persistence - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the postgres storage adapter so logs are persisted correctly to Postgres. Remove the `packages/database` Prisma package entirely — Prisma is overkill for this use case. Fix schema ownership (move DDL out of startup, into a migration script) and fix the `app` field bug by making `app` a first-class property of the `Arbre` instance.

</domain>

<decisions>
## Implementation Decisions

### ORM / Persistence approach
- Drop Prisma entirely — remove `packages/database` and all `@prisma/*` dependencies
- Keep and improve the existing `PostgresStorageAdapter` using the raw `postgres` npm package
- No Prisma schema, no Prisma client, no migration CLI from Prisma

### Schema management
- DDL must NOT run at API startup — remove `adapter.init()` DDL call from `apps/api/src/index.ts`
- Add a SQL migration file (e.g. `apps/api/migrations/001_create_logs.sql`) with the `CREATE TABLE` and index DDL
- Add an `npm run db:migrate` script to `apps/api/package.json` that applies the migration against `DATABASE_URL`
- Developer runs `npm run db:migrate --workspace=apps/api` once before first start

### Database config
- Standard `.env` file (e.g. `apps/api/.env`) with `DATABASE_URL` — already supported by the config loader
- No separate config format needed

### `app` field
- `app` is a first-class constructor option on the `Arbre` instance: `new Arbre({ app: 'payments-service' })`
- `app` is automatically attached to every `Log` emitted by that instance
- The `Log` type in `packages/arbre` gains an optional `app` field
- The postgres adapter stores `app` in the database — enables grouping logs by application across a shared API deployment
- The `app` value originates from the library consumer, not from the API or environment

### Claude's Discretion
- Exact migration file format and whether to use a migration runner library or plain psql
- Whether `app` is a top-level `Arbre` constructor option or part of an options object
- Index strategy on the `logs` table beyond what already exists

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/storage/postgres.ts`: `PostgresStorageAdapter` — already implements `StorageAdapter` interface. Has `insert()`, `insertMany()`, and `init()` (DDL to remove). Has `app` field already mapped via cast, needs proper typing.
- `apps/api/src/storage/index.ts`: `StorageAdapter` interface — stays as-is
- `apps/api/src/config/index.ts`: config loader already reads `DATABASE_URL` from environment

### Established Patterns
- Storage adapter pattern: routes receive a `StorageAdapter` via plugin options, not direct DB access
- Config loaded once at startup and passed into `createServer(config, storage)`

### Integration Points
- `apps/api/src/index.ts` bootstraps the adapter — this is where `adapter.init()` DDL call must be removed
- `packages/arbre` `Arbre` class and `Log` type — `app` field needs to be added here
- `packages/database` — to be fully removed (package dir, workspace reference in root `package.json`, any imports)

</code_context>

<specifics>
## Specific Ideas

- `app` is meant to differentiate between multiple services sending logs to the same shared API + database. Think "payments-service", "auth-service", "web-app" all pointing at one Arbre API deployment.
- The user originally prototyped an "app layer" pattern but prefers `app` as a first-class constructor property on `Arbre` rather than a separate layer.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-prisma-persistence*
*Context gathered: 2026-03-05*
