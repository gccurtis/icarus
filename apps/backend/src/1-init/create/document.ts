import type { FormulaEngine } from "#formula";
import type { FormulaNameResolver } from "#init/create/formula-name-resolver.js";
import type { Logger } from "#platform/observability/logger.js";
import type { RichText } from "#rich-text";
import type { BackendConfig } from "#utils/config/loadBackendConfig.js";
import type { InternalJobsRuntime } from "#utils/jobs/internalRuntime.js";
import {
  createDocumentCapability,
  SQLiteDocumentStore,
  type DocumentCapability,
  type DocumentDerivedOutputs,
  type DocumentInternalJobIntent
} from "#document";

const DOCUMENT_DB_PATH = "./data/documents.db";

export const createDocumentInstance = (
  config: BackendConfig,
  richText: RichText,
  formula: FormulaEngine,
  formulaResolver: FormulaNameResolver,
  derivedOutputs: DocumentDerivedOutputs,
  jobs: InternalJobsRuntime<DocumentInternalJobIntent>,
  logger: Logger
): DocumentCapability => {
  const store = new SQLiteDocumentStore(config.projectId, DOCUMENT_DB_PATH);
  return createDocumentCapability(store, {
    richText,
    formula,
    formulaResolver,
    derivedOutputs,
    jobs,
    logger,
    attribution: { actorId: config.userId }
  }, config.document);
};
