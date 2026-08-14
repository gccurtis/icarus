import type { DatabaseRuntime } from "#persistence";
import type { ObservabilityRuntime } from "#observability";
import type { WebServerRuntime } from "#web-server";

/**
 * What a backend holds open.
 *
 * Every member is optional because startup can fail partway, leaving some of
 * these constructed and the rest never reached. A healthy shutdown passes all
 * three; a failed startup passes what exists. Both go through the one ordered
 * procedure below, so there is no second, shorter shutdown sequence that can
 * drift out of step with this one — which is exactly what had happened: the
 * failure path closed the database and the logger and left the web server open.
 */
export interface OpenResources {
  readonly webServer?: WebServerRuntime;
  readonly database?: DatabaseRuntime;
  readonly observability?: ObservabilityRuntime;
}

/**
 * Releases what a backend holds, in the one order that is safe.
 *
 * Requests stop being accepted before anything an in-flight request might still
 * be using is released, and logging outlives both so a failure on the way down
 * is still recorded. Each step runs even if an earlier one throws — a database
 * that refuses to close must not leave the log stream open — and the first
 * error is the one that propagates.
 */
export const closeRuntime = async ({
  webServer,
  database,
  observability
}: OpenResources): Promise<void> => {
  try {
    await webServer?.close();
  } finally {
    try {
      await database?.close();
    } finally {
      await observability?.close();
    }
  }
};
