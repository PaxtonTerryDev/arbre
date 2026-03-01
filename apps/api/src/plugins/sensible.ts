import fp from "fastify-plugin"
import sensible from "@fastify/sensible"
import type { FastifyInstance } from "fastify"

export default fp(async function (fastify: FastifyInstance) {
  fastify.register(sensible)
})
