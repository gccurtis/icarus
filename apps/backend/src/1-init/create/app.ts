import Fastify, { type FastifyInstance } from "fastify";

// Request/job telemetry is emitted through the shared application Logger in
// registerHttpTransport. Keep Fastify's separate stdout logger disabled so one
// correlated JSONL stream remains authoritative.
//
// `maxBodyBytes` is passed rather than left to Fastify, whose default is 1 MiB
// — a number nobody here chose. Configuration defaults to effectively
// unbounded, because a rejected request is logged with its payload verbatim and
// a cap would silently stop that at the size where the payload matters most.
// Nothing legitimate should come close, so the transport logs a body over
// 1 MiB as an anomaly rather than refusing it.
export const createApp = (maxBodyBytes: number): FastifyInstance =>
  Fastify({ logger: false, bodyLimit: maxBodyBytes });
