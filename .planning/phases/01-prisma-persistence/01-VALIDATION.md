---
phase: 1
slug: prisma-persistence
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-05
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30 + ts-jest |
| **Config file** | `apps/api/package.json` (jest key) |
| **Quick run command** | `npx jest apps/api/src/__tests__/ingest.test.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest apps/api/src/__tests__/ingest.test.ts`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | PERS-01 | structural | Verify `init()` removed from source | N/A | ⬜ pending |
| 01-01-02 | 01 | 1 | PERS-01 | structural | Verify migration SQL file exists | N/A | ⬜ pending |
| 01-02-01 | 02 | 1 | PERS-02 | unit | `npx jest apps/api/src/__tests__/ingest.test.ts` | Exists (needs app case) | ⬜ pending |
| 01-03-01 | 03 | 1 | PERS-03 | structural | Verify `packages/database` deleted, no `@repo/database` imports | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

User's CLAUDE.md says "Do not write 'test' files or functions. I will handle the actual testing of features myself." — no new test files should be created. Existing infrastructure covers verification needs.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `init()` removed from adapter | PERS-01 | Structural code check, not runtime behavior | Grep for `init()` in postgres.ts, confirm absent |
| Migration SQL runs correctly | PERS-01 | Requires live Postgres connection | Run `npm run db:migrate --workspace=apps/api` against local DB |
| `app` field stored non-null | PERS-02 | End-to-end through running API | POST to /ingest with `app` field, query DB |
| `packages/database` fully removed | PERS-03 | Structural repo check | `find . -path ./node_modules -prune -o -name "database" -print`, grep for `@repo/database` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
