# Requirements: Arbre

**Defined:** 2026-03-05
**Core Value:** Developers can add structured, production-grade logging to any Node.js app in minutes, with logs flowing seamlessly from library → API → dashboard without glue code.

## v1 Requirements

### Persistence

- [ ] **PERS-01**: Prisma migrations own the database schema — runtime DDL removed from `PostgresStorageAdapter`
- [ ] **PERS-02**: `app` field mapping bug fixed — stored value reflects actual app identifier, not null
- [ ] **PERS-03**: `PrismaStorageAdapter` replaces `PostgresStorageAdapter` in the API — logs written via `db.log.create()`

### HTTP Transport Layer

- [ ] **HTTP-01**: `HttpLayer` dispatches logs asynchronously — `handle()` returns immediately, delivery happens in background
- [ ] **HTTP-02**: Endpoint URL is configurable via constructor options object
- [ ] **HTTP-03**: Batch window is configurable — logs buffered for N ms before sending (default: 1000ms)
- [ ] **HTTP-04**: `flush(): Promise<void>` method drains pending logs before process exit
- [ ] **HTTP-05**: SIGTERM handler registered automatically to flush before shutdown
- [ ] **HTTP-06**: All transport behavior (batch size, retry policy, endpoint) configurable via opts

### API Ingest Queue

- [ ] **QUEUE-01**: In-memory queue (via `fastq`) decouples ingest receipt from DB writes — route responds 202 immediately on enqueue
- [ ] **QUEUE-02**: Queue has a hard maximum size — returns 429 when full to prevent unbounded memory growth
- [ ] **QUEUE-03**: Queue drain concurrency is configurable (default: 1)

### File Output Layer

- [ ] **FILE-01**: `FileLayer` writes logs to disk via `pino-roll` with size and frequency rotation
- [ ] **FILE-02**: Output path, rotation strategy, and max file size configurable via constructor opts

### Sampling Layer

- [ ] **SAMP-01**: `SamplingLayer` drops logs below a configured level threshold
- [ ] **SAMP-02**: Sample rate configurable (e.g. keep 1 in N logs above threshold) via constructor opts

### Dashboard

- [ ] **DASH-01**: `GET /logs` endpoint on API returns paginated logs with filtering by level and time range
- [ ] **DASH-02**: Dashboard displays a paginated, sortable table of log entries from Postgres
- [ ] **DASH-03**: UI controls to filter log table by level and scope
- [ ] **DASH-04**: Clicking a log row shows a detail view with full payload

### npm Publish

- [ ] **NPM-01**: `package.json` exports map correctly declares CJS and ESM entry points with `types` condition
- [ ] **NPM-02**: README documents install and quick-start examples for each bundled layer

## v2 Requirements

### Reliability

- **REL-01**: HTTP transport retry with exponential backoff on failed deliveries
- **REL-02**: Dead letter queue for logs that permanently fail delivery

### Dashboard

- **DASH-05**: Aggregate charts — error rate over time, log volume by level
- **DASH-06**: Real-time log stream (polling or SSE)
- **DASH-07**: Saved filters / search presets

### Library

- **LIB-01**: Child logger API — `arbre.child({ scope: 'auth' })` inheriting parent config
- **LIB-02**: Runtime log level changes on the `Filter` layer without restart

### Auth

- **AUTH-01**: API key authentication on `POST /ingest` and `GET /logs`

## Out of Scope

| Feature | Reason |
|---------|--------|
| Redis / external durable queue | Adds infra complexity; in-memory sufficient for target scale (small-medium teams) |
| Real-time WebSocket log streaming | Back-pressure complexity; polling is fine for v1 |
| Alerting and monitoring dashboards | v2 aggregator vision; too complex for v1 |
| Mobile / non-web interfaces | Web-first |
| v1.0 stable API | v0.x — functional first, API lock comes later |
| Log redaction / masking | User responsibility; adds significant complexity |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PERS-01 | Phase 1 | Pending |
| PERS-02 | Phase 1 | Pending |
| PERS-03 | Phase 1 | Pending |
| QUEUE-01 | Phase 2 | Pending |
| QUEUE-02 | Phase 2 | Pending |
| QUEUE-03 | Phase 2 | Pending |
| HTTP-01 | Phase 2 | Pending |
| HTTP-02 | Phase 2 | Pending |
| HTTP-03 | Phase 2 | Pending |
| HTTP-04 | Phase 2 | Pending |
| HTTP-05 | Phase 2 | Pending |
| HTTP-06 | Phase 2 | Pending |
| DASH-01 | Phase 3 | Pending |
| DASH-02 | Phase 3 | Pending |
| DASH-03 | Phase 3 | Pending |
| DASH-04 | Phase 3 | Pending |
| FILE-01 | Phase 4 | Pending |
| FILE-02 | Phase 4 | Pending |
| SAMP-01 | Phase 4 | Pending |
| SAMP-02 | Phase 4 | Pending |
| NPM-01 | Phase 5 | Pending |
| NPM-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-05*
*Last updated: 2026-03-05 after roadmap creation*
