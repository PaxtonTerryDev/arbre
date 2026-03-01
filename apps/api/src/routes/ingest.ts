import type { FastifyInstance, FastifyPluginOptions } from "fastify"
import type { StorageAdapter } from "../storage/index.js"

const logSchema = {
  type: "object",
  required: ["timestamp", "level", "message"],
  properties: {
    timestamp: { type: "string", format: "date-time" },
    level: { type: "string", enum: ["debug", "trace", "info", "warn", "error", "fatal"] },
    message: { type: "string" },
    scope: {},
    payload: {},
  },
}

const bodySchema = {
  oneOf: [
    logSchema,
    { type: "array", items: logSchema },
  ],
}

interface IngestRouteOptions extends FastifyPluginOptions {
  storage: StorageAdapter
}

export default async function ingestRoutes(
  fastify: FastifyInstance,
  options: IngestRouteOptions,
) {
  const { storage } = options

  fastify.post("/ingest", {
    schema: { body: bodySchema },
  }, async (request, reply) => {
    const body = request.body as Parameters<StorageAdapter["insert"]>[0] | Parameters<StorageAdapter["insertMany"]>[0]

    if (Array.isArray(body)) {
      await storage.insertMany(body)
      return reply.code(202).send({ accepted: body.length })
    }

    await storage.insert(body)
    return reply.code(202).send({ accepted: 1 })
  })
}
