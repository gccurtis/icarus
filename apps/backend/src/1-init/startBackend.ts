import { createConfig } from "#init/create/config.js";
import { createApp } from "#init/create/app.js";
import { createIntelligence } from "#init/create/intelligence.js";
import { createKnowledge } from "#init/create/knowledge.js";
import { createFormula } from "#init/create/formula.js";
import { createStructuredDataInstance } from "#init/create/structured-data.js";
import { createFormulaNameResolver } from "#init/create/formula-name-resolver.js";
import { createRichTextInstance } from "#init/create/rich-text.js";
import { createContextManagerInstance } from "#init/create/context.js";
import { createLogger } from "#init/create/logger.js";
import { createScheduler } from "#init/create/scheduler.js";
import { createRegistry } from "#init/create/registry.js";
import { registerHttpTransport } from "#transport/registerHttpTransport.js";
import { registerStructuredDataEndpoints } from "#job-wiring/structured-data/registerStructuredDataEndpoints.js";
import { registerContextEndpoints } from "#job-wiring/context/registerContextEndpoints.js";
import { registerDerivedOutputEndpoints } from "#job-wiring/derived-outputs/registerDerivedOutputEndpoints.js";
import { registerGeneralFileEndpoints } from "#job-wiring/general-files/registerGeneralFileEndpointMappings.js";
import { registerConnectorEndpoints } from "#job-wiring/connector/registerConnectorEndpointMappings.js";
import { createDerivedOutputServiceInstance } from "#init/create/derived-outputs.js";
import { createGeneralFilesInstance } from "#init/create/generalFiles.js";
import { createConnectorInstance } from "#init/create/connector.js";
import { ConnectorSyncScheduler } from "#init/create/connectorSyncScheduler.js";
import { createResourceReader } from "#init/create/resource-reader.js";

export const startBackend = async (): Promise<void> => {
  const config = await createConfig();
  const logger = createLogger(config);
  const intelligence = createIntelligence(config, logger);
  // Context is created before knowledge so it can be injected as the scope resolver.
  const contextManager = createContextManagerInstance(config, logger);
  const knowledge = createKnowledge(config.projectId, intelligence, logger, contextManager);
  const formula = createFormula(config, logger);
  const structuredData = createStructuredDataInstance(config, logger);
  const formulaResolver = createFormulaNameResolver(formula, structuredData, logger, {
    userId: config.userId,
    projectId: config.projectId
  });
  const richText = createRichTextInstance(config, logger);
  const resourceReader = createResourceReader();
  const derivedOutputs = createDerivedOutputServiceInstance(config, knowledge, intelligence, resourceReader, logger);
  const generalFiles = createGeneralFilesInstance(config, knowledge, logger);
  const { service: connector, store: connectorStore } = createConnectorInstance(config, knowledge, logger);
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
    userId: config.userId,
    knowledgeReady: Boolean(knowledge),
    formulaReady: Boolean(formula),
    structuredDataReady: Boolean(structuredData),
    formulaResolverReady: Boolean(formulaResolver),
    richTextReady: Boolean(richText),
    contextReady: Boolean(contextManager),
    generalFilesReady: Boolean(generalFiles)
  });

  registerStructuredDataEndpoints(registry, structuredData, formula, formulaResolver, logger);
  registerContextEndpoints(registry, contextManager);
  registerDerivedOutputEndpoints(registry, derivedOutputs, logger);
  registerGeneralFileEndpoints(registry, generalFiles, logger);
  registerConnectorEndpoints(registry, connector, logger);

  // Start the connector sync scheduler
  const syncScheduler = new ConnectorSyncScheduler(connectorStore, scheduler, connector, logger);
  syncScheduler.start();

  registerHttpTransport(app, { scheduler, registry });

  await app.listen({
    host: config.server.host,
    port: config.server.port
  });

  app.log.info(`Backend listening on http://localhost:${config.server.port}`);
  logger.info("Backend listening", { port: config.server.port });
};
