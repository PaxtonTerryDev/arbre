import Fastify from "fastify"
import type { Config } from "./config/index.js"
import type { StorageAdapter } from "./storage/index.js"
import cors from "./plugins/cors.js"
import sensible from "./plugins/sensible.js"
import ingestRoutes from "./routes/ingest.js"

export function createServer(config: Config, storage: StorageAdapter) {
  const fastify = Fastify({ logger: config.env !== "test" })
  fastify.register(cors)
  fastify.register(sensible)
  fastify.register(ingestRoutes, { storage })
  return fastify
}
