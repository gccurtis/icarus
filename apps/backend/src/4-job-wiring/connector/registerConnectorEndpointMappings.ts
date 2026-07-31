// Connector — Job wiring for HTTP endpoints.

import type { Logger } from "#platform/observability/logger.js";
import {
  ConnectorAlreadyExistsError,
  ConnectorNotFoundError,
  type ConnectorService,
} from "#connector";
import type { JobRegistry } from "#utils/jobs/registry.js";

function errorResponse(e: unknown): { statusCode: number; body: unknown } {
  if (e instanceof ConnectorNotFoundError) {
    return { statusCode: 404, body: { error: "not_found", message: e.message } };
  }
  if (e instanceof ConnectorAlreadyExistsError) {
    return { statusCode: 409, body: { error: "already_exists", message: e.message } };
  }
  const message = e instanceof Error ? e.message : String(e);
  return { statusCode: 500, body: { error: "internal_error", message } };
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
        logger.error("connector.register.error", { error: String(e) });
        return errorResponse(e);
      }
    },
  }));

  // --- Refresh (manual sync) ---
  registry.register({ method: "POST", path: "/connector/refresh" }, (request) => ({
    name: "connector.refresh",
    queueType: "concurrent",
    responseMode: "deferred",
    deferredWork: async () => ({
      statusCode: 202,
      body: { status: "accepted" },
    }),
    work: async () => {
      try {
        const { id } = request.body as { id: string };
        await service.sync(id);
        return { statusCode: 200, body: { status: "synced" } };
      } catch (e) {
        logger.error("connector.refresh.error", { error: String(e) });
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
        const { id } = request.body as { id: string };
        const entry = service.get(id);
        return { statusCode: 200, body: entry };
      } catch (e) {
        return errorResponse(e);
      }
    },
  }));

  // --- List ---
  registry.register({ method: "POST", path: "connector/list" }, () => ({
    name: "connector.list",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const entries = service.list();
      return { statusCode: 200, body: entries };
    },
  }));

  // --- Read all ---
  registry.register({ method: "POST", path: "/connector/read-all" }, (request) => ({
    name: "connector.read-all",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const { id, itemKey } = request.body as { id: string; itemKey?: string };
        let reader;
        if (itemKey) {
          const entry = service.get(id);
          const dirReader = service.getDirectoryReader(id);
          reader = await dirReader.getItemReader(itemKey);
        } else {
          reader = await service.getReader(id);
        }
        const text = await reader.readAll();
        return { statusCode: 200, body: { text } };
      } catch (e) {
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
        const { id, itemKey, start, end } = request.body as {
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
        return { statusCode: 200, body: { text } };
      } catch (e) {
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
        const { id, itemKey, startLine, endLine } = request.body as {
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
        return { statusCode: 200, body: { lines } };
      } catch (e) {
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
        const { id } = request.body as { id: string };
        const reader = service.getDirectoryReader(id);
        return { statusCode: 200, body: reader.listItems() };
      } catch (e) {
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
        const { id } = request.body as { id: string };
        service.delete(id);
        return { statusCode: 200, body: { status: "deleted", id } };
      } catch (e) {
        return errorResponse(e);
      }
    },
  }));
}