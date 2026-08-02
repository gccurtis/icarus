import type { ActivityCapability, ActivityTransactionInput } from "#activity";
import {
  createCommentsCapability,
  SQLiteCommentStore,
  type CommentActivityPublisher,
  type CommentActivityTransaction,
  type CommentsCapability
} from "#comments";
import type { Logger } from "#platform/observability/logger.js";
import type { BackendConfig } from "#utils/config/loadBackendConfig.js";

const COMMENTS_DB_PATH = "./data/comments.db";

export const toCommentActivityTransaction = (
  transaction: CommentActivityTransaction
): ActivityTransactionInput => ({
  idempotencyKey: transaction.transactionId,
  kind: "comment",
  resourceId: transaction.commentId,
  operation: transaction.operation,
  actorId: transaction.actorId,
  origin: transaction.origin,
  occurredAt: transaction.occurredAt,
  metadata: {
    target: {
      resourceKind: transaction.resourceKind,
      resourceId: transaction.resourceId
    },
    state: transaction.state,
    mentionCount: transaction.mentionCount
  }
});

export const createCommentActivityPublisher = (
  activity: ActivityCapability
): CommentActivityPublisher => ({
  publish: async (transaction) => {
    await activity.publish(toCommentActivityTransaction(transaction));
  }
});

export const createCommentsInstance = (
  config: BackendConfig,
  activity: ActivityCapability,
  logger: Logger
): CommentsCapability => {
  const store = new SQLiteCommentStore(config.projectId, COMMENTS_DB_PATH);
  return createCommentsCapability(store, {
    logger,
    attribution: { actorId: config.userId, origin: "user" },
    activityPublisher: createCommentActivityPublisher(activity)
  });
};
