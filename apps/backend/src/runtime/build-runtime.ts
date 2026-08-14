// Every capability is reached through its index. Nothing here knows how a
// capability is laid out inside, which is the point of the template.
import {
  createConfiguration,
  type Configuration
} from "#configuration";
import {
  createDatabase,
  type DatabaseRuntime
} from "#persistence";
import {
  createObservabilityRuntime,
  errorFields,
  type ObservabilityRuntime
} from "#observability";
import { createWebServer, type WebServerRuntime } from "#web-server";
import { createIdFactory } from "#id-factory";
import { createNameManager, type NameManager } from "#name-manager";
import {
  createRichContentRuntime,
  type RichContentRuntime
} from "#rich-content";
import { registerBuiltInEndpoints } from "#built-in";
import { createRegistry } from "#registry";
import {
  requiredListenAddress,
  requiredWebServerOptions
} from "#runtime/server-options.js";
import { closeRuntime } from "#runtime/shutdown.js";

/** One built backend: the objects the process holds, and how to stop it. */
export interface Runtime {
  readonly config: Configuration;
  readonly database: DatabaseRuntime;
  readonly observability: ObservabilityRuntime;
  readonly nameManager: NameManager;
  readonly richContent: RichContentRuntime;
  readonly address: string;
  close(): Promise<void>;
}

/**
 * Composes one backend runtime: construct every capability, register every
 * endpoint, then serve.
 *
 * This is the composition root, and the only place that knows the whole set of
 * capabilities a process runs. Each capability knows how to build itself and
 * which endpoints it owns; none of them knows what else exists.
 */
export async function buildRuntime(): Promise<Runtime> {
  // Configuration and observability are constructed first and outside the try,
  // because every failure below is reported through this logger — so it has to
  // exist before anything that can fail. A failure in these two has nothing to
  // log with, and rejects to Node instead.
  const config = await createConfiguration();
  const observability = createObservabilityRuntime(config);
  const { logger } = observability;

  const startedAt = performance.now();
  // Held outside the try so the failure path can close whatever was reached.
  let database: DatabaseRuntime | undefined;
  let webServer: WebServerRuntime | undefined;

  try {
    const address = requiredListenAddress(config);

    // ---------------------------------------------------------------------
    // Runtime objects
    //
    // One instance of each per backend process, in dependency order: nothing
    // is constructed before what it is given. A capability that takes another
    // capability's object receives it here and never reaches for it, which is
    // what lets a test construct one against a substitute.
    // ---------------------------------------------------------------------
    database = await createDatabase(logger);
    const openDatabase = database;

    // One generator of collision-resistant values per runtime. Capabilities
    // keep their own identity semantics — Rich Content decides when a content,
    // atom, mark, or list ID is allocated; this only produces the value.
    const ids = createIdFactory();

    const nameManager = createNameManager(logger);
    const richContent = await createRichContentRuntime(openDatabase.database, ids, logger);

    webServer = createWebServer(requiredWebServerOptions(config), logger);
    const openWebServer = webServer;

    // ---------------------------------------------------------------------
    // Endpoint registration
    //
    // Every endpoint this process serves is registered here, in one list, by
    // calling the `register<Capability>Endpoints` that each capability exports
    // from its own index. The registry itself imports no capability and holds
    // no opinion about what belongs in it.
    //
    // Order does not matter — a duplicate endpoint key throws rather than
    // overwriting — but a capability must be constructed above before its jobs
    // can close over its runtime object.
    // ---------------------------------------------------------------------
    const registry = createRegistry();

    registerBuiltInEndpoints(registry);

    // ---------------------------------------------------------------------
    // Serving
    // ---------------------------------------------------------------------
    openWebServer.registerTransport(registry);
    const boundAddress = await openWebServer.listen(address);

    logger.info("backend.started", {
      address: boundAddress,
      routes: registry.list(),
      durationMs: Math.round(performance.now() - startedAt)
    });

    return {
      config,
      database: openDatabase,
      observability,
      nameManager,
      richContent,
      address: boundAddress,
      close: (): Promise<void> =>
        closeRuntime({
          webServer: openWebServer,
          database: openDatabase,
          observability
        })
    };
  } catch (error) {
    // Startup failed partway. Release whatever was reached, through the same
    // ordered procedure a healthy shutdown uses, and let the caller see the
    // original error rather than anything that went wrong cleaning up after it.
    logger.error("backend.start.failed", {
      durationMs: Math.round(performance.now() - startedAt),
      ...errorFields(error)
    });

    try {
      await closeRuntime({ webServer, database, observability });
    } catch (cleanupError) {
      logger.error("backend.start.cleanup.failed", errorFields(cleanupError));
    }

    throw error;
  }
}
