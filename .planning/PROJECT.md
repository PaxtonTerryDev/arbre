# Arbre

## What This Is

Arbre is a batteries-included, opinionated structured logging system built as a Turborepo monorepo. The core is an npm package (`packages/arbre`) providing a composable, layer-based logging pipeline. It ships with an optional self-hosted log ingestion API (`apps/api`) and a web dashboard (`apps/web`) for browsing logs — positioned as a lightweight drop-in aggregator alternative.

## Core Value

Developers can add structured, production-grade logging to any Node.js app in minutes, with logs flowing seamlessly from library → API → dashboard without glue code.

## Requirements

### Validated

- ✓ Core `Arbre` class with composable layer pipeline — existing
- ✓ `Stdout` layer (human-readable console output) — existing
- ✓ `Filter` layer (level-based filtering) — existing
- ✓ `Json` layer (structured JSON stdout) — existing
- ✓ `POST /ingest` endpoint accepting single log or `Log[]` with JSON schema validation — existing
- ✓ Storage adapter pattern in API (pluggable persistence) — existing
- ✓ Next.js dashboard shell with Shadcn UI and Recharts — existing
- ✓ Prisma database package with `Log` model — existing
- ✓ Turborepo monorepo with shared packages (types, ui, config-eslint, config-typescript, jest-presets) — existing

### Active

- [ ] HTTP layer: async, non-blocking dispatcher that sends logs to the ingest API
- [ ] File output layer: write logs to disk
- [ ] Filter/sampling layer: drop below threshold or sample high-volume noise (bundled, documented)
- [ ] Publish `packages/arbre` to npm as v0.x with all bundled layers
- [ ] API: in-memory queue to decouple ingest receipt from DB writes
- [ ] API: wire Prisma adapter to store logs in Postgres
- [ ] Web: functional log browser — query, filter, and display persisted logs from Postgres

### Out of Scope

- Redis or external durable queue — in-memory is sufficient for v1
- Real-time log streaming to dashboard — polling is fine for v1
- Alerting, dashboards with aggregate charts — long-term v2 aggregator vision
- v1.0 polished stable API — v0.x, functional first
- Mobile / non-web interfaces

## Context

- Brownfield project: core library infrastructure exists and is functional; the gap is bundled layers, persistence wiring, and a real dashboard
- The `packages/database` Prisma package supports supplying an existing external database — implementers can bring their own DB schema
- Publishing target is npm; the library is intentionally opinionated and not designed for maximum configurability
- The dashboard's long-term vision is a lightweight Datadog/Grafana drop-in; v1 is just browsing raw logs
- The HTTP layer must be async and non-blocking — log calls return immediately; delivery happens in the background

## Constraints

- **Tech stack**: npm (enforced), Turborepo, TypeScript strict, Node.js 22
- **API runtime**: Fastify 5, tsdown bundler, Docker multi-stage on node:22-alpine
- **Web**: Next.js 16 App Router, TailwindCSS 4, Shadcn components
- **Database**: Postgres via Prisma (shared between API and web via `packages/database`)
- **Library bundle**: Dual CJS/ESM via bunchee

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Async non-blocking HTTP layer | Log calls must not block application code | — Pending |
| In-memory queue for API ingest | Sufficient durability for v1; avoids infra complexity | — Pending |
| Publish as v0.x | Functional first, API stability not required | — Pending |
| Prisma shared database package | Share types between API and web without duplication | — Pending |

---
*Last updated: 2026-03-05 after initialization*
