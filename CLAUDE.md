# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Arbre** is a structured logging system built as a Turborepo monorepo. It consists of a core logging library (`packages/arbre`), a Fastify-based log ingestion API (`apps/api`), a Next.js dashboard (`apps/web`), and an Express demo server (`apps/demo`).

**Package manager**: npm (enforced — do not use pnpm, yarn, or bun)

## Commands

All commands are orchestrated via Turborepo and should be run from the repo root unless targeting a specific workspace.

```bash
npm run build        # Build all packages/apps
npm run dev          # Start all apps in watch mode
npm run test         # Run all tests
npm run lint         # Lint all packages
npm run check-types  # TypeScript type checking
npm run format       # Prettier format all TS/TSX/MD files
npm run clean        # Clean all build outputs
```

To run a command in a specific workspace:
```bash
npm run test --workspace=apps/api
npm run dev --workspace=apps/web
```

To run a single test file:
```bash
npx jest apps/api/src/__tests__/ingest.test.ts
```

To build the API Docker image (from `apps/api`):
```bash
docker build -t arbre-api .
```

## Architecture

### Core Library — `packages/arbre`

The heart of the project. Implements a **pipeline/layer** architecture where logs flow through a chain of composable handlers.

- **`Arbre` class**: Singleton managing a list of `Layer` instances. Logs are dispatched through each layer in order.
- **Layers**: Middleware-like handlers (`Stdout`, `Filter`, `Json`). New layers implement a shared `Layer` interface.
- **Log shape**: Generic `Log<Payload, Scope>` — always has `timestamp`, `level`, `message`, and optional `scope`/`payload`.
- **Public API**: Top-level exports `debug()`, `trace()`, `info()`, `warn()`, `error()`, `fatal()` that forward to the singleton.
- **Bundle output**: Dual CJS/ESM via `bunchee` with TypeScript declarations.

### API — `apps/api`

Fastify 5 server for log ingestion.

- **`POST /ingest`**: Accepts a single `Log` or array of `Log[]`, validates via JSON Schema, responds `202 { accepted: number }`.
- **Storage adapter pattern**: Pluggable persistence interface; swap implementations without changing route logic.
- **Config**: Environment variables — `PORT`, `HOST`, `NODE_ENV`, `DATABASE_URL`.
- **Build**: `tsdown` bundles to `dist/index.cjs`; Docker multi-stage build on `node:22-alpine`.

### Web Dashboard — `apps/web`

Next.js 16 App Router frontend.

- **`/dashboard`**: Main view with charts (Recharts), sidebar, and dark mode toggle.
- **UI components**: Mix of local Shadcn-style components in `components/ui/` and the shared `packages/ui` library.
- **Styling**: TailwindCSS 4.

### Shared Packages

- **`packages/types`**: Shared TypeScript type definitions (currently minimal; extend here for cross-app types).
- **`packages/ui`**: Shared React component library used by `apps/web`.
- **`packages/config-eslint`**: Shared ESLint 9 flat config (TypeScript + Prettier + Turbo).
- **`packages/config-typescript`**: Base `tsconfig.json` (strict, ESNext, Bundler resolution).
- **`packages/jest-presets`**: Shared Jest presets using `ts-jest`.

## Testing

Tests use Jest 30 + ts-jest. HTTP integration tests use Supertest. React component tests use React Testing Library.

Test files live in `src/__tests__/` within each package/app.

## Turborepo Task Pipeline

Key dependencies defined in `turbo.json`:
- `build` depends on `^build` (dependencies built first)
- `lint` depends on `^build` and `^lint`
- `check-types` depends on `^build` and `^check-types`
- `dev` is persistent and non-cached
