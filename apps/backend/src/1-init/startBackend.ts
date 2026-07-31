import { createConfig } from "#init/create/config.js";
import { createApp } from "#init/create/app.js";
import { createIntelligence } from "#init/create/intelligence.js";
import { createKnowledge } from "#init/create/knowledge.js";
import { createLogger } from "#init/create/logger.js";
import { createScheduler } from "#init/create/scheduler.js";
import { createRegistry } from "#init/create/registry.js";
import { registerHttpTransport } from "#transport/registerHttpTransport.js";

export const startBackend = async (): Promise<void> => {
  // Runtime objects are created in dependency order. The registry receives the
  // scheduler because queue-status wiring needs to read scheduler state.
  const config = await createConfig();
  const logger = createLogger(config);
  const intelligence = createIntelligence(config);
  const knowledge = createKnowledge(config.projectId, intelligence);
  const app = createApp();
  const scheduler = createScheduler(config);
  const registry = createRegistry(scheduler);

  logger.info("Backend starting", {
    host: config.server.host,
    port: config.server.port,
    concurrentWorkers: config.workerPool.concurrentWorkers,
    loggingEnabled: config.logging.enabled,
    loggingLevel: config.logging.level,
    loggingDirectory: config.logging.directory,
    intelligenceProvider: config.intelligence.embedding.provider,
    intelligenceModel: config.intelligence.embedding.model,
    intelligenceReady: Boolean(intelligence),
    projectId: config.projectId,
    knowledgeReady: Boolean(knowledge)
  });

  // Register the one HTTP ingress pipeline only after all endpoints are mapped.
  registerHttpTransport(app, { scheduler, registry });

  // Listening is the final startup action; requests cannot arrive before all
  // runtime objects and endpoint mappings are ready.
  await app.listen({
    host: config.server.host,
    port: config.server.port
  });

  app.log.info(`Backend listening on http://localhost:${config.server.port}`);
  logger.info("Backend listening", { port: config.server.port });
};
