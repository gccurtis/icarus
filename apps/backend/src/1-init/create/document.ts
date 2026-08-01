import type { FormulaEngine } from "#formula";
import type { FormulaNameResolver } from "#init/create/formula-name-resolver.js";
import type { Logger } from "#platform/observability/logger.js";
import type { RichText } from "#rich-text";
import type { BackendConfig } from "#utils/config/loadBackendConfig.js";
import type { InternalJobsRuntime } from "#utils/jobs/internalRuntime.js";
import type {
  ActivityCapability,
  ActivityOrigin,
  ActivityTransaction
} from "#activity";
import {
  createDocumentCapability,
  SQLiteDocumentStore,
  type DocumentCapability,
  type DocumentActivityPublisher,
  type DocumentCommittedFact,
  type DocumentDerivedOutputs,
  type DocumentInternalJobIntent
} from "#document";

const DOCUMENT_DB_PATH = "./data/documents.db";

const activityOrigin = (origin: DocumentCommittedFact["origin"]): ActivityOrigin =>
  origin === "interactive" ? "user" : origin;

const toActivityTransaction = (
  fact: DocumentCommittedFact
): ActivityTransaction => ({
  id: fact.factId,
  kind: "document",
  resourceId: fact.documentId,
  operation: fact.kind.slice("document.".length),
  revision: fact.revision,
  ...(fact.sourceChangeSetId ? { changeSetId: fact.sourceChangeSetId } : {}),
  ...(fact.actorId ? { actorId: fact.actorId } : {}),
  origin: activityOrigin(fact.origin),
  occurredAt: fact.occurredAt,
  metadata: {
    operationTypes: fact.operationTypes,
    sourceSemanticDigest: fact.sourceSemanticDigest,
    ...(fact.compensation ? { compensation: fact.compensation } : {})
  }
});

const createDocumentActivityPublisher = (
  activity: ActivityCapability
): DocumentActivityPublisher => ({
  publish: async (fact) => {
    await activity.publish(toActivityTransaction(fact));
  }
});

export const createDocumentInstance = (
  config: BackendConfig,
  richText: RichText,
  formula: FormulaEngine,
  formulaResolver: FormulaNameResolver,
  derivedOutputs: DocumentDerivedOutputs,
  activity: ActivityCapability,
  jobs: InternalJobsRuntime<DocumentInternalJobIntent>,
  logger: Logger
): DocumentCapability => {
  const store = new SQLiteDocumentStore(config.projectId, DOCUMENT_DB_PATH);
  return createDocumentCapability(store, {
    richText,
    formula,
    formulaResolver,
    derivedOutputs,
    activityPublisher: createDocumentActivityPublisher(activity),
    jobs,
    logger,
    attribution: { actorId: config.userId }
  }, config.document);
};
