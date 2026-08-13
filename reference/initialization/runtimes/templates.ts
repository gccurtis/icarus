import type { ActivityCapability, ActivityTransactionInput } from "#activity";
import type { Logger } from "#capabilities/observability/logger.js";
import {
  createTemplateCapability,
  SQLiteTemplateStore,
  type TemplateActivityPublisher,
  type TemplateCapability,
  type TemplateCommittedTransaction,
  type TemplateResourceAdapter,
  type TemplateResourceRegistry
} from "#templates";
import type { BackendConfig } from "#initialization/configuration.js";

const TEMPLATES_DB_PATH = "./data/templates.db";

/**
 * Mutable only during composition. Templates receives it through the narrow
 * read-only TemplateResourceRegistry interface.
 */
export type RuntimeTemplateAdapterRegistry = TemplateResourceRegistry & {
  register(adapter: TemplateResourceAdapter): void;
};

export const createTemplateAdapterRegistry = (): RuntimeTemplateAdapterRegistry => {
  const adapters = new Map<string, TemplateResourceAdapter>();
  return {
    get: (kind) => adapters.get(kind),
    register: (adapter) => {
      adapters.set(adapter.kind, adapter);
    }
  };
};

export const toTemplateActivityTransaction = (
  transaction: TemplateCommittedTransaction
): ActivityTransactionInput => ({
  idempotencyKey: transaction.sourceTransactionId,
  kind: "template",
  resourceId: transaction.templateId,
  operation: transaction.kind.slice("template.".length),
  ...(transaction.actorId ? { actorId: transaction.actorId } : {}),
  origin: transaction.origin,
  occurredAt: transaction.occurredAt,
  metadata: {
    resourceKind: transaction.resourceKind,
    resourceId: transaction.resourceId
  }
});

export const createTemplateActivityPublisher = (
  activity: ActivityCapability
): TemplateActivityPublisher => ({
  publish: async (transaction) => {
    await activity.publish(toTemplateActivityTransaction(transaction));
  }
});

export const createTemplatesInstance = (
  config: BackendConfig,
  adapters: TemplateResourceRegistry,
  activity: ActivityCapability,
  logger: Logger
): TemplateCapability => {
  const store = new SQLiteTemplateStore(config.projectId, TEMPLATES_DB_PATH);
  return createTemplateCapability(
    store,
    {
      adapters,
      logger,
      activityPublisher: createTemplateActivityPublisher(activity),
      attribution: { actorId: config.userId }
    }
  );
};
