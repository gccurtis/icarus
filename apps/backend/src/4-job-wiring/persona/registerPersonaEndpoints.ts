import {
  BuiltInPersonaImmutableError,
  PersonaConflictError,
  PersonaNotFoundError,
  PersonaValidationError,
  PersonaWireError,
  StalePersonaRevisionError,
  decodePersonaCommand,
  decodePersonaQuery,
  type PersonaCapability,
  type PersonaCommandResult
} from "#persona";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError
} from "#utils/persistence/resourceHistory.js";
import type { Logger } from "#platform/observability/logger.js";
import type { JobRegistry } from "#utils/jobs/registry.js";

const errorResponse = (error: unknown): { statusCode: number; body: unknown } => {
  if (error instanceof ResourceNotDeletedError) {
    return { statusCode: 409, body: { error: "not_deleted", message: error.message } };
  }
  if (error instanceof ResourceHistoryNotFoundError) {
    return { statusCode: 404, body: { error: "not_found", message: error.message } };
  }
  if (error instanceof PersonaNotFoundError) {
    return { statusCode: 404, body: { error: "persona_not_found", message: error.message } };
  }
  if (error instanceof PersonaConflictError) {
    return { statusCode: 409, body: { error: "persona_name_conflict", message: error.message } };
  }
  if (error instanceof StalePersonaRevisionError) {
    return {
      statusCode: 409,
      body: { error: "persona_revision_conflict", message: error.message }
    };
  }
  if (error instanceof BuiltInPersonaImmutableError) {
    return { statusCode: 409, body: { error: "persona_builtin_immutable", message: error.message } };
  }
  if (error instanceof PersonaValidationError || error instanceof PersonaWireError) {
    return { statusCode: 400, body: { error: "persona_invalid", message: error.message } };
  }
  // Internal errors never leak detail to the client; the real message is logged.
  return { statusCode: 500, body: { error: "internal_error", message: "Persona operation failed" } };
};

const commandStatus = (result: PersonaCommandResult): number =>
  result.type === "persona.created" ? 201 : 200;

const logUnexpected = (
  logger: Logger,
  event: string,
  requestId: string | undefined,
  error: unknown
): void => {
  logger.error(event, {
    requestId,
    errorName: error instanceof Error ? error.name : "UnknownError",
    errorMessage: error instanceof Error ? error.message : String(error)
  });
};

export const registerPersonaEndpoints = (
  registry: JobRegistry,
  personas: PersonaCapability,
  logger: Logger
): void => {
  // Serial: create, update, and delete each read-then-write across the store and
  // the Context port, which the store cannot guard on its own.
  registry.register({ method: "POST", path: "/personas/command" }, (request) => ({
    name: "persona.command.v1",
    queueType: "serial",
    responseMode: "inline",
    work: async () => {
      try {
        const result = await personas.command(decodePersonaCommand(request.body));
        return { statusCode: commandStatus(result), body: result };
      } catch (error) {
        const response = errorResponse(error);
        if (response.statusCode >= 500) {
          logUnexpected(logger, "persona.command.failed", request.requestId, error);
        }
        return response;
      }
    }
  }));

  registry.register({ method: "POST", path: "/personas/query" }, (request) => ({
    name: "persona.query.v1",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        return {
          statusCode: 200,
          body: await personas.query(decodePersonaQuery(request.body))
        };
      } catch (error) {
        const response = errorResponse(error);
        if (response.statusCode >= 500) {
          logUnexpected(logger, "persona.query.failed", request.requestId, error);
        }
        return response;
      }
    }
  }));

  logger.info("persona.endpoints.registered", {
    count: 2,
    endpoints: ["POST /personas/command", "POST /personas/query"]
  });
};
