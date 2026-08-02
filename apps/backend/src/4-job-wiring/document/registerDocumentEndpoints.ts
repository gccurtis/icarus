import type { Logger } from "#platform/observability/logger.js";
import type { JobRegistry } from "#utils/jobs/registry.js";
import {
  DerivedOutputDefinitionUpdateIdempotencyConflictError,
  DerivedOutputNotFoundError,
  StaleDefinitionRevisionError
} from "#derived-outputs";
import {
  CompensationConflictError,
  DocumentAttemptNotFoundError,
  DocumentIdentityReuseError,
  DocumentNotFoundError,
  DocumentOperationError,
  DocumentPlacementError,
  DocumentStaleAttemptError,
  DocumentStyleReferenceError,
  DocumentValidationError,
  DocumentWireError,
  HistoryPrunedError,
  IdempotencyMismatchError,
  InvalidDocumentCursorError,
  RevisionConflictError,
  decodeDocumentCommand,
  decodeDocumentQuery,
  type DocumentCapability,
  type DocumentCommandResult
} from "#document";
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
  if (error instanceof DocumentNotFoundError || error instanceof DocumentAttemptNotFoundError) {
    return { statusCode: 404, body: { error: "not_found", message: error.message } };
  }
  if (error instanceof DerivedOutputNotFoundError) {
    return { statusCode: 404, body: { error: "derived_output_not_found", message: error.message } };
  }
  if (error instanceof HistoryPrunedError) {
    return { statusCode: 410, body: { error: "history_pruned", message: error.message } };
  }
  if (error instanceof InvalidDocumentCursorError) {
    return { statusCode: 400, body: { error: "invalid_cursor", message: error.message } };
  }
  if (error instanceof RevisionConflictError) {
    return { statusCode: 409, body: { error: "revision_conflict", message: error.message } };
  }
  if (error instanceof StaleDefinitionRevisionError) {
    return {
      statusCode: 409,
      body: { error: "definition_revision_conflict", message: error.message }
    };
  }
  if (error instanceof IdempotencyMismatchError) {
    return { statusCode: 409, body: { error: "idempotency_mismatch", message: error.message } };
  }
  if (error instanceof DerivedOutputDefinitionUpdateIdempotencyConflictError) {
    return { statusCode: 409, body: { error: "idempotency_mismatch", message: error.message } };
  }
  if (error instanceof CompensationConflictError) {
    return { statusCode: 409, body: { error: "compensation_conflict", message: error.message } };
  }
  if (error instanceof DocumentPlacementError) {
    return { statusCode: 400, body: { error: "invalid_placement", message: error.message } };
  }
  if (error instanceof DocumentStyleReferenceError) {
    return { statusCode: 400, body: { error: "invalid_style", message: error.message } };
  }
  if (error instanceof DocumentIdentityReuseError) {
    return { statusCode: 400, body: { error: "identity_reuse", message: error.message } };
  }
  if (error instanceof DocumentWireError ||
      error instanceof DocumentValidationError ||
      error instanceof DocumentOperationError ||
      error instanceof DocumentStaleAttemptError) {
    return { statusCode: 400, body: { error: "validation_error", message: error.message } };
  }
  return { statusCode: 500, body: { error: "internal_error", message: "Document operation failed" } };
};

const commandStatus = (result: DocumentCommandResult): number => {
  if (result.type === "document.created") return 201;
  if (result.type.endsWith("requested")) return 202;
  return 200;
};

const logUnexpected = (logger: Logger, event: string, requestId: string | undefined, error: unknown): void => {
  logger.error(event, {
    requestId,
    errorName: error instanceof Error ? error.name : "UnknownError"
  });
};

export const registerDocumentEndpoints = (
  registry: JobRegistry,
  document: DocumentCapability,
  logger: Logger
): void => {
  registry.register({ method: "POST", path: "/documents/command" }, (request) => ({
    name: "documents.command.v1",
    queueType: "serial",
    responseMode: "inline",
    work: async () => {
      try {
        const result = await document.command(decodeDocumentCommand(request.body));
        return { statusCode: commandStatus(result), body: result };
      } catch (error) {
        const response = errorResponse(error);
        if (response.statusCode >= 500) {
          logUnexpected(logger, "document.command.failed", request.requestId, error);
        }
        return response;
      }
    }
  }));

  registry.register({ method: "POST", path: "/documents/query" }, (request) => ({
    name: "documents.query.v1",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        return { statusCode: 200, body: await document.query(decodeDocumentQuery(request.body)) };
      } catch (error) {
        const response = errorResponse(error);
        if (response.statusCode >= 500) {
          logUnexpected(logger, "document.query.failed", request.requestId, error);
        }
        return response;
      }
    }
  }));

  logger.info("document.endpoints.registered", {
    count: 2,
    endpoints: ["POST /documents/command", "POST /documents/query"]
  });
};
