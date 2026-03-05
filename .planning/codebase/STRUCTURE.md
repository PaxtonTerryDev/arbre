# Codebase Structure

**Analysis Date:** 2026-03-05

## Directory Layout

```
arbre/                          # Monorepo root
├── apps/
│   ├── api/                    # Fastify log ingestion API
│   │   └── src/
│   │       ├── config/         # Config loading
│   │       ├── plugins/        # Fastify plugins
│   │       ├── routes/         # Route handlers
│   │       ├── storage/        # StorageAdapter interface + implementations
│   │       └── __tests__/      # Integration tests
│   ├── demo/                   # Express demo server
│   │   └── src/
│   │       └── __tests__/
│   └── web/                    # Next.js dashboard
│       ├── app/                # App Router pages and layouts
│       │   └── dashboard/      # Dashboard route
│       ├── components/         # App-level React components
│       │   └── ui/             # Shadcn-style primitive components
│       ├── data/
│       │   └── test/           # Static fixture data for charts
│       ├── hooks/              # Custom React hooks
│       └── lib/                # Utility functions
├── packages/
│   ├── arbre/                  # Core logging library
│   │   └── src/
│   │       ├── layer/          # Layer interface + implementations
│   │       ├── types/          # Log and LogLevel types
│   │       └── __tests__/
│   ├── types/                  # Shared cross-app type definitions
│   │   └── src/
│   ├── ui/                     # Shared React component library
│   │   └── src/
│   │       ├── counter-button/
│   │       └── link/
│   ├── config-eslint/          # Shared ESLint 9 flat config
│   ├── config-typescript/      # Shared tsconfig.json base
│   └── jest-presets/           # Shared Jest presets
│       ├── browser/
│       └── node/
├── turbo.json                  # Turborepo task pipeline
└── package.json                # Root workspace manifest
```

## Directory Purposes

**`apps/api/src/config/`:**
- Purpose: Environment-based config loading
- Key files: `apps/api/src/config/index.ts` — exports `Config` interface and `loadConfig()`

**`apps/api/src/plugins/`:**
- Purpose: Fastify plugin registrations
- Key files: `apps/api/src/plugins/cors.ts`, `apps/api/src/plugins/sensible.ts`

**`apps/api/src/routes/`:**
- Purpose: Route handler definitions
- Key files: `apps/api/src/routes/ingest.ts` — `POST /ingest` with inline JSON Schema validation

**`apps/api/src/storage/`:**
- Purpose: Pluggable persistence layer
- Key files: `apps/api/src/storage/index.ts` (interface), `apps/api/src/storage/postgres.ts` (Postgres implementation)

**`apps/web/app/`:**
- Purpose: Next.js App Router pages and root layout
- Key files: `apps/web/app/layout.tsx` (root), `apps/web/app/page.tsx` (index), `apps/web/app/dashboard/page.tsx`

**`apps/web/components/`:**
- Purpose: App-specific React components (charts, sidebar, nav)
- Key files: `apps/web/components/app-sidebar.tsx`, `apps/web/components/area-chart.tsx`, `apps/web/components/bar-chart.tsx`

**`apps/web/components/ui/`:**
- Purpose: Shadcn-style primitive UI components (local copies)
- Contains: `button.tsx`, `card.tsx`, `sidebar.tsx`, `chart.tsx`, `select.tsx`, etc.

**`packages/arbre/src/layer/`:**
- Purpose: Layer interface and all built-in layer implementations
- Key files: `index.ts` (interface), `stdout-layer.ts`, `filter-layer.ts`, `json-layer.ts`, `app-layer.ts`

**`packages/arbre/src/types/`:**
- Purpose: Core log type definitions
- Key files: `packages/arbre/src/types/log.ts` — `Log<Payload, Scope>` and `LogLevel`

## Key File Locations

**Entry Points:**
- `packages/arbre/src/index.ts`: Public API — exports all logging functions and layer classes
- `apps/api/src/index.ts`: API process entry — wires config, adapter, and server
- `apps/api/src/server.ts`: Server factory — `createServer(config, storage)`
- `apps/web/app/layout.tsx`: Next.js root layout
- `apps/demo/src/index.ts`: Demo server entry

**Configuration:**
- `turbo.json`: Turborepo task dependencies and caching
- `package.json`: Root workspace manifest, npm workspaces
- `apps/api/src/config/index.ts`: API runtime config

**Core Logic:**
- `packages/arbre/src/arbre.ts`: Singleton and pipeline execution
- `packages/arbre/src/layer/index.ts`: Layer interface definition
- `apps/api/src/routes/ingest.ts`: Ingest route with validation
- `apps/api/src/storage/postgres.ts`: Postgres adapter with schema init

**Testing:**
- `packages/arbre/src/__tests__/log.test.ts`
- `apps/api/src/__tests__/ingest.test.ts`
- `apps/demo/src/__tests__/server.test.ts`
- `packages/ui/src/counter-button/index.test.tsx`
- `packages/ui/src/link/index.test.tsx`

## Naming Conventions

**Files:**
- TypeScript source: `kebab-case.ts` (e.g., `stdout-layer.ts`, `filter-layer.ts`)
- React components: `kebab-case.tsx` (e.g., `app-sidebar.tsx`, `area-chart.tsx`)
- Test files: `<name>.test.ts` or `<name>.test.tsx`, placed in `src/__tests__/`
- Config files: `<name>.config.ts` (e.g., `tsdown.config.ts`)

**Directories:**
- Feature directories: `kebab-case` (e.g., `counter-button/`, `config-eslint/`)
- Test directories: `__tests__/` within `src/`

**Classes and Interfaces:**
- Classes: `PascalCase` (e.g., `Arbre`, `Stdout`, `Filter`, `PostgresStorageAdapter`)
- Interfaces: `PascalCase` with no `I` prefix (e.g., `Layer`, `StorageAdapter`, `Config`)
- Types: `PascalCase` (e.g., `Log`, `LogLevel`, `LogRow`)

## Where to Add New Code

**New Layer (core library):**
- Implementation: `packages/arbre/src/layer/<name>-layer.ts` implementing `Layer` interface
- Export: Add to `packages/arbre/src/index.ts`

**New API Route:**
- Implementation: `apps/api/src/routes/<name>.ts` as a Fastify plugin
- Register: Add `fastify.register(...)` call in `apps/api/src/server.ts`

**New Storage Adapter:**
- Implementation: `apps/api/src/storage/<name>.ts` implementing `StorageAdapter` from `apps/api/src/storage/index.ts`

**New Web Page:**
- Implementation: `apps/web/app/<route>/page.tsx`

**New Web Component:**
- App-specific: `apps/web/components/<name>.tsx`
- Primitive/UI: `apps/web/components/ui/<name>.tsx`
- Shared across apps: `packages/ui/src/<name>/index.tsx`

**Shared Types:**
- Cross-app types: `packages/types/src/index.ts`
- Library-internal types: `packages/arbre/src/types/<name>.ts`

**New Test:**
- Place in `src/__tests__/<name>.test.ts` within the relevant app or package

## Special Directories

**`dist/`:**
- Purpose: Build output for packages and apps
- Generated: Yes
- Committed: No (in .gitignore)

**`.next/`:**
- Purpose: Next.js build cache and output
- Generated: Yes
- Committed: No

**`.turbo/`:**
- Purpose: Turborepo task cache and daemon state
- Generated: Yes
- Committed: No (cache is remote/local only)

**`.planning/`:**
- Purpose: GSD planning documents
- Generated: No (hand-authored)
- Committed: Yes

---

*Structure analysis: 2026-03-05*
