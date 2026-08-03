import type { Logger } from "#platform/observability/logger.js";
import type { JobRegistry } from "#utils/jobs/registry.js";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError
} from "#utils/persistence/resourceHistory.js";
import {
  AnalyticCompilationError,
  AnalyticNameConflictError,
  AnalyticNotFoundError,
  AnalyticPullError,
  AnalyticValidationError,
  AnalyticWireError,
  StaleAnalyticRevisionError,
  decodeAnalyticCommand,
  decodeAnalyticQuery,
  type AnalyticCommandResult,
  type StructuredAnalyticService
} from "#structured-analytic";

const errorResponse = (error: unknown): { statusCode: number; body: unknown } => {
  // Shared classes first: purge raises these, and every other capability's
  // mapper turns them into exactly this pair.
  if (error instanceof ResourceNotDeletedError) {
    return { statusCode: 409, body: { error: "not_deleted", message: error.message } };
  }
  if (error instanceof ResourceHistoryNotFoundError) {
    return { statusCode: 404, body: { error: "not_found", message: error.message } };
  }
  if (error instanceof AnalyticNotFoundError) {
    return { statusCode: 404, body: { error: "not_found", message: error.message } };
  }
  if (error instanceof StaleAnalyticRevisionError) {
    return { statusCode: 409, body: { error: "revision_conflict", message: error.message } };
  }
  if (error instanceof AnalyticNameConflictError) {
    return { statusCode: 409, body: { error: "name_conflict", message: error.message } };
  }
  if (error instanceof AnalyticWireError) {
    return { statusCode: 400, body: { error: "validation_error", message: error.message } };
  }
  if (error instanceof AnalyticValidationError) {
    // `field` is the only machine-readable part of a rejection, and an editing
    // surface highlights the pill it names — so it goes in the body, not just
    // the message.
    return {
      statusCode: 400,
      body: { error: "validation_error", message: error.message, field: error.field }
    };
  }
  // A definition that is structurally valid but cannot be lowered. Save-time
  // like a validation error, and mapped alongside it, because from the caller's
  // side both mean "this definition is not usable as written".
  if (error instanceof AnalyticCompilationError) {
    return { statusCode: 400, body: { error: "validation_error", message: error.message } };
  }
  // The definition is fine; the project data cannot satisfy it right now. 422
  // rather than 400 is the whole distinction: retrying the same request after
  // fixing the *data* may succeed.
  if (error instanceof AnalyticPullError) {
    return {
      statusCode: 422,
      body: {
        error: "analytic_pull_invalid",
        message: error.message,
        ...(error.reason !== undefined ? { reason: error.reason } : {}),
        ...(error.input !== undefined ? { input: error.input } : {})
      }
    };
  }
  // AnalyticConfigurationError is deliberately absent. It is a startup fault —
  // reaching here at all would mean the process should not have booted, so it
  // falls through to 500 rather than being dressed up as a client error.
  return {
    statusCode: 500,
    body: { error: "internal_error", message: "Structured Analytic operation failed" }
  };
};

const commandStatus = (result: AnalyticCommandResult): number =>
  result.type === "analytic.created" ? 201 : 200;

export const registerStructuredAnalyticEndpoints = (
  registry: JobRegistry,
  analytics: StructuredAnalyticService,
  logger: Logger
): void => {
  // Serial: update and delete read-then-write across a CAS plus a history
  // insert, and save/copy check a Structured Data name before writing under it.
  // Neither is atomic in one statement, which is the house rule for serialising.
  registry.register({ method: "POST", path: "/structured-analytics/command" }, request => ({
    name: "structured-analytic.command.v1",
    queueType: "serial",
    responseMode: "inline",
    work: async () => {
      try {
        const result = await analytics.command(decodeAnalyticCommand(request.body));
        return { statusCode: commandStatus(result), body: result };
      } catch (error) {
        const response = errorResponse(error);
        logger.warn(
          "structured-analytic.endpoint.command.failed",
          {
            requestId: request.requestId,
            statusCode: response.statusCode,
            errorName: error instanceof Error ? error.name : "UnknownError",
            reason: error instanceof Error ? error.message : String(error),
            body: request.body
          },
          { detail: "content" }
        );
        return response;
      }
    }
  }));

  // Concurrent: no writes, except the one revision-conditioned name repair a
  // pull may make, which is idempotent and loses cleanly to a concurrent edit.
  registry.register({ method: "POST", path: "/structured-analytics/query" }, request => ({
    name: "structured-analytic.query.v1",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        return { statusCode: 200, body: await analytics.query(decodeAnalyticQuery(request.body)) };
      } catch (error) {
        const response = errorResponse(error);
        logger.warn(
          "structured-analytic.endpoint.query.failed",
          {
            requestId: request.requestId,
            statusCode: response.statusCode,
            errorName: error instanceof Error ? error.name : "UnknownError",
            reason: error instanceof Error ? error.message : String(error),
            body: request.body
          },
          { detail: "content" }
        );
        return response;
      }
    }
  }));
};
