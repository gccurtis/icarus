import Fastify, { type FastifyInstance } from "fastify";

/**
 * Effectively no limit. Fastify wants a positive integer, and two gibibytes is
 * far past anything a legitimate request carries.
 */
const UNBOUNDED_BODY_BYTES = 2_147_483_647;

export interface AppOptions {
  /**
   * Largest accepted request body, in bytes.
   *
   * Passed explicitly rather than left to Fastify, whose default is 1 MiB — a
   * number nobody here chose. Configuration defaults to effectively unbounded,
   * because a rejected request is logged with its payload verbatim and a cap
   * would silently stop that at exactly the size where the payload matters.
   *
   * Nothing legitimate should come close, which is why exceeding the old 1 MiB
   * default is worth a log line even though it is allowed.
   */
  readonly maxBodyBytes: number;
}

// Request/job telemetry is emitted through the shared application Logger in
// registerHttpTransport. Keep Fastify's separate stdout logger disabled so one
// correlated JSONL stream remains authoritative.
/**
 * `options` is optional so the several wiring tests that only need a Fastify
 * instance keep working without caring about body size. Startup always passes
 * the configured value, so the production path is explicit even though the
 * default here is not.
 *
 * (The tests would not have compiled against a required parameter either way —
 * nothing under `test/` is typechecked. See general-updates item 23.)
 */
export const createApp = (options?: AppOptions): FastifyInstance =>
  Fastify({ logger: false, bodyLimit: options?.maxBodyBytes ?? UNBOUNDED_BODY_BYTES });
