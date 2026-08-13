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
  type ObservabilityRuntime
} from "#observability";
import {
  createWebServer,
  errorFields
} from "#web-server";
import { createRegistry } from "#registry/registry-constructor.js";
import { createDataManager, type DataManager } from "#data-manager";
import {
  createRichContentRuntime,
  type RichContentRuntime
} from "#rich-content";

const runtime = await buildRuntime();

let closing: Promise<void> | undefined;

const closeRuntime = (): void => {
  closing ??= runtime.close().catch((error: unknown): void => {
    process.exitCode = 1;
    console.error("backend shutdown failed", error);
  });
};

// Process termination releases OS resources, but does not run application
// cleanup. Handle normal stop signals so Fastify, PGlite, and observability
// close in order; `once` leaves a second signal to use Node's forced exit.
process.once("SIGINT", closeRuntime);
process.once("SIGTERM", closeRuntime);

interface Runtime {
  readonly config: Configuration;
  readonly database: DatabaseRuntime;
  readonly observability: ObservabilityRuntime;
  readonly dataManager: DataManager;
  readonly richContent: RichContentRuntime;
  readonly address: string;
  close(): Promise<void>;
}

async function buildRuntime(): Promise<Runtime> {
  const config = await createConfiguration();
  const observability = createObservabilityRuntime(config);
  const { logger } = observability;
  const startedAt = performance.now();
  let database: DatabaseRuntime | undefined;

  try {
    const host = requiredHost(config);
    const port = requiredPort(config);
    database = await createDatabase();
    const runtimeDatabase = database;
    const dataManager = createDataManager();
    const richContent = await createRichContentRuntime(runtimeDatabase.database);
    const webServer = createWebServer();
    const registry = createRegistry();

    webServer.registerTransport(registry, logger);

    const address = await webServer.listen({ host, port });

    logger.info("backend.started", {
      address,
      routes: registry.list(),
      durationMs: Math.round(performance.now() - startedAt)
    });

    return {
      config,
      database: runtimeDatabase,
      observability,
      dataManager,
      richContent,
      address,
      close: async (): Promise<void> => {
        try {
          await webServer.close();
        } finally {
          try {
            await runtimeDatabase.close();
          } finally {
            await observability.close();
          }
        }
      }
    };
  } catch (error) {
    logger.error("backend.start.failed", {
      durationMs: Math.round(performance.now() - startedAt),
      ...errorFields(error)
    });
    try {
      await database?.close();
    } finally {
      await observability.close();
    }
    throw error;
  }
}

function requiredHost(configuration: Configuration): string {
  const value = configuration.get("server.host");
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Configuration key 'server.host' must be a non-empty string");
  }
  return value;
}

function requiredPort(configuration: Configuration): number {
  const value = configuration.get("server.port");
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 65_535
  ) {
    throw new Error("Configuration key 'server.port' must be an integer from 0 to 65535");
  }
  return value;
}
