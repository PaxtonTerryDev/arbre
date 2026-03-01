import fp from "fastify-plugin"
import cors from "@fastify/cors"
import type { FastifyInstance } from "fastify"

export default fp(async function (fastify: FastifyInstance) {
  fastify.register(cors, {
    origin: true,
  })
})
