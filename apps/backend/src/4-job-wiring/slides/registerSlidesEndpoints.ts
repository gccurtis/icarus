import type { Logger } from "#platform/observability/logger.js";
import type { JobRegistry } from "#utils/jobs/registry.js";
import {
  CompensationConflictError,
  DeckNotFoundError,
  HistoryPrunedError,
  InvalidDeckCursorError,
  RevisionConflictError,
  SlideAttemptNotFoundError,
  SlideIdentityReuseError,
  SlideOperationError,
  SlidePlacementError,
  SlideStaleAttemptError,
  SlideStyleReferenceError,
  SlideTokenReferenceError,
  SlideValidationError,
  SlideWireError,
  decodeSlideCommand,
  decodeSlideQuery,
  type SlideCommandResult,
  type SlidesCapability
} from "#slides";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError
} from "#utils/persistence/resourceHistory.js";

const errorResponse = (error: unknown): { statusCode: number; body: unknown } => {
  if (error instanceof ResourceNotDeletedError) {
    return { statusCode: 409, body: { error: "not_deleted", message: error.message } };
  }
  if (error instanceof ResourceHistoryNotFoundError) {
    return { statusCode: 404, body: { error: "not_found", message: error.message } };
  }
  if (error instanceof DeckNotFoundError || error instanceof SlideAttemptNotFoundError) {
    return { statusCode: 404, body: { error: "not_found", message: error.message } };
  }
  if (error instanceof HistoryPrunedError) {
    return { statusCode: 410, body: { error: "history_pruned", message: error.message } };
  }
  if (error instanceof InvalidDeckCursorError) {
    return { statusCode: 400, body: { error: "invalid_cursor", message: error.message } };
  }
  if (error instanceof RevisionConflictError) {
    return { statusCode: 409, body: { error: "revision_conflict", message: error.message } };
  }
  if (error instanceof CompensationConflictError) {
    return { statusCode: 409, body: { error: "compensation_conflict", message: error.message } };
  }
  if (error instanceof SlidePlacementError) {
    return { statusCode: 400, body: { error: "invalid_placement", message: error.message } };
  }
  if (error instanceof SlideStyleReferenceError) {
    return { statusCode: 400, body: { error: "invalid_style", message: error.message } };
  }
  if (error instanceof SlideTokenReferenceError) {
    return { statusCode: 400, body: { error: "invalid_token", message: error.message } };
  }
  if (error instanceof SlideIdentityReuseError) {
    return { statusCode: 400, body: { error: "identity_reuse", message: error.message } };
  }
  if (
    error instanceof SlideWireError ||
    error instanceof SlideValidationError ||
    error instanceof SlideOperationError ||
    error instanceof SlideStaleAttemptError
  ) {
    return { statusCode: 400, body: { error: "validation_error", message: error.message } };
  }
  return { statusCode: 500, body: { error: "internal_error", message: "Slides operation failed" } };
};

const commandStatus = (result: SlideCommandResult): number => {
  if (result.type === "deck.created") return 201;
  if (result.type.endsWith("requested")) return 202;
  return 200;
};

const logUnexpected = (
  logger: Logger,
  event: string,
  requestId: string | undefined,
  error: unknown
): void => {
  logger.error(event, {
    requestId,
    errorName: error instanceof Error ? error.name : "UnknownError"
  });
};

export const registerSlidesEndpoints = (
  registry: JobRegistry,
  slides: SlidesCapability,
  logger: Logger
): void => {
  registry.register({ method: "POST", path: "/slides/command" }, (request) => ({
    name: "slides.command.v1",
    // Serial. Every command here can mutate, and admission reads the head
    // before it writes — two of those interleaved would lose a revision.
    queueType: "serial",
    responseMode: "inline",
    work: async () => {
      try {
        const result = await slides.command(decodeSlideCommand(request.body));
        return { statusCode: commandStatus(result), body: result };
      } catch (error) {
        const response = errorResponse(error);
        if (response.statusCode >= 500) {
          logUnexpected(logger, "slides.command.failed", request.requestId, error);
        }
        return response;
      }
    }
  }));

  registry.register({ method: "POST", path: "/slides/query" }, (request) => ({
    name: "slides.query.v1",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        return { statusCode: 200, body: await slides.query(decodeSlideQuery(request.body)) };
      } catch (error) {
        const response = errorResponse(error);
        if (response.statusCode >= 500) {
          logUnexpected(logger, "slides.query.failed", request.requestId, error);
        }
        return response;
      }
    }
  }));

  logger.info("slides.endpoints.registered", {
    count: 2,
    endpoints: ["POST /slides/command", "POST /slides/query"]
  });
};
