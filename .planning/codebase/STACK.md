# Technology Stack

**Analysis Date:** 2026-03-05

## Languages

**Primary:**
- TypeScript 5.9.3 - All packages and apps (`packages/arbre`, `apps/api`, `apps/demo`)
- TypeScript ^5 - `apps/web` (Next.js frontend)

**Secondary:**
- JavaScript - Config files only (`packages/config-eslint/index.js`, `packages/config-eslint/next.js`, etc.)

## Runtime

**Environment:**
- Node.js >=18 (engines requirement in root `package.json`)
- Node.js 22-alpine used in Docker builds (`apps/api/Dockerfile`)

**Package Manager:**
- npm 10.9.0 (enforced via `packageManager` field in root `package.json`)
- Lockfile: `package-lock.json` present at repo root

## Frameworks

**Core:**
- Fastify 5.0.0 - Log ingestion HTTP server (`apps/api`)
- Next.js 16.1.6 - Web dashboard (`apps/web`)
- Express 4.22.1 - Demo server only (`apps/demo`)
- React 19.2.3 - UI framework (`apps/web`, `packages/ui`)

**Testing:**
- Jest 30.2.0 - Test runner across all packages/apps
- ts-jest ^29.4.6 - TypeScript transform for Jest (`packages/jest-presets`)
- jest-environment-jsdom 30.2.0 - Browser environment for `packages/ui` tests
- Supertest ^7.1.0 - HTTP integration testing (`apps/api`, `apps/demo`)

**Build/Dev:**
- Turborepo 2.8.7 - Monorepo task orchestration (root)
- tsdown ^0.20.3 - TypeScript bundler for `apps/api` and `apps/demo`, outputs CJS
- bunchee ^6.4.0 - Bundler for `packages/arbre` and `packages/ui`, outputs dual CJS/ESM
- Prettier ^3.6.0 - Code formatting (root)

## Key Dependencies

**Critical:**
- `arbre` (workspace `*`) - Core logging library consumed by `apps/api` and `apps/demo`
- `postgres` ^3.4.5 - PostgreSQL client for log storage (`apps/api/src/storage/postgres.ts`)
- `fastify-plugin` ^5.0.0 - Plugin encapsulation for Fastify (`apps/api`)
- `@fastify/cors` ^10.0.0 - CORS support (`apps/api/src/plugins/cors.ts`)
- `@fastify/sensible` ^6.0.0 - HTTP error helpers (`apps/api/src/plugins/sensible.ts`)

**Frontend:**
- Recharts ^2.15.4 - Charting library (`apps/web`)
- TailwindCSS ^4 - Utility CSS (`apps/web`)
- `@base-ui/react` ^1.2.0 - Accessible UI primitives (`apps/web`)
- `radix-ui` ^1.4.3 - Headless UI components (`apps/web`)
- `next-themes` ^0.4.6 - Dark mode support (`apps/web`)
- `class-variance-authority` ^0.7.1 - Variant utility (`apps/web`)
- `clsx` ^2.1.1 - Class name utility (`apps/web`)
- `tailwind-merge` ^3.5.0 - TailwindCSS class merging (`apps/web`)
- `@phosphor-icons/react` ^2.1.10 - Icon library (`apps/web`)
- shadcn ^3.8.5 - Component scaffolding CLI (`apps/web`)

**Shared Internal:**
- `@repo/eslint-config` - ESLint 9 flat config with TypeScript, Prettier, Turbo plugins
- `@repo/jest-presets` - Jest presets (node/browser variants)
- `@repo/typescript-config` - Base tsconfig (strict, ESNext, Bundler resolution)

## Configuration

**Environment (API):**
- `NODE_ENV` - `development` | `production` | `test`
- `PORT` - Server port (default: `3000`)
- `HOST` - Bind address (default: `0.0.0.0`)
- `DATABASE_URL` - PostgreSQL connection string (required for storage)
- Config loaded in `apps/api/src/config/index.ts`

**Build:**
- `turbo.json` - Turborepo task pipeline at repo root
- `apps/api/tsdown.config.ts` - API bundler config (entry: `src/**/*`, format: CJS, output `.cjs`)
- `packages/config-typescript/base.json` - Shared tsconfig (strict, isolatedModules, ESNext, Bundler resolution)

**TypeScript:**
- Strict mode enabled across all packages
- `strictNullChecks: true`
- Module resolution: `Bundler`
- `allowImportingTsExtensions: true`

## Platform Requirements

**Development:**
- Node.js >=18
- npm 10.9.0
- Docker + Docker Compose for local PostgreSQL instance

**Production:**
- Docker: multi-stage `node:22-alpine` build for `apps/api`
- `apps/web` is a Next.js app — compatible with Vercel (`.vercel/**` in Turborepo outputs)

---

*Stack analysis: 2026-03-05*
