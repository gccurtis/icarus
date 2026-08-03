import type { Logger } from "#platform/observability/logger.js";
import type { RichText } from "#rich-text";
import type { BackendConfig } from "#utils/config/loadBackendConfig.js";
import type { InternalJobsRuntime } from "#utils/jobs/internalRuntime.js";
import type {
  ActivityCapability,
  ActivityOrigin,
  ActivityTransactionInput
} from "#activity";
import {
  createSlidesCapability,
  SQLiteSlidesStore,
  type DeckCommittedTransaction,
  type SlideActivityPublisher,
  type SlideInternalJobIntent,
  type SlidesCapability
} from "#slides";

const SLIDES_DB_PATH = "./data/slides.db";

/**
 * Slides keeps its own origin vocabulary and this is the only place that knows
 * both, exactly as Document does. `interactive` is what Activity calls `user`.
 */
const activityOrigin = (origin: DeckCommittedTransaction["origin"]): ActivityOrigin =>
  origin === "interactive" ? "user" : origin;

const toActivityTransaction = (
  transaction: DeckCommittedTransaction
): ActivityTransactionInput => ({
  idempotencyKey: transaction.sourceTransactionId,
  kind: "slides",
  resourceId: transaction.deckId,
  operation: transaction.kind.slice("deck.".length),
  revision: transaction.revision,
  ...(transaction.sourceChangeSetId ? { changeSetId: transaction.sourceChangeSetId } : {}),
  ...(transaction.actorId ? { actorId: transaction.actorId } : {}),
  origin: activityOrigin(transaction.origin),
  occurredAt: transaction.occurredAt,
  metadata: {
    operationTypes: transaction.operationTypes,
    ...(transaction.compensation ? { compensation: transaction.compensation } : {})
  }
});

const createSlidesActivityPublisher = (
  activity: ActivityCapability
): SlideActivityPublisher => ({
  publish: async (transaction) => {
    await activity.publish(toActivityTransaction(transaction));
  }
});

export const createSlidesInstance = (
  config: BackendConfig,
  richText: RichText,
  activity: ActivityCapability,
  jobs: InternalJobsRuntime<SlideInternalJobIntent>,
  logger: Logger
): SlidesCapability => {
  const store = new SQLiteSlidesStore(config.projectId, SLIDES_DB_PATH, logger);
  return createSlidesCapability(
    store,
    {
      richText,
      activityPublisher: createSlidesActivityPublisher(activity),
      jobs,
      logger,
      attribution: { actorId: config.userId }
    },
    config.slides
  );
};
