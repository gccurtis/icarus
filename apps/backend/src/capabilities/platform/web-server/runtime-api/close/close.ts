import type { FastifyInstance } from "fastify";

/**
 * Stops accepting connections and resolves once in-flight requests have been
 * given the chance to finish. Called first in the shutdown sequence, so no
 * request is still running when the database closes.
 */
export const closeWebServer = (app: FastifyInstance): Promise<void> => app.close();
