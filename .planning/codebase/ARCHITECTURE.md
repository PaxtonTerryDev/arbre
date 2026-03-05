# Architecture

**Analysis Date:** 2026-03-05

## Pattern Overview

**Overall:** Turborepo monorepo with a pipeline/layer architecture in the core library, adapter pattern in the API, and App Router structure in the frontend.

**Key Characteristics:**
- `packages/arbre` is a singleton-based pipeline where logs flow sequentially through composable `Layer` instances
- Layers can short-circuit the pipeline by returning `null` (used by `Filter`)
- The API separates HTTP concerns (Fastify routes) from storage via a `StorageAdapter` interface
- All cross-workspace types flow from `packages/arbre` (the `Log` type) and `packages/types`

## Layers

**Core Library (`packages/arbre`):**
- Purpose: Structured logging pipeline
- Location: `packages/arbre/src/`
- Contains: `Arbre` singleton, `Layer` interface, concrete layer implementations, log types, public API functions
- Depends on: Nothing external
- Used by: `apps/api` (imports `Log` type), `apps/demo` (imports logging functions)

**API (`apps/api`):**
- Purpose: Log ingestion HTTP service
- Location: `apps/api/src/`
- Contains: Fastify server factory, route handlers, storage adapters, config loader
- Depends on: `packages/arbre` (for `Log` type), `postgres` driver
- Used by: External clients sending logs via `POST /ingest`

**Web Dashboard (`apps/web`):**
- Purpose: Log visualization frontend
- Location: `apps/web/`
- Contains: Next.js App Router pages, chart components, Shadcn-style UI components
- Depends on: `packages/ui`, TailwindCSS, Recharts
- Used by: End users in a browser

**Demo App (`apps/demo`):**
- Purpose: Reference Express server demonstrating arbre usage
- Location: `apps/demo/src/`
- Contains: Express server with health/message routes
- Depends on: Express
- Used by: Developers testing the core library

**Shared Packages:**
- `packages/types` (`packages/types/src/index.ts`): Minimal shared type definitions (currently empty exports)
- `packages/ui` (`packages/ui/src/`): Shared React component library (CounterButton, Link)
- `packages/config-eslint`: Shared ESLint 9 flat config
- `packages/config-typescript`: Base `tsconfig.json`
- `packages/jest-presets`: Shared Jest presets

## Data Flow

**Log Dispatch (packages/arbre):**

1. Caller invokes a top-level function: `info("message", { scope, payload })`
2. `createHandleLog` in `packages/arbre/src/index.ts` constructs a `Log` object with `timestamp`, `level`, `message`, and optional `scope`/`payload`
3. `dispatch` retrieves the `Arbre` singleton and calls `handleLog`
4. `Arbre.handleLog` iterates `_layers` in order, passing the `Log` to each `layer.handle()`
5. If any layer returns `null`, the pipeline stops; otherwise the (possibly mutated) log continues
6. Layers output to stdout directly (`Stdout`, `Json`) or mutate the log (`App`) or gate it (`Filter`)

**Log Ingestion (apps/api):**

1. HTTP client posts to `POST /ingest` with a single `Log` or `Log[]`
2. Fastify validates the body against the inline JSON Schema in `apps/api/src/routes/ingest.ts`
3. Route handler calls `storage.insert()` or `storage.insertMany()` on the injected `StorageAdapter`
4. `PostgresStorageAdapter` maps `Log` to a `LogRow` and runs a parameterized INSERT
5. Handler responds `202 { accepted: N }`

**State Management (apps/web):**
- No global state management; relies on React component state and Next.js App Router
- Chart data currently sourced from static fixtures in `apps/web/data/test/`

## Key Abstractions

**Layer Interface:**
- Purpose: Single unit of log processing in the pipeline
- Location: `packages/arbre/src/layer/index.ts`
- Pattern: `handle(log) => Log | null` — pass-through, transform, or suppress
- Implementations: `Stdout` (`stdout-layer.ts`), `Filter` (`filter-layer.ts`), `Json` (`json-layer.ts`), `App` (`app-layer.ts`)

**StorageAdapter Interface:**
- Purpose: Decouple route logic from persistence backend
- Location: `apps/api/src/storage/index.ts`
- Pattern: `insert(log)` / `insertMany(logs)` — swap implementations without touching routes
- Implementations: `PostgresStorageAdapter` (`apps/api/src/storage/postgres.ts`)

**Log Type:**
- Purpose: Universal log shape shared across the monorepo
- Location: `packages/arbre/src/types/log.ts`
- Shape: `{ timestamp: Date, level: LogLevel, message: string, scope?: Scope, payload?: Payload }`
- Generic parameters allow typed scope and payload

## Entry Points

**Core Library Public API:**
- Location: `packages/arbre/src/index.ts`
- Triggers: Imported by consumer applications
- Responsibilities: Exports `debug`, `trace`, `info`, `warn`, `error`, `fatal` functions and all layer classes

**API Server:**
- Location: `apps/api/src/index.ts`
- Triggers: Node process start
- Responsibilities: Loads config, instantiates `PostgresStorageAdapter`, calls `adapter.init()` to create the DB schema, creates and starts the Fastify server

**Web Root:**
- Location: `apps/web/app/layout.tsx`
- Triggers: Next.js App Router
- Responsibilities: Wraps all pages in `ThemeProvider` and `TooltipProvider`

**Demo Server:**
- Location: `apps/demo/src/index.ts`
- Triggers: Node process start
- Responsibilities: Creates and starts the Express server

## Error Handling

**Strategy:** Fastify built-in error handling via `@fastify/sensible` plugin; API exits process on listen failure

**Patterns:**
- API listen errors call `server.log.error(err)` then `process.exit(1)` (`apps/api/src/index.ts`)
- `Filter` layer returns `null` to suppress logs — not an error but a deliberate pipeline termination
- No explicit try/catch wrapping in route handlers; Fastify handles async errors automatically

## Cross-Cutting Concerns

**Logging:** Fastify's built-in logger is enabled for non-test environments (disabled when `NODE_ENV === "test"`)
**Validation:** JSON Schema inline in `apps/api/src/routes/ingest.ts`, enforced by Fastify before handler runs
**Authentication:** Not implemented

---

*Architecture analysis: 2026-03-05*
