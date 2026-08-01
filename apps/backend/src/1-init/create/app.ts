import Fastify, { type FastifyInstance } from "fastify";

// Request/job telemetry is emitted through the shared application Logger in
// registerHttpTransport. Keep Fastify's separate stdout logger disabled so one
// correlated JSONL stream remains authoritative.
export const createApp = (): FastifyInstance => Fastify({ logger: false });
