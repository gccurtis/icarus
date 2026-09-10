import { createConfiguration } from "$model/server/configuration/index.server";
import { createObservability } from "$model/server/observability/index.server";
import { createStore } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/types";
import { createEmbedding } from "$model/server/embedding/index.server";
import { createIntelligence } from "$model/server/intelligence/index.server";
import { createOperationFlights } from "$model/server/operation-flights/index.server";
import { createExternalFileStorage } from "$model/server/external-file-storage/index.server";
import { resumeAgentTasks } from "$capabilities/agents";
import { ownProcessLifetime, type ProcessShutdownChannel } from "$runtime/server/lifetime.server";

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
 * Observability owns a native stream before Store recovery and External storage
 * reconciliation run. A later startup failure therefore closes observability
 * before it rejects; no half-built graph remains reachable.
 *
 * Not exported: `initServerModel` is the only way to build one, and it returns
 * what it built, so a test asserts on the returned graph rather than needing a
 * second way in to the composition.
 */
const buildServerModel = async (): Promise<ServerModel> => {
  const configuration = await createConfiguration();
  const intelligence = createIntelligence(configuration);
  const embedding = createEmbedding(configuration);
  const observability = createObservability(configuration);
  try {
    // Browser suites may point the process at disposable represented and native
    // stores. Production and ordinary development use the configured locations.
    const store = createStore(configuration, process.env.ICARUS_STORE_DIRECTORY);
    const externalFileStorage = createExternalFileStorage(
      configuration,
      process.env.ICARUS_EXTERNAL_FILE_DIRECTORY
    );
    const heldExternalFiles = store.read("externalFiles");
    if (
      heldExternalFiles?.kind !== "table" ||
      heldExternalFiles.table !== "externalFiles"
    ) {
      throw new Error("The Store did not return its admitted External file table");
    }
    await externalFileStorage.reconcile(heldExternalFiles.rows.map((row) => ({
      ownerId: row._id,
      storageId: row.storageId,
      hash: row.hash,
      size: row.size
    })));
    const operationFlights = createOperationFlights();

    return {
      operationFlights,
      intelligence,
      embedding,
      configuration,
      observability,
      store,
      externalFileStorage,
      close: async () => {
        await operationFlights.close();
        await observability.close();
      }
    };
  } catch (error) {
    await observability.close();
    throw error;
  }
};

/**
 * The one graph, built once at startup.
 *
 * Safe as module state *because none of it is per-user*. Everything here is
 * process infrastructure; identity arrives per request as `Scope`.
 */
let instance: ServerModel | undefined;

/** Concurrent startup callers join one build; a completed build cannot be replaced by init. */
let initializationPromise: Promise<ServerModel> | undefined;

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
 * Browser resets are commands against the one process graph. Keeping their
 * sequence beside that graph prevents two test workers or retries from closing
 * and rebuilding the same instance concurrently. A failed reset releases the
 * sequence so a later diagnostic reset can still run and report its own result.
 */
let browserResetSequence: Promise<void> = Promise.resolve();

/** A failed reset may leave no graph; only the next sequenced reset may rebuild that state. */
let browserResetMayRebuild = false;

/** Every shutdown caller joins the one release rather than returning mid-drain. */
let shutdownPromise: Promise<void> | undefined;

/**
 * Builds the one graph. Called once by `hooks.server.ts`'s `init` hook, which
 * SvelteKit invokes before the server answers its first request.
 *
 * Building here rather than at module load means a configuration error is a
 * startup failure with a logger to report it, rather than a module-load failure
 * without one. Building here rather than on first request means there is exactly
 * one build, at a known moment. The explicit in-flight promise makes accidental
 * concurrent initializers join that build; a later initializer is refused.
 */
const activateServerModel = (model: ServerModel): ServerModel => {
  const resumedAgentTasks = resumeAgentTasks(model);
  model.observability.logger.info("model.started", { resumedAgentTasks });
  return model;
};

/** Activation owns its partially built graph and releases it on every failure. */
const buildActivatedServerModel = async (): Promise<ServerModel> => {
  const model = await buildServerModel();
  try {
    return activateServerModel(model);
  } catch (error) {
    await model.close();
    throw error;
  }
};

export const initServerModel = async (): Promise<ServerModel> => {
  if (closed) throw new Error("The server model is shutting down and cannot be initialized");
  if (instance !== undefined) throw new Error("The server model has already been initialized");
  if (initializationPromise !== undefined) return initializationPromise;

  const initialize = (async () => {
    const model = await buildActivatedServerModel();
    if (closed) {
      await model.close();
      throw new Error("The server model began shutting down during initialization");
    }
    instance = model;
    return model;
  })();
  initializationPromise = initialize;
  try {
    return await initialize;
  } finally {
    if (initializationPromise === initialize) initializationPromise = undefined;
  }
};

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
 * Rebuilds the process graph around a freshly restored disposable browser Store.
 *
 * This seam is admitted only by the development browser harness. Production
 * startup remains one-way, and callers cannot use it without the harness token
 * and validated temporary directory enforced by the route that invokes it.
 */
export const resetServerModelForBrowserHarness = (
  restoreDisposableStore: () => void
): Promise<void> => {
  if (
    process.env.ICARUS_BROWSER_RESET_TOKEN === undefined ||
    process.env.ICARUS_BROWSER_RESET_DIRECTORY === undefined
  ) {
    throw new Error("The browser reset seam is unavailable outside its disposable harness");
  }
  const reset = browserResetSequence.then(async () => {
    if (closed) throw new Error("The server model is shutting down and cannot be reset");

    const model = instance;
    if (model === undefined && !browserResetMayRebuild) {
      throw new Error("The server model has not been built");
    }

    instance = undefined;
    browserResetMayRebuild = true;
    if (model !== undefined) await model.close();
    restoreDisposableStore();
    instance = await buildActivatedServerModel();
    browserResetMayRebuild = false;
  });
  browserResetSequence = reset.catch(() => undefined);
  return reset;
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
export const closeServerModel = (): Promise<void> => {
  if (shutdownPromise !== undefined) return shutdownPromise;
  closed = true;

  shutdownPromise = browserResetSequence.then(async () => {
    const initializing = initializationPromise;
    if (initializing !== undefined) {
      try {
        await initializing;
      } catch {
        // The initializer owns cleanup of its incomplete graph.
      }
    }
    const model = instance;
    if (!model) return;

    // Cleared before closing, so a caller arriving mid-drain cannot be handed a
    // graph whose log stream is already going away. The latch above is what tells
    // it "shutting down" rather than "not built yet".
    instance = undefined;
    await model.close();
  });
  return shutdownPromise;
};

/**
 * Releases the current development graph without turning a module replacement
 * into terminal process shutdown. The replacement hook waits for this promise
 * before asking the (possibly cached) runtime module to initialize again.
 */
const releaseServerModelForDevelopmentReplacement = (): Promise<void> => {
  if (closed) return closeServerModel();

  const release = browserResetSequence.then(async () => {
    if (closed) return;
    const initializing = initializationPromise;
    if (initializing !== undefined) {
      try {
        await initializing;
      } catch {
        // The initializer owns cleanup of its incomplete graph.
      }
    }
    const model = instance;
    instance = undefined;
    if (model !== undefined) await model.close();
  });
  browserResetSequence = release.catch(() => undefined);
  return release;
};

export const ownServerModelLifetime = (
  channel: ProcessShutdownChannel,
  reportFailure: (error: unknown) => void
): Promise<void> | undefined =>
  ownProcessLifetime(
    channel,
    releaseServerModelForDevelopmentReplacement,
    closeServerModel,
    reportFailure
  );
