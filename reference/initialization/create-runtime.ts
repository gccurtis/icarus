import { createConfig } from "#initialization/runtimes/config.js";
import { createApp } from "#initialization/runtimes/app.js";
import { createIntelligence } from "#initialization/runtimes/intelligence.js";
import { createKnowledge } from "#initialization/runtimes/knowledge.js";
import { createFormula } from "#initialization/runtimes/formula.js";
import { createStructuredDataInstance } from "#initialization/runtimes/structured-data.js";
import { createFormulaNameResolver } from "#initialization/runtimes/formula-name-resolver.js";
import { createRichTextInstance } from "#initialization/runtimes/rich-text.js";
import { createContextManagerInstance } from "#initialization/runtimes/context.js";
import { createPersonaInstance } from "#initialization/runtimes/persona.js";
import { createLogger } from "#initialization/runtimes/logger.js";
import { createScheduler } from "#initialization/runtimes/scheduler.js";
import { createRegistry } from "#initialization/runtimes/registry.js";
import { registerHttpTransport } from "#api/registerHttpTransport.js";
import { registerStructuredDataEndpoints } from "#api/routes/structured-data/registerStructuredDataEndpoints.js";
import { registerContextEndpoints } from "#api/routes/context/registerContextEndpoints.js";
import { registerDerivedOutputEndpoints } from "#api/routes/derived-outputs/registerDerivedOutputEndpoints.js";
import { registerGeneralFileEndpoints } from "#api/routes/general-files/registerGeneralFileEndpointMappings.js";
import { registerConnectorEndpoints } from "#api/routes/connector/registerConnectorEndpointMappings.js";
import { createDerivedOutputServiceInstance } from "#initialization/runtimes/derived-outputs.js";
import { createGeneralFilesInstance } from "#initialization/runtimes/generalFiles.js";
import { createConnectorInstance } from "#initialization/runtimes/connector.js";
import { ConnectorSyncScheduler } from "#initialization/runtimes/connectorSyncScheduler.js";
import { createResourceReader } from "#initialization/runtimes/resource-reader.js";
import { createDocumentInstance } from "#initialization/runtimes/document.js";
import { createActivityInstance } from "#initialization/runtimes/activity.js";
import { createCommentsInstance } from "#initialization/runtimes/comments.js";
import { createInvestigationRuntimeInstance } from "#initialization/runtimes/investigation.js";
import {
  createTemplateAdapterRegistry,
  createTemplatesInstance
} from "#initialization/runtimes/templates.js";
import { SchedulerInternalJobsRuntime } from "#workflows/internalRuntime.js";
import {
  bindResourceRetentionPort,
  ResourceRetentionScheduler
} from "#workflows/resourceRetentionScheduler.js";
import type { DocumentInternalJobIntent } from "#document";
import { registerDocumentEndpoints } from "#api/routes/document/registerDocumentEndpoints.js";
import { registerDocumentInternalJobs } from "#api/routes/document/registerDocumentInternalJobs.js";
import { registerActivityEndpoints } from "#api/routes/activity/registerActivityEndpoints.js";
import { registerCommentEndpoints } from "#api/routes/comments/registerCommentEndpoints.js";
import { registerPersonaEndpoints } from "#api/routes/persona/registerPersonaEndpoints.js";
import { registerInvestigationEndpoints } from "#api/routes/investigation/registerInvestigationEndpoints.js";
import { registerTemplateEndpoints } from "#api/routes/templates/registerTemplateEndpoints.js";

export const startBackend = async (): Promise<void> => {
  const config = await createConfig();
  const logger = createLogger(config);
  const startedAt = performance.now();
  try {
    // Activity has no resource dependency and is created before resource
    // integrations eventually publish their accepted transactions into it.
    const activity = createActivityInstance(config, logger);
    const comments = createCommentsInstance(config, activity, logger);
    const intelligence = createIntelligence(config, logger);
    // The registry is composed before Knowledge and populated once concrete
    // resource capabilities exist. It resolves Context leaves to source IDs and
    // supplies the same trusted identities to Derived Output tools.
    const contextManager = createContextManagerInstance(config, logger);
    const resourceRegistry = createResourceReader(contextManager, logger);
    // Persona's only dependency is Context, which it uses to manage the private
    // wrapper record it owns per persona.
    const personas = createPersonaInstance(config, contextManager, logger);
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
    // Templates is constructed after the resource capabilities so adapters can
    // be registered into it without a constructor cycle. The registry is empty
    // until a resource kind supplies an adapter; until then the three mutating
    // commands answer unsupported_kind and the catalog queries still work.
    const templateAdapters = createTemplateAdapterRegistry();
    const templates = createTemplatesInstance(config, templateAdapters, activity, logger);
    // Parent resources precede their owned resources so retention can cascade
    // through ownership before a generic child sweep sees the same history.
    const retentionScheduler = new ResourceRetentionScheduler(
      config.retention,
      [
        bindResourceRetentionPort("document", document),
        bindResourceRetentionPort("persona", personas),
        bindResourceRetentionPort("templates", templates),
        bindResourceRetentionPort("investigation", investigation),
        bindResourceRetentionPort("derived-outputs", derivedOutputs),
        bindResourceRetentionPort("comments", comments),
        bindResourceRetentionPort("connector", connector),
        bindResourceRetentionPort("general-files", generalFiles),
        bindResourceRetentionPort("structured-data", structuredData),
        bindResourceRetentionPort("context", contextManager)
      ],
      logger
    );

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
      commentsReady: Boolean(comments),
      personaReady: Boolean(personas),
      documentReady: Boolean(document),
      templatesReady: Boolean(templates)
    });

    registerStructuredDataEndpoints(registry, structuredData, formula, formulaResolver, logger);
    registerContextEndpoints(registry, contextManager);
    registerDerivedOutputEndpoints(registry, derivedOutputs, logger);
    registerGeneralFileEndpoints(registry, generalFiles, logger);
    registerConnectorEndpoints(registry, connector, logger);
    registerActivityEndpoints(registry, activity, logger);
    registerCommentEndpoints(registry, comments, logger);
    registerPersonaEndpoints(registry, personas, logger);
    registerInvestigationEndpoints(registry, investigation, logger);
    registerDocumentEndpoints(registry, document, logger);
    registerTemplateEndpoints(registry, templates, logger);

    const recoveredDocumentAttempts = await document.recoverPendingAttempts();
    logger.info("document.attempts.recovered", { count: recoveredDocumentAttempts });
    const recoveredDocumentActivity = await document.publishPendingActivity();
    logger.info("document.activity.recovered", { count: recoveredDocumentActivity });
    const recoveredCommentActivity = await comments.publishPendingActivity();
    logger.info("comments.activity.recovered", { count: recoveredCommentActivity });
    const recoveredTemplateActivity = await templates.publishPendingActivity();
    logger.info("templates.activity.recovered", { count: recoveredTemplateActivity });

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
    await retentionScheduler.start();
    syncScheduler.start();

    logger.info("Backend listening", { port: config.server.port });

    // Flush buffered log writes on shutdown so a killed process does not lose
    // its tail of in-flight log entries.
    const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
      logger.info("Backend shutting down", { signal });
      syncScheduler.stop();
      await retentionScheduler.stop();
      await app.close();
      await logger.close?.();
      process.exit(0);
    };
    process.once("SIGTERM", (signal) => void shutdown(signal));
    process.once("SIGINT", (signal) => void shutdown(signal));
  } catch (error) {
    logger.error("backend.start.failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : "Unknown startup failure",
      durationMs: Math.round(performance.now() - startedAt)
    });
    throw error;
  }
};
