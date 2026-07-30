import Fastify, { type FastifyInstance } from "fastify";

export const createApp = (): FastifyInstance => Fastify({ logger: true });
