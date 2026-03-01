import { loadConfig } from "./config/index.js"
import { PostgresStorageAdapter } from "./storage/postgres.js"
import { createServer } from "./server.js"

const config = loadConfig()

;(async () => {
  const adapter = new PostgresStorageAdapter(config.database.url)
  await adapter.init()
  const server = createServer(config, adapter)
  server.listen({ port: config.server.port, host: config.server.host }, (err) => {
    if (err) {
      server.log.error(err)
      process.exit(1)
    }
  })
})()
