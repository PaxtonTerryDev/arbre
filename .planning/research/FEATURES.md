# Feature Research

**Domain:** Node.js structured logging library + self-hosted log aggregator
**Researched:** 2026-03-05
**Confidence:** HIGH (library features), MEDIUM (dashboard features)

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

#### Library (`packages/arbre`)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Six standard log levels (debug/trace/info/warn/error/fatal) | Every production logger has these; level names are industry standard | LOW | Already exists in `LogLevel` type and `Filter` layer |
| Structured JSON output | Production logs must be machine-readable; JSON is the universal format | LOW | Already exists as `Json` layer |
| Human-readable console output | Dev experience without JSON noise; standard in every logger | LOW | Already exists as `Stdout` layer |
| Level-based filtering | Controlling verbosity per-environment (debug in dev, error in prod) is fundamental | LOW | Already exists as `Filter` layer |
| Timestamp on every log entry | Required for any timeline reconstruction or correlation | LOW | Already exists in `Log` type |
| Async, non-blocking output | Log calls that block application I/O are a dealbreaker in production | MEDIUM | HTTP layer is pending; file layer needs this too |
| File output transport | Disk persistence is the baseline before any aggregator is involved | MEDIUM | Pending |
| HTTP transport to ingest endpoint | Core value prop of Arbre's ecosystem — library flows into API | MEDIUM | Pending |
| Scoped/child loggers | Request-scoped context (e.g., `requestId`, `userId`) is standard in pino/winston | MEDIUM | `scope` field exists in `Log` type; no child logger API yet |
| Arbitrary payload on log entries | Structured logs need domain data attached, not just message strings | LOW | Already exists as `payload` field in `Log` type |

#### API (`apps/api`)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Batch log ingestion | Libraries send logs in bursts; single-at-a-time is too chatty | LOW | Already exists (`Log[]` accepted at `/ingest`) |
| Persistent log storage | Ingested logs that vanish on restart are useless | MEDIUM | Postgres adapter exists but Prisma wiring pending |
| JSON schema validation on ingest | Corrupted logs must be rejected at the boundary | LOW | Already exists |
| CORS support | Dashboard on a different origin will be blocked without it | LOW | Already exists |
| Decoupled ingest from write | If DB is slow, ingest should still return 202 fast | MEDIUM | In-memory queue pending |

#### Dashboard (`apps/web`)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Paginated log list | Any log volume makes an unpaginated list unusable | MEDIUM | Not yet implemented |
| Filter by log level | First thing every user does when browsing logs | LOW | Not yet implemented |
| Filter by time range | Debugging always starts with "what happened between X and Y" | MEDIUM | Not yet implemented |
| Filter by scope | Arbre has `scope` as a first-class field; users expect to filter by it | LOW | Not yet implemented |
| Newest-first default sort | Debugging almost always means looking at recent events first | LOW | Not yet implemented |
| Display of structured payload fields | If payload is stored, it must be viewable — raw JSON at minimum | LOW | Not yet implemented |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Zero-config ecosystem wiring | Library → API → dashboard works out of the box with no glue code; competitors require manual integration | MEDIUM | Core Arbre value prop; the HTTP layer + Prisma wiring together deliver this |
| Sampling/rate-limiting layer | Drop high-volume noise logs (e.g., health checks) before they hit the DB; competitors make you write custom code | MEDIUM | Described in PROJECT.md as "Filter/sampling layer" |
| Opinionated layer pipeline | Composable middleware model is easier to reason about than Winston's transport trees or pino-transports | LOW | Already architected; just needs more bundled layers |
| Self-hosted with no external dependencies for v1 | Graylog needs Elasticsearch + MongoDB; ELK is a cluster; Arbre runs as a single container with Postgres | LOW | Architecture decision already made |
| Scope as a first-class field | Most loggers treat context as free-form key-value; Arbre's typed `Scope` generic enforces naming at compile time | LOW | Already in `Log<Payload, Scope>` — worth documenting and marketing |
| npm-publishable library with bundled layers | Pino's transports are separate packages with inconsistent quality; Arbre ships curated layers | LOW | Publish as v0.x goal |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-time WebSocket log streaming to dashboard | Feels impressive; live tail is available in Seq/Loki | Requires persistent connections, back-pressure handling, and auth on WS; high complexity for marginal v1 value | Polling on a short interval (5–10s) gives 90% of the UX at 5% of the cost |
| Alerting and notifications | Datadog does it; users assume every log tool has it | Needs rule engine, delivery channel integrations (Slack, email), and ongoing maintenance; easily becomes the whole product | Mark as v2+ explicitly; users can use external alerting on Postgres directly |
| Aggregate metric charts and dashboards | Looks like value on a demo | Requires aggregation queries, chart configs, and a dashboard builder; competes with Grafana that already does this better | Recharts shell exists — add a single volume-over-time chart as a differentiator, nothing more |
| Log redaction/masking in library | Pino has it; security-conscious users ask for it | Requires path-based redaction logic and testing across nested payloads; complex to get right | Document that users should sanitize payloads before logging; a simple `Filter` layer on specific fields can be user-implemented |
| Multi-tenancy / team access control | Enterprise users ask for it | Adds auth layer, user management, and permission model to what is a single-org tool | Single-user self-hosted is the target; RBAC is a v2+ consideration |
| External queue (Redis/Kafka) for ingest | Durability concern at scale | Massive infrastructure dependency for a tool positioned as lightweight; the whole point is running without extra infra | In-memory queue with documented durability trade-offs is honest and appropriate for v1 |
| Plugin marketplace / community transports | Winston has community transports; users expect extensibility | Unvetted plugins create support burden and API stability pressure; premature for v0.x | The `Layer` interface is already the extension point; document it and let users write their own |

## Feature Dependencies

```
[HTTP transport layer]
    └──requires──> [Ingest API endpoint]
                       └──requires──> [Prisma/Postgres storage adapter]
                                          └──requires──> [Log schema in DB]

[Dashboard log browser]
    └──requires──> [Prisma/Postgres storage adapter]
    └──requires──> [GET /logs API endpoint] (not yet built)

[Sampling layer]
    └──requires──> [Layer pipeline] (already exists)

[File output layer]
    └──requires──> [Layer pipeline] (already exists)

[Scoped child loggers]
    └──enhances──> [HTTP transport layer] (request-scoped context sent with each log)
    └──enhances──> [Dashboard log browser] (enables scope filter)

[In-memory queue in API]
    └──enhances──> [Ingest API endpoint] (decouples receipt from DB write)
```

### Dependency Notes

- **HTTP transport requires the ingest API:** The library layer is useless without a running endpoint to receive logs. These must ship together or the user has no end-to-end path.
- **Dashboard requires a GET endpoint:** Currently only `POST /ingest` exists. The dashboard cannot query logs without a read endpoint — this is a blocking dependency.
- **Sampling layer requires only the pipeline:** Low-risk standalone addition once the pipeline is stable.
- **Child loggers enhance but don't block:** The `scope` field already threads through the system; a child logger API is additive and can ship independently.

## MVP Definition

### Launch With (v1)

- [ ] HTTP transport layer (async, non-blocking) — closes the library → API loop; core value prop is broken without it
- [ ] File output layer — table stakes for any logger; users running without the API need somewhere logs go
- [ ] Sampling/rate-limiting layer — prevents API and DB from being overwhelmed by high-volume callers
- [ ] In-memory queue in API — decouples ingest latency from DB write latency; makes 202 response reliable
- [ ] Prisma adapter wired to Postgres — persisted logs are the prerequisite for any dashboard value
- [ ] GET /logs endpoint with level + scope + time range filters — dashboard cannot function without this
- [ ] Paginated log list in dashboard — simplest possible browsable log view
- [ ] npm publish of `packages/arbre` as v0.x — the library must be installable to have real users

### Add After Validation (v1.x)

- [ ] Scoped child logger API — ergonomic improvement once the core is shipped; validate whether users want it
- [ ] Full-text search on `message` field — basic but adds meaningful diagnostic value once logs are being browsed
- [ ] Log detail view in dashboard — expand a single log entry to see full payload

### Future Consideration (v2+)

- [ ] Real-time log streaming (WebSocket / SSE live tail) — only after polling proves insufficient
- [ ] Alerting rules and notification delivery — separate product surface; high maintenance cost
- [ ] Aggregate dashboards and metric charts — competes with Grafana; only if users are captive in Arbre already
- [ ] Log redaction layer — security feature; add when users report it as a blocker
- [ ] Multi-tenancy and access control — only if Arbre is deployed as a shared service rather than per-team

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| HTTP transport layer | HIGH | MEDIUM | P1 |
| Prisma adapter wired (Postgres persistence) | HIGH | MEDIUM | P1 |
| GET /logs API endpoint with filters | HIGH | MEDIUM | P1 |
| Paginated log browser in dashboard | HIGH | MEDIUM | P1 |
| In-memory queue in API | HIGH | LOW | P1 |
| File output layer | HIGH | LOW | P1 |
| npm publish v0.x | HIGH | LOW | P1 |
| Sampling/rate-limiting layer | MEDIUM | MEDIUM | P2 |
| Child logger / scoped context API | MEDIUM | LOW | P2 |
| Full-text search on message | MEDIUM | LOW | P2 |
| Log detail view (expanded payload) | MEDIUM | LOW | P2 |
| Real-time streaming | LOW | HIGH | P3 |
| Alerting | LOW | HIGH | P3 |
| Log redaction layer | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Pino | Winston | Seq | Our Approach |
|---------|------|---------|-----|--------------|
| Structured JSON output | Native default | Via transport | Ingestion | Native `Json` layer |
| Multiple output transports | Via pino-transports | Built-in, extensible | N/A (aggregator) | Composable `Layer` pipeline |
| Async non-blocking I/O | Worker threads | Transport-dependent | N/A | Async HTTP layer (pending) |
| Child loggers / request context | `child()` method | `child()` method | N/A | `scope` field; child API pending |
| Log level runtime change | `logger.level = x` | `logger.level = x` | N/A | Not yet supported |
| Self-hosted aggregator | No | No | Yes (paid) | Yes, free and self-contained |
| Searchable log browser | No | No | Yes | Yes (pending) |
| Level + scope + time filters | No | No | Yes | Yes (pending) |
| Zero-config ecosystem wiring | No | No | Partial (needs library config) | Yes — core differentiator |

## Sources

- [Better Stack: Comparison of Top 8 Node.js Logging Libraries](https://betterstack.com/community/guides/logging/best-nodejs-logging-libraries/)
- [Better Stack: Pino vs Winston](https://betterstack.com/community/comparisons/pino-vs-winston/)
- [Seq official site — feature overview](https://datalust.co/)
- [SigNoz: Top 8 Open Source Log Management Tools](https://signoz.io/blog/open-source-log-management/)
- [Better Stack: Open Source Log Management Tools](https://betterstack.com/community/comparisons/open-source-log-managament/)
- [SigNoz: Pino Logger Complete Guide](https://signoz.io/guides/pino-logger/)
- [Dash0: Top 5 Node.js Logging Frameworks 2025](https://www.dash0.com/faq/the-top-5-best-node-js-and-javascript-logging-frameworks-in-2025-a-complete-guide)

---
*Feature research for: Node.js structured logging library + self-hosted log aggregator (Arbre)*
*Researched: 2026-03-05*
