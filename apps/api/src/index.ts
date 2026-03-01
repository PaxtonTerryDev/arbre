import { loadConfig } from "./config/index.js"
import type { StorageAdapter } from "./storage/index.js"
import type { Log } from "arbre"
import { createServer } from "./server.js"

const stubStorage: StorageAdapter = {
  insert(_log: Log): Promise<void> {
    return Promise.resolve()
  },
  insertMany(_logs: Log[]): Promise<void> {
    return Promise.resolve()
  },
}

const config = loadConfig()
const server = createServer(config, stubStorage)

server.listen({ port: config.server.port, host: config.server.host }, (err) => {
  if (err) {
    server.log.error(err)
    process.exit(1)
  }
})
