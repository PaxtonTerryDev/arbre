import postgres from "postgres"
import type { Log } from "arbre"
import type { StorageAdapter } from "./index.js"

type LogRow = {
  timestamp: Date
  level: string
  message: string
  app: string | null
  scope: postgres.JSONValue
  payload: postgres.JSONValue
}

function toRow(log: Log): LogRow {
  const raw = log as Log & { app?: string }
  return {
    timestamp: log.timestamp,
    level: log.level,
    message: log.message,
    app: raw.app ?? null,
    scope: (log.scope ?? null) as unknown as postgres.JSONValue,
    payload: (log.payload ?? null) as unknown as postgres.JSONValue,
  }
}

export class PostgresStorageAdapter implements StorageAdapter {
  private sql: postgres.Sql

  constructor(url: string) {
    this.sql = postgres(url)
  }

  async init(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS logs (
        id        BIGSERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL,
        level     TEXT        NOT NULL,
        message   TEXT        NOT NULL,
        app       TEXT,
        scope     JSONB,
        payload   JSONB
      )
    `
    await this.sql`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs (timestamp DESC)`
    await this.sql`CREATE INDEX IF NOT EXISTS idx_logs_level ON logs (level)`
    await this.sql`CREATE INDEX IF NOT EXISTS idx_logs_app ON logs (app)`
  }

  async insert(log: Log): Promise<void> {
    const { timestamp, level, message, app, scope, payload } = toRow(log)
    await this.sql`
      INSERT INTO logs (timestamp, level, message, app, scope, payload)
      VALUES (${timestamp}, ${level}, ${message}, ${app}, ${this.sql.json(scope)}, ${this.sql.json(payload)})
    `
  }

  async insertMany(logs: Log[]): Promise<void> {
    const rows = logs.map(toRow)
    await this.sql`INSERT INTO logs ${this.sql(rows, "timestamp", "level", "message", "app", "scope", "payload")}`
  }
}
