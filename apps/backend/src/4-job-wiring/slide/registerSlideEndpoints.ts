import type { Logger } from "#platform/observability/logger.js";
import type { JobRegistry } from "#utils/jobs/registry.js";
import {
  DerivedOutputDefinitionUpdateIdempotencyConflictError,
  DerivedOutputNotFoundError,
  StaleDefinitionRevisionError
} from "#derived-outputs";
import {
  DeckAlreadyExistsError,
  DeckNotFoundError,
  InvalidSlideCursorError,
  SlideAttemptNotFoundError,
  SlideCompensationConflictError,
  SlideIdempotencyMismatchError,
  SlideIdentityReuseError,
  SlideHistoryPrunedError,
  SlideOperationError,
  SlidePlacementError,
  SlideRevisionConflictError,
  SlideStaleAttemptError,
  SlideStyleReferenceError,
  SlideValidationError,
  SlideWireError,
  decodeSlideCommand,
  decodeSlideQuery,
  type SlideCapability,
  type SlideCommandResult
} from "#capabilities/slide/index.js";

const errorResponse = (error: unknown): { statusCode: number; body: unknown } => {
  if (error instanceof DeckNotFoundError || error instanceof SlideAttemptNotFoundError) {
    return { statusCode: 404, body: { error: "not_found", message: error.message } };
  }
  if (error instanceof DerivedOutputNotFoundError) {
    return {
      statusCode: 404,
      body: { error: "derived_output_not_found", message: error.message }
    };
  }
  if (error instanceof SlideHistoryPrunedError) {
    return { statusCode: 410, body: { error: "history_pruned", message: error.message } };
  }
  if (error instanceof InvalidSlideCursorError) {
    return { statusCode: 400, body: { error: "invalid_cursor", message: error.message } };
  }
  if (error instanceof SlideRevisionConflictError) {
    return { statusCode: 409, body: { error: "revision_conflict", message: error.message } };
  }
  if (error instanceof StaleDefinitionRevisionError) {
    return {
      statusCode: 409,
      body: { error: "definition_revision_conflict", message: error.message }
    };
  }
  if (error instanceof SlideIdempotencyMismatchError ||
      error instanceof DerivedOutputDefinitionUpdateIdempotencyConflictError) {
    return { statusCode: 409, body: { error: "idempotency_mismatch", message: error.message } };
  }
  if (error instanceof SlideCompensationConflictError) {
    return {
      statusCode: 409,
      body: { error: "compensation_conflict", message: error.message }
    };
  }
  if (error instanceof DeckAlreadyExistsError) {
    return { statusCode: 409, body: { error: "already_exists", message: error.message } };
  }
  if (error instanceof SlidePlacementError) {
    return { statusCode: 400, body: { error: "invalid_placement", message: error.message } };
  }
  if (error instanceof SlideStyleReferenceError) {
    return { statusCode: 400, body: { error: "invalid_style", message: error.message } };
  }
  if (error instanceof SlideIdentityReuseError) {
    return { statusCode: 400, body: { error: "identity_reuse", message: error.message } };
  }
  if (error instanceof SlideWireError ||
      error instanceof SlideValidationError ||
      error instanceof SlideOperationError ||
      error instanceof SlideStaleAttemptError) {
    return { statusCode: 400, body: { error: "validation_error", message: error.message } };
  }
  return { statusCode: 500, body: { error: "internal_error", message: "Slide operation failed" } };
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

export const registerSlideEndpoints = (
  registry: JobRegistry,
  slide: SlideCapability,
  logger: Logger
): void => {
  registry.register({ method: "POST", path: "/slides/command" }, (request) => ({
    name: "slides.command.v1",
    queueType: "serial",
    responseMode: "inline",
    work: async () => {
      try {
        const result = await slide.command(decodeSlideCommand(request.body));
        return { statusCode: commandStatus(result), body: result };
      } catch (error) {
        const response = errorResponse(error);
        if (response.statusCode >= 500) {
          logUnexpected(logger, "slide.command.failed", request.requestId, error);
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
        return { statusCode: 200, body: await slide.query(decodeSlideQuery(request.body)) };
      } catch (error) {
        const response = errorResponse(error);
        if (response.statusCode >= 500) {
          logUnexpected(logger, "slide.query.failed", request.requestId, error);
        }
        return response;
      }
    }
  }));

  logger.info("slide.endpoints.registered", {
    count: 2,
    endpoints: ["POST /slides/command", "POST /slides/query"]
  });
};
