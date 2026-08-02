import type { Logger } from "#platform/observability/logger.js";
import type { JobRegistry } from "#utils/jobs/registry.js";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError
} from "#utils/persistence/resourceHistory.js";
import {
  StaleTemplateRevisionError,
  TemplateAlreadyExistsError,
  TemplateIdempotencyMismatchError,
  TemplateNameConflictError,
  TemplateNotFoundError,
  TemplateUnsupportedKindError,
  TemplateWireError,
  decodeTemplateCommand,
  decodeTemplateQuery,
  type TemplateCapability,
  type TemplateCommandResult
} from "#templates";

const errorResponse = (error: unknown): { statusCode: number; body: unknown } => {
  if (error instanceof ResourceNotDeletedError) {
    return { statusCode: 409, body: { error: "not_deleted", message: error.message } };
  }
  if (error instanceof ResourceHistoryNotFoundError) {
    return { statusCode: 404, body: { error: "not_found", message: error.message } };
  }
  if (error instanceof TemplateNotFoundError) {
    return { statusCode: 404, body: { error: "not_found", message: error.message } };
  }
  if (error instanceof TemplateAlreadyExistsError) {
    return { statusCode: 409, body: { error: "already_exists", message: error.message } };
  }
  if (error instanceof TemplateNameConflictError) {
    return { statusCode: 409, body: { error: "name_conflict", message: error.message } };
  }
  if (error instanceof StaleTemplateRevisionError) {
    return { statusCode: 409, body: { error: "revision_conflict", message: error.message } };
  }
  if (error instanceof TemplateIdempotencyMismatchError) {
    return { statusCode: 409, body: { error: "idempotency_mismatch", message: error.message } };
  }
  if (error instanceof TemplateUnsupportedKindError) {
    return { statusCode: 400, body: { error: "unsupported_kind", message: error.message } };
  }
  if (error instanceof TemplateWireError) {
    return { statusCode: 400, body: { error: "validation_error", message: error.message } };
  }
  return { statusCode: 500, body: { error: "internal_error", message: "Template operation failed" } };
};

const commandStatus = (result: TemplateCommandResult): number =>
  result.type === "template.registered" ? 201 : 200;

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

export const registerTemplateEndpoints = (
  registry: JobRegistry,
  templates: TemplateCapability,
  logger: Logger
): void => {
  // Serial: this endpoint mutates, and the service reads-then-writes across
  // several store calls that no single statement can make atomic.
  // Claim-then-execute has the same shape: two concurrent retries of one
  // requestId would both see a pending claim and both drive the adapter.
  //
  // This is the same reason Document commands are serial, and it is
  // what the house rule means by serialising where the store cannot enforce
  // the invariant on its own.
  registry.register({ method: "POST", path: "/templates/command" }, (request) => ({
    name: "templates.command.v1",
    queueType: "serial",
    responseMode: "inline",
    work: async () => {
      try {
        const result = await templates.command(decodeTemplateCommand(request.body));
        return { statusCode: commandStatus(result), body: result };
      } catch (error) {
        const response = errorResponse(error);
        if (response.statusCode >= 500) {
          logUnexpected(logger, "templates.command.failed", request.requestId, error);
        }
        return response;
      }
    }
  }));

  registry.register({ method: "POST", path: "/templates/query" }, (request) => ({
    name: "templates.query.v1",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        return { statusCode: 200, body: await templates.query(decodeTemplateQuery(request.body)) };
      } catch (error) {
        const response = errorResponse(error);
        if (response.statusCode >= 500) {
          logUnexpected(logger, "templates.query.failed", request.requestId, error);
        }
        return response;
      }
    }
  }));

  logger.info("templates.endpoints.registered", {
    count: 2,
    endpoints: ["POST /templates/command", "POST /templates/query"]
  });
};
