import { createConfiguration } from "$model/server/configuration/index.server";
import { createObservability } from "$model/server/observability/index.server";
import { createStore } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/types";

export type { ServerModel } from "$runtime/server/types";
export type { Scope, Session } from "$runtime/server/scope.server";
export type { Configuration } from "$model/server/configuration/index.server";

/**
 * Re-exported so a capability records a failure without reaching past this file.
 *
 * `errorFields` is the shape every log line about a fault is written in, and it
 * belongs to observability. A caller that had to import it from there would be
 * holding two references to the server tree to write one line, and the second
 * one would be the only place this file was not the whole seam.
 */
export { errorFields } from "$model/server/observability/index.server";
export type { Logger } from "$model/server/observability/index.server";

/**
 * How the process comes up: composed, held, handed out, closed — in that order,
 * which is the order this file reads in.
 *
 * See [`server.md`](server.md).
 */

/**
 * Composes the graph once, in dependency order. Holds nothing.
 *
 * Configuration first, because observability is built from it. Neither is
 * wrapped: a failure in either has nothing to log with, so it rejects to the
 * caller and fails startup at `hooks.server.ts`'s `init`.
 *
 * **There is no release path, and that is a fact about what the graph holds
 * rather than an omission.** Nothing is acquired after the last step that can
 * fail, so a failure has nothing to strand. Adding an object that acquires
 * something before a later step can throw means adding the release path with it.
 *
 * Not exported: `initServerModel` is the only way to build one, and it returns
 * what it built, so a test asserts on the returned graph rather than needing a
 * second way in to the composition.
 */
const buildServerModel = async (): Promise<ServerModel> => {
  const configuration = await createConfiguration();
  const observability = createObservability(configuration);
  const store = createStore(configuration);

  observability.logger.info("model.started");

  return {
    configuration,
    observability,
    store,
    close: () => observability.close()
  };
};

/**
 * The one graph, built once at startup.
 *
 * Safe as module state *because none of it is per-user*. Everything here is
 * process infrastructure; identity arrives per request as `Scope`.
 */
let instance: ServerModel | undefined;

/**
 * Once shutdown begins the graph is gone for good.
 *
 * A latch rather than clearing `instance`, because the two states have to be
 * told apart: the server drains in-flight requests for up to thirty seconds
 * after the signal and keep-alive connections keep delivering, so a call
 * arriving mid-drain has to hear "shutting down" rather than "not built yet".
 */
let closed = false;

/**
 * Builds the one graph. Called once by `hooks.server.ts`'s `init` hook, which
 * SvelteKit invokes before the server answers its first request.
 *
 * Building here rather than at module load means a configuration error is a
 * startup failure with a logger to report it, rather than a module-load failure
 * without one. Building here rather than on first request means there is exactly
 * one build, at a known moment — so there is no in-flight promise to cache, no
 * race between concurrent first callers, and no failed build to evict.
 */
export const initServerModel = async (): Promise<ServerModel> =>
  (instance = await buildServerModel());

export const serverModel = (): ServerModel => {
  if (closed) {
    throw new Error("The server model is shutting down and cannot be rebuilt");
  }
  if (!instance) {
    throw new Error(
      "The server model has not been built — hooks.server.ts init() builds it. " +
        "See src/lib/runtime/server/server.md."
    );
  }
  return instance;
};

/**
 * Closes the graph if one was built. Idempotent, and one-way.
 *
 * Everything `serverModel()` hands back is one per process, so a caller imports it.
 * Anything that varies with the request instead — where an import could not name
 * the right one — needs a scoped accessor here, taking what it varies by, and
 * gets its own name rather than joining a bundle everyone then has to grow a
 * field for.
 */
export const closeServerModel = async (): Promise<void> => {
  if (closed) return;
  closed = true;

  const model = instance;
  if (!model) return;

  // Cleared before closing, so a caller arriving mid-drain cannot be handed a
  // graph whose log stream is already going away. The latch above is what tells
  // it "shutting down" rather than "not built yet".
  instance = undefined;
  await model.close();
};
