import { createConfig } from "#init/create/config.js";
import { createApp } from "#init/create/app.js";
import { createIntelligence } from "#init/create/intelligence.js";
import { createKnowledge } from "#init/create/knowledge.js";
import { createFormula } from "#init/create/formula.js";
import { createStructuredDataInstance } from "#init/create/structured-data.js";
import { createFormulaNameResolver } from "#init/create/formula-name-resolver.js";
import { createRichTextInstance } from "#init/create/rich-text.js";
import { createContextManagerInstance } from "#init/create/context.js";
import { createPersonaInstance } from "#init/create/persona.js";
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
import { createSlidesInstance } from "#init/create/slides.js";
import { createActivityInstance } from "#init/create/activity.js";
import { createCommentsInstance } from "#init/create/comments.js";
import { createInvestigationRuntimeInstance } from "#init/create/investigation.js";
import {
  createTemplateResourceRegistry,
  createTemplatesInstance
} from "#init/create/templates.js";
import { SchedulerInternalJobsRuntime } from "#utils/jobs/internalRuntime.js";
import {
  bindResourceRetentionPort,
  ResourceRetentionScheduler
} from "#utils/persistence/resourceRetentionScheduler.js";
import type { DocumentInternalJobIntent } from "#document";
import type { SlideInternalJobIntent } from "#slides";
import { registerDocumentEndpoints } from "#job-wiring/document/registerDocumentEndpoints.js";
import { registerDocumentInternalJobs } from "#job-wiring/document/registerDocumentInternalJobs.js";
import { registerSlidesEndpoints } from "#job-wiring/slides/registerSlidesEndpoints.js";
import { registerSlidesInternalJobs } from "#job-wiring/slides/registerSlidesInternalJobs.js";
import { registerActivityEndpoints } from "#job-wiring/activity/registerActivityEndpoints.js";
import { registerCommentEndpoints } from "#job-wiring/comments/registerCommentEndpoints.js";
import { registerPersonaEndpoints } from "#job-wiring/persona/registerPersonaEndpoints.js";
import { registerInvestigationEndpoints } from "#job-wiring/investigation/registerInvestigationEndpoints.js";
import { registerTemplateEndpoints } from "#job-wiring/templates/registerTemplateEndpoints.js";

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
    // Closes the loop the other way: the registry already resolves Context's
    // leaves, and now Context can ask it what the project holds so a
    // `{ kind: "project" }` entry means the live membership rather than a
    // snapshot. Registered after the resource capabilities exist, so the first
    // enumeration is already complete.
    contextManager.setProjectMembership(resourceRegistry);
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
    const slidesJobs = new SchedulerInternalJobsRuntime<SlideInternalJobIntent>(scheduler);
    const slides = createSlidesInstance(config, richText, activity, slidesJobs, logger);
    registerSlidesInternalJobs(slidesJobs, slides);
    // Templates is constructed after the resource capabilities so their runtime
    // objects can be registered into it without a constructor cycle.
    const templateResources = createTemplateResourceRegistry();
    // One line, no adapter: DocumentCapability satisfies TemplatableResource
    // structurally. This is the only place that sees both, which is what keeps
    // Templates and Document from importing each other.
    templateResources.register(document);
    const templates = createTemplatesInstance(config, templateResources, activity, logger);
    // Parent resources precede their owned resources so retention can cascade
    // through ownership before a generic child sweep sees the same history.
    const retentionScheduler = new ResourceRetentionScheduler(
      config.retention,
      [
        bindResourceRetentionPort("document", document),
        bindResourceRetentionPort("persona", personas),
        bindResourceRetentionPort("templates", templates),
        // Rides the retention sweep rather than owning a timer: it is the same
        // shape of work — conservative, cutoff-driven, reaping what nothing
        // references — and a second scheduler would be a second thing to
        // configure, observe, and shut down. The retention cutoff doubles as the
        // grace period that tells an orphan from a registration in flight.
        bindResourceRetentionPort("templates-orphans", {
          pruneHistory: () => 0,
          purgeExpired: (cutoff) => templates.collectOrphanedResources(cutoff)
        }),
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
    registerSlidesEndpoints(registry, slides, logger);
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
