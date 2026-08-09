import {
  ActivityValidationError,
  InvalidActivityCursorError,
  type ActivityCapability,
  type ActivityPresenceFilter,
  type ActivityQuery,
  type ActivityTransactionFilter
} from "#activity";
import type { Logger } from "#platform/observability/logger.js";
import type { JobRegistry } from "#utils/jobs/registry.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const optionalString = (value: unknown, label: string): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new ActivityValidationError(`${label} must be a string`);
  }
  return value;
};

const optionalFilter = (
  value: unknown,
  label: string
): Record<string, unknown> | undefined => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new ActivityValidationError(`${label} must be an object`);
  }
  return value;
};

const decodeTransactionFilter = (value: unknown): ActivityTransactionFilter | undefined => {
  const filter = optionalFilter(value, "Activity transaction filter");
  if (!filter) return undefined;

  const kind = optionalString(filter.kind, "Activity transaction filter kind");
  const resourceId = optionalString(
    filter.resourceId,
    "Activity transaction filter resourceId"
  );
  const cursor = optionalString(filter.cursor, "Activity transaction filter cursor");
  const limit = filter.limit;
  if (
    limit !== undefined &&
    (!Number.isSafeInteger(limit) || (limit as number) < 1)
  ) {
    throw new ActivityValidationError("Activity transaction filter limit must be a positive integer");
  }

  return {
    ...(kind !== undefined ? { kind } : {}),
    ...(resourceId !== undefined ? { resourceId } : {}),
    ...(cursor !== undefined ? { cursor } : {}),
    ...(limit !== undefined ? { limit: limit as number } : {})
  };
};

const decodePresenceFilter = (value: unknown): ActivityPresenceFilter | undefined => {
  const filter = optionalFilter(value, "Presence filter");
  if (!filter) return undefined;

  const kind = optionalString(filter.kind, "Presence filter kind");
  const resourceId = optionalString(filter.resourceId, "Presence filter resourceId");
  return {
    ...(kind !== undefined ? { kind } : {}),
    ...(resourceId !== undefined ? { resourceId } : {})
  };
};

const decodeActivityQuery = (value: unknown): ActivityQuery => {
  if (!isRecord(value) || typeof value.type !== "string") {
    throw new ActivityValidationError("Activity query must have a type");
  }

  switch (value.type) {
    case "activity.transactions": {
      const filter = decodeTransactionFilter(value.filter);
      return filter === undefined
        ? { type: "activity.transactions" }
        : { type: "activity.transactions", filter };
    }
    case "activity.transaction": {
      const transactionId = optionalString(value.transactionId, "Activity transaction id");
      if (transactionId === undefined) {
        throw new ActivityValidationError("Activity transaction id is required");
      }
      return { type: "activity.transaction", transactionId };
    }
    case "presence.list": {
      const filter = decodePresenceFilter(value.filter);
      return filter === undefined ? { type: "presence.list" } : { type: "presence.list", filter };
    }
    default:
      throw new ActivityValidationError(`Unsupported Activity query '${value.type}'`);
  }
};

const errorResponse = (error: unknown): { statusCode: number; body: unknown } => {
  if (error instanceof ActivityValidationError || error instanceof InvalidActivityCursorError) {
    return { statusCode: 400, body: { error: "validation_error", message: error.message } };
  }
  return {
    statusCode: 500,
    body: { error: "internal_error", message: "Activity query failed" }
  };
};

/**
 * Registers the public read surface for Activity.
 *
 * Presence writes are deliberately rejected for now: the HTTP transport only
 * provides per-request IDs and untrusted headers/body, not a stable
 * authenticated session identity. Realtime/auth transport can replace this
 * handler once it can supply a trusted session and actor.
 */
export const registerActivityEndpoints = (
  registry: JobRegistry,
  activity: ActivityCapability,
  logger: Logger
): void => {
  registry.register({ method: "POST", path: "/activity/query" }, (request) => ({
    name: "activity.query.v1",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        return { statusCode: 200, body: await activity.query(decodeActivityQuery(request.body)) };
      } catch (error) {
        const response = errorResponse(error);
        const context = {
          requestId: request.requestId,
          statusCode: response.statusCode,
          errorName: error instanceof Error ? error.name : "UnknownError",
          errorMessage: error instanceof Error ? error.message : String(error)
        };
        if (response.statusCode >= 500) {
          logger.error("activity.query.failed", {
            ...context
          });
        } else {
          logger.warn("activity.query.rejected", context);
        }
        return response;
      }
    }
  }));

  registry.register({ method: "POST", path: "/activity/command" }, (request) => ({
    name: "activity.command.v1",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      logger.warn("activity.presence.command.unsupported", {
        requestId: request.requestId,
        reason: "trusted_session_context_unavailable"
      });
      return {
        statusCode: 501,
        body: {
          error: "presence_transport_unsupported",
          message:
            "Presence commands require a trusted session-aware transport; HTTP does not provide one yet."
        }
      };
    }
  }));

  logger.info("activity.endpoints.registered", {
    count: 2,
    endpoints: ["POST /activity/query", "POST /activity/command"]
  });
};
