import { randomUUID } from "node:crypto";
import type { Logger } from "#capabilities/observability/logger.js";
import { digestCommentCommand } from "../domain/canonical.js";
import {
  CommentIdempotencyMismatchError,
  CommentNotFoundError,
  CommentValidationError
} from "../domain/errors.js";
import type {
  Comment,
  CommentActivityOperation,
  CommentCommittedTransaction,
  CommentAttribution,
  CommentCommand,
  CommentCommandReceipt,
  CommentCommandResult,
  CommentQuery,
  CommentQueryResult,
  CommentState
} from "../domain/model.js";
import {
  assertCommentLimits,
  DEFAULT_COMMENT_LIMITS,
  normalizeCommentAttribution,
  normalizeCommentCommand,
  normalizeCommentQuery,
  parseCommentMentions,
  type CommentLimits
} from "../domain/validation.js";
import type { CommentActivityPublisher } from "../ports/activityPublisher.js";
import type { CommentStore, CommentWriteCommit } from "../ports/commentStore.js";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError
} from "#shared/persistence/resourceHistory.js";

export interface CommentClock {
  now(): string;
}

export interface CommentDependencies {
  logger: Logger;
  attribution: CommentAttribution;
  activityPublisher?: CommentActivityPublisher;
}

export interface CommentsCapability {
  command(command: CommentCommand): Promise<CommentCommandResult>;
  query(query: CommentQuery): Promise<CommentQueryResult>;
  /** Retries source-outbox rows left unpublished after failure or restart. */
  publishPendingActivity(limit?: number): Promise<number>;
  pruneHistory(cutoff: string): Promise<number>;
  purgeExpired(cutoff: string): Promise<number>;
}

const systemClock: CommentClock = { now: () => new Date().toISOString() };

const assertTimestamp = (value: string): string => {
  if (Number.isNaN(Date.parse(value))) {
    throw new CommentValidationError("Comment clock must return an ISO timestamp");
  }
  return value;
};

class CommentService implements CommentsCapability {
  private readonly limits: CommentLimits;
  private readonly attribution: CommentAttribution;

  constructor(
    private readonly store: CommentStore,
    private readonly deps: CommentDependencies,
    options: Partial<CommentLimits>,
    private readonly clock: CommentClock,
    private readonly createId: () => string
  ) {
    this.limits = { ...DEFAULT_COMMENT_LIMITS, ...options };
    assertCommentLimits(this.limits);
    this.attribution = normalizeCommentAttribution(deps.attribution, this.limits);
    this.deps.logger.info("comments.runtime.created", {
      actorId: this.attribution.actorId,
      origin: this.attribution.origin,
      activityPublisherConfigured: this.deps.activityPublisher !== undefined,
      limits: this.limits
    });
  }

  async command(input: CommentCommand): Promise<CommentCommandResult> {
    const startedAt = performance.now();
    try {
      const command = normalizeCommentCommand(input, this.limits);
      const digest = digestCommentCommand(command);
      const prior = await this.store.getReceipt(command.requestId);
      if (prior) {
        const result = this.replay(prior, digest);
        this.deps.logger.info("comments.command.replayed", {
          type: command.type,
          requestId: command.requestId,
          resultType: result.type,
          commentId: this.resultCommentId(result),
          durationMs: Math.round(performance.now() - startedAt)
        });
        return result;
      }

      let result: CommentCommandResult;
      switch (command.type) {
        case "comment.create":
          result = await this.create(command, digest);
          break;
        case "comment.update":
          result = await this.update(command, digest);
          break;
        case "comment.resolve":
          result = await this.setState(command, digest, "resolved", "resolved");
          break;
        case "comment.reopen":
          result = await this.setState(command, digest, "open", "reopened");
          break;
        case "comment.delete":
          result = await this.delete(command, digest);
          break;
        case "comment.purge":
          result = await this.purge(command, digest);
          break;
      }
      this.deps.logger.info("comments.command.completed", {
        type: command.type,
        requestId: command.requestId,
        resultType: result.type,
        commentId: this.resultCommentId(result),
        durationMs: Math.round(performance.now() - startedAt)
      });
      return result;
    } catch (error) {
      this.deps.logger.warn("comments.command.failed", {
        type: input.type,
        errorName: error instanceof Error ? error.name : "UnknownError",
        durationMs: Math.round(performance.now() - startedAt)
      });
      throw error;
    }
  }

  async query(input: CommentQuery): Promise<CommentQueryResult> {
    const startedAt = performance.now();
    try {
      const query = normalizeCommentQuery(input, this.limits);
      switch (query.type) {
        case "comment.get": {
          const comment = await this.store.getComment(query.commentId);
          if (!comment) throw new CommentNotFoundError(query.commentId);
          this.deps.logger.debug("comments.read", {
            commentId: comment.id,
            state: comment.state,
            resourceKind: comment.target.resourceKind,
            resourceId: comment.target.resourceId,
            mentionCount: comment.mentions.length,
            hasSubTarget: comment.target.subTarget !== undefined,
            durationMs: Math.round(performance.now() - startedAt)
          });
          return { type: "comment.get", comment };
        }
        case "comment.listByTarget": {
          const page = await this.store.listComments({
            resourceKind: query.target.resourceKind,
            resourceId: query.target.resourceId,
            ...(query.state !== undefined ? { state: query.state } : {}),
            ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
            limit: query.limit ?? this.limits.defaultPageSize
          });
          this.deps.logger.debug("comments.listed", {
            resourceKind: query.target.resourceKind,
            resourceId: query.target.resourceId,
            ...(query.state !== undefined ? { state: query.state } : {}),
            cursorProvided: query.cursor !== undefined,
            requestedLimit: query.limit ?? this.limits.defaultPageSize,
            count: page.items.length,
            hasNextCursor: page.nextCursor !== undefined,
            durationMs: Math.round(performance.now() - startedAt)
          });
          return { type: "comment.listByTarget", page };
        }
      }
    } catch (error) {
      this.deps.logger.warn("comments.query.failed", {
        type: input.type,
        errorName: error instanceof Error ? error.name : "UnknownError",
        durationMs: Math.round(performance.now() - startedAt)
      });
      throw error;
    }
  }

  async publishPendingActivity(limit?: number): Promise<number> {
    const startedAt = performance.now();
    if (!this.deps.activityPublisher) {
      this.deps.logger.debug("comments.activity.recovery.skipped", {
        reason: "publisher_not_configured"
      });
      return 0;
    }
    const pending = await this.store.listUnpublishedTransactions(limit);
    this.deps.logger.debug("comments.activity.recovery.started", {
      requestedLimit: limit,
      pending: pending.length
    });
    let published = 0;
    for (const transaction of pending) {
      if (await this.publishActivity(transaction)) published += 1;
    }
    this.deps.logger.info("comments.activity.recovery.completed", {
      requestedLimit: limit,
      pending: pending.length,
      published,
      remaining: pending.length - published,
      durationMs: Math.round(performance.now() - startedAt)
    });
    return published;
  }

  async pruneHistory(cutoff: string): Promise<number> {
    return this.store.pruneHistory(cutoff);
  }

  async purgeExpired(cutoff: string): Promise<number> {
    return this.store.purgeExpired(cutoff);
  }

  private async create(
    command: Extract<CommentCommand, { type: "comment.create" }>,
    digest: string
  ): Promise<CommentCommandResult> {
    const timestamp = this.now();
    const comment: Comment = {
      id: this.createId(),
      body: command.body,
      mentions: parseCommentMentions(command.body, this.limits),
      target: command.target,
      state: "open",
      revision: 1,
      createdBy: this.attribution.actorId,
      updatedBy: this.attribution.actorId,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const result: CommentCommandResult = { type: "comment.created", comment };
    const commit = this.commitFor(comment, command.requestId, digest, result, "created", timestamp);
    await this.store.commitCreation(commit);
    this.logMutationCommitted(commit);
    await this.publishActivity(commit.transaction);
    return result;
  }

  private async update(
    command: Extract<CommentCommand, { type: "comment.update" }>,
    digest: string
  ): Promise<CommentCommandResult> {
    const current = await this.requireComment(command.commentId);
    const timestamp = this.now();
    const comment: Comment = {
      ...current,
      body: command.body,
      mentions: parseCommentMentions(command.body, this.limits),
      revision: current.revision + 1,
      updatedBy: this.attribution.actorId,
      updatedAt: timestamp
    };
    const result: CommentCommandResult = { type: "comment.updated", comment };
    await this.persistMutation(
      this.commitFor(comment, command.requestId, digest, result, "updated", timestamp)
    );
    return result;
  }

  private async setState(
    command: Extract<CommentCommand, { type: "comment.resolve" | "comment.reopen" }>,
    digest: string,
    state: CommentState,
    operation: Extract<CommentActivityOperation, "resolved" | "reopened">
  ): Promise<CommentCommandResult> {
    const current = await this.requireComment(command.commentId);
    const resultType = operation === "resolved" ? "comment.resolved" : "comment.reopened";
    if (current.state === state) {
      const result = { type: resultType, comment: current } as CommentCommandResult;
      await this.store.recordReceipt({
        requestId: command.requestId,
        requestDigest: digest,
        result,
        createdAt: this.now()
      });
      this.deps.logger.info("comments.state.noop", {
        commentId: current.id,
        requestId: command.requestId,
        operation,
        state: current.state
      });
      return result;
    }

    const timestamp = this.now();
    const comment: Comment = {
      ...current,
      state,
      revision: current.revision + 1,
      updatedBy: this.attribution.actorId,
      updatedAt: timestamp
    };
    const result = { type: resultType, comment } as CommentCommandResult;
    await this.persistMutation(
      this.commitFor(comment, command.requestId, digest, result, operation, timestamp)
    );
    return result;
  }

  private async delete(
    command: Extract<CommentCommand, { type: "comment.delete" }>,
    digest: string
  ): Promise<CommentCommandResult> {
    const current = await this.requireComment(command.commentId);
    const timestamp = this.now();
    const comment: Comment = {
      ...current,
      revision: current.revision + 1,
      updatedBy: this.attribution.actorId,
      updatedAt: timestamp
    };
    const result: CommentCommandResult = {
      type: "comment.deleted",
      commentId: comment.id,
      revision: comment.revision
    };
    await this.persistMutation(
      this.commitFor(comment, command.requestId, digest, result, "deleted", timestamp)
    );
    return result;
  }

  private async purge(
    command: Extract<CommentCommand, { type: "comment.purge" }>,
    digest: string
  ): Promise<CommentCommandResult> {
    const result: CommentCommandResult = {
      type: "comment.purged",
      commentId: command.commentId
    };
    const outcome = await this.store.purge(command.commentId, {
      requestId: command.requestId,
      requestDigest: digest,
      result,
      createdAt: this.now()
    });
    if (outcome === "current") throw new ResourceNotDeletedError("comment", command.commentId);
    if (outcome === "missing") throw new ResourceHistoryNotFoundError("comment", command.commentId);
    this.deps.logger.info("comments.purged", { commentId: command.commentId });
    return result;
  }

  private commitFor(
    comment: Comment,
    requestId: string,
    requestDigest: string,
    result: CommentCommandResult,
    operation: CommentActivityOperation,
    occurredAt: string
  ): CommentWriteCommit {
    return {
      comment,
      receipt: { requestId, requestDigest, result, createdAt: occurredAt },
      transaction: {
        sourceTransactionId: this.createId(),
        sourceRequestId: requestId,
        operation,
        commentId: comment.id,
        resourceKind: comment.target.resourceKind,
        resourceId: comment.target.resourceId,
        state: comment.state,
        mentionCount: comment.mentions.length,
        actorId: this.attribution.actorId,
        origin: this.attribution.origin,
        occurredAt
      }
    };
  }

  private async persistMutation(commit: CommentWriteCommit): Promise<void> {
    if (!await this.store.commitMutation(commit)) {
      throw new CommentNotFoundError(commit.comment.id);
    }
    this.logMutationCommitted(commit);
    await this.publishActivity(commit.transaction);
  }

  private async requireComment(commentId: string): Promise<Comment> {
    const comment = await this.store.getComment(commentId);
    if (!comment) throw new CommentNotFoundError(commentId);
    return comment;
  }

  private replay(receipt: CommentCommandReceipt, digest: string): CommentCommandResult {
    if (receipt.requestDigest !== digest) {
      throw new CommentIdempotencyMismatchError(receipt.requestId);
    }
    return receipt.result;
  }

  private async publishActivity(transaction: CommentCommittedTransaction): Promise<boolean> {
    if (!this.deps.activityPublisher) {
      this.deps.logger.debug("comments.activity.publish.skipped", {
        sourceTransactionId: transaction.sourceTransactionId,
        operation: transaction.operation,
        reason: "publisher_not_configured"
      });
      return false;
    }
    const startedAt = performance.now();
    this.deps.logger.debug("comments.activity.publish.started", {
      sourceTransactionId: transaction.sourceTransactionId,
      commentId: transaction.commentId,
      operation: transaction.operation
    });
    try {
      await this.deps.activityPublisher.publish(transaction);
      await this.store.markTransactionPublished(transaction.sourceTransactionId, this.now());
      this.deps.logger.info("comments.activity.published", {
        sourceTransactionId: transaction.sourceTransactionId,
        commentId: transaction.commentId,
        operation: transaction.operation,
        durationMs: Math.round(performance.now() - startedAt)
      });
      return true;
    } catch (error) {
      this.deps.logger.warn("comments.activity.publish.failed", {
        sourceTransactionId: transaction.sourceTransactionId,
        commentId: transaction.commentId,
        operation: transaction.operation,
        errorName: error instanceof Error ? error.name : "UnknownError",
        durationMs: Math.round(performance.now() - startedAt)
      });
      return false;
    }
  }

  private logMutationCommitted(commit: CommentWriteCommit): void {
    this.deps.logger.info("comments.mutation.committed", {
      commentId: commit.comment.id,
      requestId: commit.receipt.requestId,
      operation: commit.transaction.operation,
      state: commit.comment.state,
      resourceKind: commit.comment.target.resourceKind,
      resourceId: commit.comment.target.resourceId,
      mentionCount: commit.comment.mentions.length,
      hasSubTarget: commit.comment.target.subTarget !== undefined,
      sourceTransactionId: commit.transaction.sourceTransactionId
    });
  }

  private resultCommentId(result: CommentCommandResult): string {
    return result.type === "comment.deleted" || result.type === "comment.purged"
      ? result.commentId
      : result.comment.id;
  }

  private now(): string {
    return assertTimestamp(this.clock.now());
  }
}

export const createCommentsCapability = (
  store: CommentStore,
  dependencies: CommentDependencies,
  options: Partial<CommentLimits> = {},
  clock: CommentClock = systemClock,
  createId: () => string = randomUUID
): CommentsCapability => new CommentService(store, dependencies, options, clock, createId);
