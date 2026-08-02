import type { ActivityCapability, ActivityTransactionInput } from "#activity";
import type { Logger } from "#platform/observability/logger.js";
import {
  createTemplateCapability,
  SQLiteTemplateStore,
  type TemplateActivityPublisher,
  type TemplateCapability,
  type TemplateCommittedFact,
  type TemplateResourceAdapter,
  type TemplateResourceRegistry
} from "#templates";
import type { BackendConfig } from "#utils/config/loadBackendConfig.js";

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
  fact: TemplateCommittedFact
): ActivityTransactionInput => ({
  idempotencyKey: fact.factId,
  kind: "template",
  resourceId: fact.templateId,
  operation: fact.kind.slice("template.".length),
  ...(fact.actorId ? { actorId: fact.actorId } : {}),
  origin: "user",
  occurredAt: fact.occurredAt,
  metadata: {
    resourceKind: fact.resourceKind,
    resourceId: fact.resourceId
  }
});

export const createTemplateActivityPublisher = (
  activity: ActivityCapability
): TemplateActivityPublisher => ({
  publish: async (fact) => {
    await activity.publish(toTemplateActivityTransaction(fact));
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
    },
    config.templates
  );
};
