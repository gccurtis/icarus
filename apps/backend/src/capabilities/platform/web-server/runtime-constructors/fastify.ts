import Fastify, { type FastifyInstance } from "fastify";

/** Creates the current Fastify web-server adapter. */
export const createFastifyWebServer = (): FastifyInstance => Fastify({ logger: false });
