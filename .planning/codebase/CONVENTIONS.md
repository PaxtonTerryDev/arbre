# Coding Conventions

**Analysis Date:** 2026-03-05

## Naming Patterns

**Files:**
- Packages/backend (`.ts`): `kebab-case` with descriptive suffixes — `stdout-layer.ts`, `filter-layer.ts`, `ingest.ts`
- React components (`.tsx`): `kebab-case` — `bar-chart.tsx`, `app-sidebar.tsx`, `dark_mode_toggle.tsx` (one exception uses underscores)
- Index barrel files: `index.ts` at each directory level

**Functions:**
- `camelCase` for regular functions — `createServer`, `loadConfig`, `createHandleLog`, `makeMockStorage`
- `PascalCase` for class constructors and React components — `Arbre`, `Stdout`, `Filter`, `AreaChart`, `BarChart`
- Exception in core library: `get_instance` uses `snake_case` (inconsistency in `packages/arbre/src/arbre.ts`)

**Variables:**
- `camelCase` — `testConfig`, `activeChart`, `filteredData`
- Private class fields prefix with `_` — `_instance`, `_layers`
- Constants: `camelCase` (not UPPER_SNAKE) — `logSchema`, `bodySchema`, `chartConfig`

**Types/Interfaces:**
- `PascalCase` — `Log`, `LogLevel`, `StorageAdapter`, `Config`, `Layer`, `IngestRouteOptions`
- Type aliases: `PascalCase` — `LogRow`, `AreaChartDataPoint`, `AreaChartProps`

## Code Style

**Formatting:**
- Tool: Prettier (root-level, version ^3.6.0)
- Run: `npm run format` formats `**/*.{ts,tsx,md}`
- No `.prettierrc` detected — uses Prettier defaults
- Semicolons: absent in `apps/api` and `packages/arbre` backend code; present in `apps/web` and `apps/demo` frontend/test code (inconsistency across workspaces)

**Linting:**
- ESLint 9 flat config via `@repo/eslint-config`
- All packages extend `packages/config-eslint/index.js`
- Rules: `typescript-eslint` recommended + `eslint-config-prettier` + `eslint-plugin-turbo`
- All violations downgraded to warnings via `eslint-plugin-only-warn`
- `--max-warnings 0` on `lint` scripts enforces zero-warning policy

## TypeScript Configuration

- Base: `packages/config-typescript/base.json` — strict mode, ESNext, Bundler resolution, `noEmit: true`
- `strict: true` and `strictNullChecks: true` enforced across all packages
- `isolatedModules: true` required
- Generics are used liberally: `Log<Payload, Scope>`, `Layer<Payload, Scope>`, `createHandleLog<Payload, Scope>`

## Import Organization

**Order (observed pattern):**
1. External packages — `import Fastify from "fastify"`
2. Internal workspace packages — `import type { StorageAdapter } from "../storage/index.js"`
3. Local relative imports — `import cors from "./plugins/cors.js"`

**Extension handling:**
- Backend `.ts` files use explicit `.js` extensions in imports (required for ESM): `"./config/index.js"`, `"../storage/index.js"`
- Frontend/test files omit extensions: `import { Arbre, Stdout, info } from ".."`

**Path Aliases (web only):**
- `@/` maps to project root in `apps/web` — `import { cn } from "@/lib/utils"`

## Error Handling

**API (Fastify):**
- Schema validation errors surface automatically as 400 via Fastify's JSON Schema validation
- Startup errors use `process.exit(1)` with `server.log.error(err)` — see `apps/api/src/index.ts`
- No try/catch in route handlers; errors propagate to Fastify's error handler

**Library (arbre):**
- `void dispatch(log)` pattern — async dispatch is fire-and-forget, errors are silently swallowed
- Layer pipeline: returning `null` from a layer stops propagation cleanly

## Logging

**Library code:** `console.log` directly (intentional — this IS the logging library)
**API:** Fastify's built-in `pino` logger, disabled in test env: `logger: config.env !== "test"`
**No structured logging** in application code outside the arbre library itself

## Comments

- Comments are largely avoided (per project guidelines)
- JSDoc/TSDoc: not used
- Inline `// eslint-disable-next-line` used only when necessary (seen once in `packages/types/src/__tests__/log.test.ts`)

## Function Design

**Size:** Functions are small and single-purpose — most are under 15 lines
**Parameters:** Prefer typed objects/interfaces over positional primitives for options — `LogOpts<Payload, Scope>`, `IngestRouteOptions`
**Return Values:** Explicit return types on public API functions; inferred on private/internal helpers

## Module Design

**Exports:**
- Named exports for all public symbols — no default exports except Fastify plugin files and route handlers (where Fastify convention requires default)
- Barrel `index.ts` files re-export from submodules

**Class pattern:**
- Singleton via static `get_instance()` in `packages/arbre/src/arbre.ts`
- Interface-first: `Layer` interface defined first, classes implement it

## React Component Conventions (apps/web)

- Client components marked with `"use client"` at top of file
- Props interfaces named `[ComponentName]Props` — `BarChartProps`, `AreaChartProps`
- Destructured props in function signature: `function AreaChart({ data, config, title = "...", ... })`
- `React.useState`, `React.useMemo` — explicit `React.` namespace, not destructured imports
- Tailwind classes inline on JSX elements; `cn()` utility from `apps/web/lib/utils.ts` for conditional classes

---

*Convention analysis: 2026-03-05*
