import type { ActivityCapability, ActivityTransactionInput } from "#activity";
import type { Logger } from "#platform/observability/logger.js";
import {
  createTemplateCapability,
  SQLiteTemplateStore,
  type TemplatableResource,
  type TemplatableResourceRegistry,
  type TemplateActivityPublisher,
  type TemplateCapability,
  type TemplateCommittedTransaction
} from "#templates";
import type { BackendConfig } from "#utils/config/loadBackendConfig.js";

const TEMPLATES_DB_PATH = "./data/templates.db";

/**
 * Mutable only during composition. Templates receives it through the narrow
 * read-only TemplatableResourceRegistry interface.
 *
 * `register` takes a capability's runtime object directly — there is no adapter
 * to write. This is the only place that sees both sides, which is what keeps
 * Templates and the resource capabilities from importing each other.
 */
export type RuntimeTemplateResourceRegistry = TemplatableResourceRegistry & {
  register(resource: TemplatableResource): void;
};

export const createTemplateResourceRegistry = (): RuntimeTemplateResourceRegistry => {
  const resources = new Map<string, TemplatableResource>();
  return {
    get: (kind) => resources.get(kind),
    register: (resource) => {
      resources.set(resource.kind, resource);
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
  resources: TemplatableResourceRegistry,
  activity: ActivityCapability,
  logger: Logger
): TemplateCapability => {
  const store = new SQLiteTemplateStore(config.projectId, TEMPLATES_DB_PATH);
  return createTemplateCapability(
    store,
    {
      resources,
      logger,
      activityPublisher: createTemplateActivityPublisher(activity),
      attribution: { actorId: config.userId }
    }
  );
};
