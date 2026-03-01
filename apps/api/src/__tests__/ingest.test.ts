import { describe, it, expect, jest, beforeEach } from "@jest/globals"
import type { StorageAdapter } from "../storage/index.js"
import { createServer } from "../server.js"
import { loadConfig } from "../config/index.js"

function makeMockStorage(): StorageAdapter {
  return {
    insert: jest.fn<StorageAdapter["insert"]>().mockResolvedValue(undefined),
    insertMany: jest.fn<StorageAdapter["insertMany"]>().mockResolvedValue(undefined),
  }
}

const testConfig = { ...loadConfig(), env: "test" as const }

describe("POST /ingest", () => {
  let storage: StorageAdapter

  beforeEach(() => {
    storage = makeMockStorage()
  })

  it("accepts a single log and returns 202 with accepted: 1", async () => {
    const server = createServer(testConfig, storage)

    const response = await server.inject({
      method: "POST",
      url: "/ingest",
      payload: {
        timestamp: "2024-01-01T00:00:00Z",
        level: "info",
        message: "hello",
      },
    })

    expect(response.statusCode).toBe(202)
    expect(response.json()).toEqual({ accepted: 1 })
    expect(storage.insert).toHaveBeenCalledTimes(1)
  })

  it("accepts an array of logs and returns 202 with correct count", async () => {
    const server = createServer(testConfig, storage)

    const response = await server.inject({
      method: "POST",
      url: "/ingest",
      payload: [
        { timestamp: "2024-01-01T00:00:00Z", level: "info", message: "one" },
        { timestamp: "2024-01-01T00:00:01Z", level: "warn", message: "two" },
      ],
    })

    expect(response.statusCode).toBe(202)
    expect(response.json()).toEqual({ accepted: 2 })
    expect(storage.insertMany).toHaveBeenCalledTimes(1)
  })

  it("returns 400 for missing required fields", async () => {
    const server = createServer(testConfig, storage)

    const response = await server.inject({
      method: "POST",
      url: "/ingest",
      payload: { message: "missing level and timestamp" },
    })

    expect(response.statusCode).toBe(400)
  })

  it("returns 400 for invalid log level", async () => {
    const server = createServer(testConfig, storage)

    const response = await server.inject({
      method: "POST",
      url: "/ingest",
      payload: {
        timestamp: "2024-01-01T00:00:00Z",
        level: "invalid",
        message: "bad level",
      },
    })

    expect(response.statusCode).toBe(400)
  })

  it("passes scope and payload through to storage", async () => {
    const server = createServer(testConfig, storage)

    const payload = {
      timestamp: "2024-01-01T00:00:00Z",
      level: "debug",
      message: "with extras",
      scope: { service: "auth" },
      payload: { userId: 42 },
    }

    await server.inject({
      method: "POST",
      url: "/ingest",
      payload,
    })

    expect(storage.insert).toHaveBeenCalledWith(expect.objectContaining({
      scope: { service: "auth" },
      payload: { userId: 42 },
    }))
  })
})
