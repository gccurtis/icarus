// Connector — Job wiring for HTTP endpoints.

import type { Logger } from "#platform/observability/logger.js";
import {
  ConnectorAlreadyExistsError,
  ConnectorNotFoundError,
  ConnectorValidationError,
  SyncInProgressError,
  UnsupportedLocatorError,
  type ConnectorService,
} from "#connector";
import type { JobRegistry } from "#utils/jobs/registry.js";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError
} from "#utils/persistence/resourceHistory.js";

function errorResponse(e: unknown): { statusCode: number; body: unknown } {
  if (e instanceof ConnectorNotFoundError) {
    return { statusCode: 404, body: { error: "not_found", message: e.message } };
  }
  if (e instanceof ConnectorAlreadyExistsError) {
    return { statusCode: 409, body: { error: "already_exists", message: e.message } };
  }
  if (e instanceof SyncInProgressError) {
    return { statusCode: 409, body: { error: "sync_in_progress", message: e.message } };
  }
  if (e instanceof ConnectorValidationError || e instanceof UnsupportedLocatorError || e instanceof RangeError) {
    return { statusCode: 400, body: { error: "bad_request", message: e.message } };
  }
  if (e instanceof ResourceNotDeletedError) return { statusCode: 409, body: { error: "not_deleted", message: e.message } };
  if (e instanceof ResourceHistoryNotFoundError) return { statusCode: 404, body: { error: "not_found", message: e.message } };
  const message = e instanceof Error ? e.message : String(e);
  return { statusCode: 500, body: { error: "internal_error", message } };
}

function logError(logger: Logger, operation: string, error: unknown): void {
  logger.error(`connector.${operation}.error`, {
    errorName: error instanceof Error ? error.name : "UnknownError",
    error: error instanceof Error ? error.message : String(error),
  });
}

export function registerConnectorEndpoints(
  registry: JobRegistry,
  service: ConnectorService,
  logger: Logger,
): void {
  // --- Register ---
  registry.register({ method: "POST", path: "/connector/register" }, (request) => ({
    name: "connector.register",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const result = await service.register(request.body as any);
        return { statusCode: 200, body: result };
      } catch (e) {
        logError(logger, "register", e);
        return errorResponse(e);
      }
    },
  }));

  // --- Refresh (manual sync) ---
  registry.register({ method: "POST", path: "/connector/refresh" }, (request) => ({
    name: "connector.refresh",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const { id } = (request.body ?? {}) as { id: string };
        await service.sync(id);
        return { statusCode: 200, body: { status: "synced" } };
      } catch (e) {
        logError(logger, "refresh", e);
        return errorResponse(e);
      }
    },
  }));

  // --- Get ---
  registry.register({ method: "POST", path: "/connector/get" }, (request) => ({
    name: "connector.get",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const { id } = (request.body ?? {}) as { id: string };
        const entry = service.get(id);
        return { statusCode: 200, body: entry };
      } catch (e) {
        logError(logger, "get", e);
        return errorResponse(e);
      }
    },
  }));

  // --- List ---
  registry.register({ method: "POST", path: "/connector/list" }, () => ({
    name: "connector.list",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const entries = service.list();
        return { statusCode: 200, body: entries };
      } catch (e) {
        logError(logger, "list", e);
        return errorResponse(e);
      }
    },
  }));

  // --- Read all ---
  registry.register({ method: "POST", path: "/connector/read-all" }, (request) => ({
    name: "connector.read-all",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const startedAt = performance.now();
        const { id, itemKey } = (request.body ?? {}) as { id: string; itemKey?: string };
        let reader;
        if (itemKey) {
          const entry = service.get(id);
          const dirReader = service.getDirectoryReader(id);
          reader = await dirReader.getItemReader(itemKey);
        } else {
          reader = await service.getReader(id);
        }
        const text = await reader.readAll();
        logger.info("connector.read-all", {
          id,
          itemKey,
          byteSize: Buffer.byteLength(text, "utf8"),
          durationMs: Math.round(performance.now() - startedAt),
        });
        return { statusCode: 200, body: { text } };
      } catch (e) {
        logError(logger, "read-all", e);
        return errorResponse(e);
      }
    },
  }));

  // --- Read range ---
  registry.register({ method: "POST", path: "/connector/read-range" }, (request) => ({
    name: "connector.read-range",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const startedAt = performance.now();
        const { id, itemKey, start, end } = (request.body ?? {}) as {
          id: string; itemKey?: string; start: number; end: number;
        };
        let reader;
        if (itemKey) {
          const dirReader = service.getDirectoryReader(id);
          reader = await dirReader.getItemReader(itemKey);
        } else {
          reader = await service.getReader(id);
        }
        const text = await reader.read({ start, end });
        logger.info("connector.read-range", {
          id,
          itemKey,
          start,
          end,
          byteSize: Buffer.byteLength(text, "utf8"),
          durationMs: Math.round(performance.now() - startedAt),
        });
        return { statusCode: 200, body: { text } };
      } catch (e) {
        logError(logger, "read-range", e);
        return errorResponse(e);
      }
    },
  }));

  // --- Read lines ---
  registry.register({ method: "POST", path: "/connector/read-lines" }, (request) => ({
    name: "connector.read-lines",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const startedAt = performance.now();
        const { id, itemKey, startLine, endLine } = (request.body ?? {}) as {
          id: string; itemKey?: string; startLine: number; endLine: number;
        };
        let reader;
        if (itemKey) {
          const dirReader = service.getDirectoryReader(id);
          reader = await dirReader.getItemReader(itemKey);
        } else {
          reader = await service.getReader(id);
        }
        const lines = await reader.readLines(startLine, endLine);
        logger.info("connector.read-lines", {
          id,
          itemKey,
          startLine,
          endLine,
          lineCount: lines.length,
          durationMs: Math.round(performance.now() - startedAt),
        });
        return { statusCode: 200, body: { lines } };
      } catch (e) {
        logError(logger, "read-lines", e);
        return errorResponse(e);
      }
    },
  }));

  // --- List items ---
  registry.register({ method: "POST", path: "/connector/list-items" }, (request) => ({
    name: "connector.list-items",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const { id } = (request.body ?? {}) as { id: string };
        const reader = service.getDirectoryReader(id);
        return { statusCode: 200, body: reader.listItems() };
      } catch (e) {
        logError(logger, "list-items", e);
        return errorResponse(e);
      }
    },
  }));

  // --- Delete ---
  registry.register({ method: "POST", path: "/connector/delete" }, (request) => ({
    name: "connector.delete",
    queueType: "serial",
    responseMode: "inline",
    work: async () => {
      try {
        const { id } = (request.body ?? {}) as { id: string };
        await service.delete(id);
        return { statusCode: 200, body: { status: "deleted", id } };
      } catch (e) {
        logError(logger, "delete", e);
        return errorResponse(e);
      }
    },
  }));

  registry.register({ method: "POST", path: "/connector/purge" }, (request) => ({
    name: "connector.purge",
    queueType: "serial",
    responseMode: "inline",
    work: async () => {
      try {
        const { id } = (request.body ?? {}) as { id: string };
        await service.purge(id);
        return { statusCode: 204, body: null };
      } catch (e) {
        logError(logger, "purge", e);
        return errorResponse(e);
      }
    },
  }));
}
