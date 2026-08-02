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
import { createDocumentInstance } from "#init/create/document.js";
import { createSlideInstance } from "#init/create/slide.js";
import { createActivityInstance } from "#init/create/activity.js";
import { createInvestigationRuntimeInstance } from "#init/create/investigation.js";
import { SchedulerInternalJobsRuntime } from "#utils/jobs/internalRuntime.js";
import type { DocumentInternalJobIntent } from "#document";
import type { SlideInternalJobIntent } from "#capabilities/slide/index.js";
import { registerDocumentEndpoints } from "#job-wiring/document/registerDocumentEndpoints.js";
import { registerDocumentInternalJobs } from "#job-wiring/document/registerDocumentInternalJobs.js";
import { registerSlideEndpoints } from "#job-wiring/slide/registerSlideEndpoints.js";
import { registerSlideInternalJobs } from "#job-wiring/slide/registerSlideInternalJobs.js";
import { registerActivityEndpoints } from "#job-wiring/activity/registerActivityEndpoints.js";
import { registerInvestigationEndpoints } from "#job-wiring/investigation/registerInvestigationEndpoints.js";

export const startBackend = async (): Promise<void> => {
  const config = await createConfig();
  const logger = createLogger(config);
  const startedAt = performance.now();
  try {
    // Activity has no resource dependency and is created before resource
    // integrations eventually publish their accepted transactions into it.
    const activity = createActivityInstance(config);
    const intelligence = createIntelligence(config, logger);
    // The registry is composed before Knowledge and populated once concrete
    // resource capabilities exist. It resolves Context leaves to source IDs and
    // supplies the same trusted identities to Derived Output tools.
    const contextManager = createContextManagerInstance(config, logger);
    const resourceRegistry = createResourceReader(contextManager, logger);
    const knowledge = createKnowledge(
      config.projectId,
      intelligence,
      logger,
      resourceRegistry
    );
    const investigation = createInvestigationRuntimeInstance(config, knowledge, logger);
    resourceRegistry.registerInvestigation(investigation);
    const formula = createFormula(config, logger);
    const structuredData = createStructuredDataInstance(config, logger);
    const formulaResolver = createFormulaNameResolver(formula, structuredData, logger, {
      userId: config.userId,
      projectId: config.projectId
    });
    const richText = createRichTextInstance(config, logger);
    const generalFiles = createGeneralFilesInstance(config, knowledge, logger);
    const { service: connector, store: connectorStore } = createConnectorInstance(
      config,
      knowledge,
      logger
    );
    resourceRegistry.registerGeneralFiles(generalFiles);
    resourceRegistry.registerConnector(connector);
    const derivedOutputs = createDerivedOutputServiceInstance(
      config,
      knowledge,
      intelligence,
      resourceRegistry,
      logger
    );
    knowledge.onSourceMutation((mutation) => {
      derivedOutputs.recordKnowledgeSourceMutation(mutation);
    });
    const app = createApp();
    const scheduler = createScheduler(config, logger);
    const registry = createRegistry(scheduler);
    const documentJobs = new SchedulerInternalJobsRuntime<DocumentInternalJobIntent>(scheduler);
    const slideJobs = new SchedulerInternalJobsRuntime<SlideInternalJobIntent>(scheduler);
    const document = createDocumentInstance(
      config,
      richText,
      formula,
      formulaResolver,
      derivedOutputs,
      activity,
      documentJobs,
      logger
    );
    registerDocumentInternalJobs(documentJobs, document);
    const slide = createSlideInstance(
      config,
      richText,
      derivedOutputs,
      slideJobs,
      logger
    );
    registerSlideInternalJobs(slideJobs, slide);

    logger.info("Backend starting", {
      host: config.server.host,
      port: config.server.port,
      concurrentWorkers: config.workerPool.concurrentWorkers,
      loggingEnabled: config.logging.enabled,
      loggingLevel: config.logging.level,
      intelligenceProvider: config.intelligence.embedding.provider,
      intelligenceModel: config.intelligence.embedding.model,
      intelligenceReady: Boolean(intelligence),
      knowledgeReady: Boolean(knowledge),
      investigationReady: Boolean(investigation),
      formulaReady: Boolean(formula),
      structuredDataReady: Boolean(structuredData),
      formulaResolverReady: Boolean(formulaResolver),
      richTextReady: Boolean(richText),
      contextReady: Boolean(contextManager),
      generalFilesReady: Boolean(generalFiles),
      connectorReady: Boolean(connector),
      resourceRegistryReady: Boolean(resourceRegistry),
      derivedOutputsReady: Boolean(derivedOutputs),
      activityReady: Boolean(activity),
      documentReady: Boolean(document),
      slideReady: Boolean(slide)
    });

    registerStructuredDataEndpoints(registry, structuredData, formula, formulaResolver, logger);
    registerContextEndpoints(registry, contextManager);
    registerDerivedOutputEndpoints(registry, derivedOutputs, logger);
    registerGeneralFileEndpoints(registry, generalFiles, logger);
    registerConnectorEndpoints(registry, connector, logger);
    registerActivityEndpoints(registry, activity, logger);
    registerInvestigationEndpoints(registry, investigation, logger);
    registerDocumentEndpoints(registry, document, logger);
    registerSlideEndpoints(registry, slide, logger);

    const recoveredDocumentAttempts = await document.recoverPendingAttempts();
    logger.info("document.attempts.recovered", { count: recoveredDocumentAttempts });
    const recoveredDocumentActivity = await document.publishPendingActivity();
    logger.info("document.activity.recovered", { count: recoveredDocumentActivity });
    const recoveredSlideAttempts = await slide.recoverPendingAttempts();
    logger.info("slide.attempts.recovered", { count: recoveredSlideAttempts });

    const syncScheduler = new ConnectorSyncScheduler(
      connectorStore,
      scheduler,
      connector,
      logger
    );

    registerHttpTransport(app, { scheduler, registry, logger });

    await app.listen({
      host: config.server.host,
      port: config.server.port
    });
    // Start recurring work only after the transport has bound successfully.
    // Otherwise a listen failure would leave interval timers keeping the
    // failed startup process alive.
    syncScheduler.start();

    logger.info("Backend listening", { port: config.server.port });
  } catch (error) {
    logger.error("backend.start.failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unknown startup failure",
      durationMs: Math.round(performance.now() - startedAt)
    });
    throw error;
  }
};
