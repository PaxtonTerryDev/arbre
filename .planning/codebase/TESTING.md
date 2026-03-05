# Testing Patterns

**Analysis Date:** 2026-03-05

## Test Framework

**Runner:**
- Jest 30 (`jest@^30.2.0`)
- Config: inline `"jest"` key in each workspace `package.json`, inheriting from `@repo/jest-presets`

**Transform:**
- `ts-jest` — TypeScript compilation handled by ts-jest preset

**Assertion Library:**
- Jest built-in (`expect`)

**Run Commands:**
```bash
npm run test                                              # Run all tests (Turborepo)
npm run test --workspace=apps/api                        # Run tests for a specific workspace
npx jest apps/api/src/__tests__/ingest.test.ts           # Run a single test file
jest --detectOpenHandles                                  # Used in api and demo to catch hanging handles
```

## Test File Organization

**Location:**
- Co-located under `src/__tests__/` within each package/app

**Naming:**
- `[subject].test.ts` — e.g., `log.test.ts`, `ingest.test.ts`, `server.test.ts`

**Structure:**
```
apps/api/src/__tests__/ingest.test.ts
apps/demo/src/__tests__/server.test.ts
packages/arbre/src/__tests__/log.test.ts
packages/types/src/__tests__/log.test.ts
```

## Jest Presets

**Node preset** (`packages/jest-presets/node/jest-preset.mjs`):
- Used by: `apps/api`, `apps/demo`, `packages/arbre`, `packages/types`
- Environment: default (Node)
- Transform: `ts-jest` for all `.ts` and `.tsx` files

**Browser preset** (`packages/jest-presets/browser/jest-preset.mjs`):
- Environment: `jsdom`
- Available for React component tests (currently no active browser tests)

**ESM module mapping** (api only):
- `moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" }` strips `.js` extensions for ts-jest compatibility

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect, jest, beforeEach } from "@jest/globals"

describe("POST /ingest", () => {
  let storage: StorageAdapter

  beforeEach(() => {
    storage = makeMockStorage()
  })

  it("accepts a single log and returns 202 with accepted: 1", async () => {
    // arrange, act, assert
  })
})
```

**Patterns:**
- Always import test globals explicitly from `@jest/globals` — never rely on global injection
- `beforeEach` for per-test setup (fresh mocks)
- `beforeAll` for one-time setup that is safe to share (e.g., adding a layer to singleton)
- Async tests use `async/await` throughout

## Mocking

**Framework:** Jest built-in (`jest.fn`, `jest.spyOn` from `@jest/globals`)

**Factory function pattern for mock objects:**
```typescript
function makeMockStorage(): StorageAdapter {
  return {
    insert: jest.fn<StorageAdapter["insert"]>().mockResolvedValue(undefined),
    insertMany: jest.fn<StorageAdapter["insertMany"]>().mockResolvedValue(undefined),
  }
}
```

**Spying on globals:**
```typescript
jest.spyOn(global.console, "log").mockImplementation(() => {});
// or observe without suppressing:
jest.spyOn(global.console, "log");
```

**What to Mock:**
- Storage adapters (inject mock via `createServer(config, storage)`)
- `console.log` when testing output-producing layers

**What NOT to Mock:**
- HTTP server itself — use Fastify's `server.inject()` or Supertest for real HTTP calls
- Config loading — override specific fields: `{ ...loadConfig(), env: "test" as const }`

## Fixtures and Factories

**Test Data:**
- Inline literal objects within each `it` block — no shared fixture files
- Config override pattern: `const testConfig = { ...loadConfig(), env: "test" as const }`

**Location:**
- No dedicated fixtures directory; `packages/jest-presets/node/jest-preset.mjs` references `<rootDir>/test/__fixtures__` in `modulePathIgnorePatterns` but this directory does not currently exist

## Coverage

**Requirements:** None enforced — no coverage thresholds configured
**View Coverage:**
```bash
npx jest --coverage
```

## Test Types

**Unit Tests:**
- `packages/arbre/src/__tests__/log.test.ts` — tests singleton dispatch through Stdout layer
- `packages/types/src/__tests__/log.test.ts` — tests exported `log()` function output

**Integration Tests:**
- `apps/api/src/__tests__/ingest.test.ts` — full route tests using Fastify's `server.inject()` with mock storage adapter; covers single log, array of logs, validation errors, and field passthrough
- `apps/demo/src/__tests__/server.test.ts` — Express route tests using Supertest; covers health check and dynamic route

**E2E Tests:**
- Not present

## Common Patterns

**Async Testing:**
```typescript
it("info logs to stdout", async () => {
  info("hello");
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/\[info\].*hello/));
})
```

**HTTP Route Testing (Fastify inject):**
```typescript
const server = createServer(testConfig, storage)
const response = await server.inject({
  method: "POST",
  url: "/ingest",
  payload: { timestamp: "2024-01-01T00:00:00Z", level: "info", message: "hello" },
})
expect(response.statusCode).toBe(202)
expect(response.json()).toEqual({ accepted: 1 })
```

**HTTP Route Testing (Supertest):**
```typescript
await supertest(createServer())
  .get("/status")
  .expect(200)
  .then((res) => {
    expect(res.ok).toBe(true);
  });
```

**Partial Object Matching:**
```typescript
expect(storage.insert).toHaveBeenCalledWith(expect.objectContaining({
  scope: { service: "auth" },
  payload: { userId: 42 },
}))
```

**Regex Matching:**
```typescript
expect(console.log).toHaveBeenCalledWith(
  expect.stringMatching(/\[info\].*hello/),
);
```

---

*Testing analysis: 2026-03-05*
