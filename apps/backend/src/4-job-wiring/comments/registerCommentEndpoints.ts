import {
  CommentIdempotencyMismatchError,
  CommentNotFoundError,
  CommentValidationError,
  CommentWireError,
  InvalidCommentCursorError,
  decodeCommentCommand,
  decodeCommentQuery,
  type CommentCommandResult,
  type CommentsCapability
} from "#comments";
import type { Logger } from "#platform/observability/logger.js";
import type { JobRegistry } from "#utils/jobs/registry.js";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError
} from "#utils/persistence/resourceHistory.js";

const errorResponse = (error: unknown): { statusCode: number; body: unknown } => {
  if (error instanceof CommentNotFoundError) {
    return { statusCode: 404, body: { error: "not_found", message: error.message } };
  }
  if (error instanceof CommentIdempotencyMismatchError) {
    return { statusCode: 409, body: { error: "idempotency_mismatch", message: error.message } };
  }
  if (error instanceof ResourceNotDeletedError) {
    return { statusCode: 409, body: { error: "not_deleted", message: error.message } };
  }
  if (error instanceof ResourceHistoryNotFoundError) {
    return { statusCode: 404, body: { error: "not_found", message: error.message } };
  }
  if (
    error instanceof CommentValidationError ||
    error instanceof CommentWireError ||
    error instanceof InvalidCommentCursorError
  ) {
    return { statusCode: 400, body: { error: "validation_error", message: error.message } };
  }
  return { statusCode: 500, body: { error: "internal_error", message: "Comment operation failed" } };
};

const commandStatus = (result: CommentCommandResult): number =>
  result.type === "comment.created" ? 201 : 200;

const logResponse = (
  logger: Logger,
  event: string,
  requestId: string | undefined,
  error: unknown,
  statusCode: number
): void => {
  const context = {
    requestId,
    statusCode,
    errorName: error instanceof Error ? error.name : "UnknownError"
  };
  if (statusCode >= 500) logger.error(event, context);
  else logger.warn(event, context);
};

export const registerCommentEndpoints = (
  registry: JobRegistry,
  comments: CommentsCapability,
  logger: Logger
): void => {
  registry.register({ method: "POST", path: "/comments/command" }, (request) => ({
    name: "comments.command.v1",
    queueType: "serial",
    responseMode: "inline",
    work: async () => {
      try {
        const result = await comments.command(decodeCommentCommand(request.body));
        return { statusCode: commandStatus(result), body: result };
      } catch (error) {
        const response = errorResponse(error);
        logResponse(
          logger,
          response.statusCode >= 500 ? "comments.command.failed" : "comments.command.rejected",
          request.requestId,
          error,
          response.statusCode
        );
        return response;
      }
    }
  }));

  registry.register({ method: "POST", path: "/comments/query" }, (request) => ({
    name: "comments.query.v1",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        return {
          statusCode: 200,
          body: await comments.query(decodeCommentQuery(request.body))
        };
      } catch (error) {
        const response = errorResponse(error);
        logResponse(
          logger,
          response.statusCode >= 500 ? "comments.query.failed" : "comments.query.rejected",
          request.requestId,
          error,
          response.statusCode
        );
        return response;
      }
    }
  }));

  logger.info("comments.endpoints.registered", {
    count: 2,
    endpoints: ["POST /comments/command", "POST /comments/query"]
  });
};
