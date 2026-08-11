import type { FormulaEngine } from "#formula";
import type { FormulaNameResolver } from "#initialization/runtimes/formula-name-resolver.js";
import type { Logger } from "#capabilities/observability/logger.js";
import type { RichText } from "#rich-text";
import type { BackendConfig } from "#initialization/configuration.js";
import type { InternalJobsRuntime } from "#workflows/internalRuntime.js";
import type {
  ActivityCapability,
  ActivityOrigin,
  ActivityTransactionInput
} from "#activity";
import {
  createDocumentCapability,
  SQLiteDocumentStore,
  type DocumentCapability,
  type DocumentActivityPublisher,
  type DocumentCommittedTransaction,
  type DocumentDerivedOutputs,
  type DocumentInternalJobIntent
} from "#document";

const DOCUMENT_DB_PATH = "./data/documents.db";

const activityOrigin = (origin: DocumentCommittedTransaction["origin"]): ActivityOrigin =>
  origin === "interactive" ? "user" : origin;

const toActivityTransaction = (
  transaction: DocumentCommittedTransaction
): ActivityTransactionInput => ({
  idempotencyKey: transaction.sourceTransactionId,
  kind: "document",
  resourceId: transaction.documentId,
  operation: transaction.kind.slice("document.".length),
  revision: transaction.revision,
  ...(transaction.sourceChangeSetId ? { changeSetId: transaction.sourceChangeSetId } : {}),
  ...(transaction.actorId ? { actorId: transaction.actorId } : {}),
  origin: activityOrigin(transaction.origin),
  occurredAt: transaction.occurredAt,
  metadata: {
    operationTypes: transaction.operationTypes,
    sourceSemanticDigest: transaction.sourceSemanticDigest,
    ...(transaction.compensation ? { compensation: transaction.compensation } : {})
  }
});

const createDocumentActivityPublisher = (
  activity: ActivityCapability
): DocumentActivityPublisher => ({
  publish: async (transaction) => {
    await activity.publish(toActivityTransaction(transaction));
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
