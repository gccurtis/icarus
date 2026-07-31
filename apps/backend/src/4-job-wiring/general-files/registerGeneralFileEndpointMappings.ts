// General Files — Job wiring for HTTP endpoints.

import type { Logger } from "#platform/observability/logger.js";
import { GeneralFileEncodingError, GeneralFileNotFoundError, type GeneralFileService } from "#general-files";
import type { JobRegistry } from "#utils/jobs/registry.js";

function errorResponse(e: unknown): { statusCode: number; body: unknown } {
  if (e instanceof GeneralFileNotFoundError) {
    return { statusCode: 404, body: { error: "not_found", message: e.message } };
  }
  if (e instanceof GeneralFileEncodingError) {
    return { statusCode: 400, body: { error: "encoding_error", message: e.message } };
  }
  const message = e instanceof Error ? e.message : String(e);
  return { statusCode: 500, body: { error: "internal_error", message } };
}

export function registerGeneralFileEndpoints(
  registry: JobRegistry,
  service: GeneralFileService,
  logger: Logger,
): void {
  // --- Upload ---
  registry.register({ method: "POST", path: "/general-files/upload" }, (request) => ({
    name: "general-files.upload",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const result = await service.upload(request.body as any);
        return { statusCode: 200, body: result };
      } catch (e) {
        logger.error("general-files.upload.error", { error: String(e) });
        return errorResponse(e);
      }
    },
  }));

  // --- Update ---
  registry.register({ method: "POST", path: "/general-files/update" }, (request) => ({
    name: "general-files.update",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const { id, content } = request.body as { id: string; content: string };
        const result = await service.update(id, { content });
        return { statusCode: 200, body: result };
      } catch (e) {
        logger.error("general-files.update.error", { error: String(e) });
        return errorResponse(e);
      }
    },
  }));

  // --- Get ---
  registry.register({ method: "POST", path: "/general-files/get" }, (request) => ({
    name: "general-files.get",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const { id } = request.body as { id: string };
        const file = service.get(id);
        return { statusCode: 200, body: file };
      } catch (e) {
        logger.error("general-files.get.error", { error: String(e) });
        return errorResponse(e);
      }
    },
  }));

  // --- List ---
  registry.register({ method: "POST", path: "/general-files/list" }, (request) => ({
    name: "general-files.list",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const { filters } = (request.body ?? {}) as { filters?: any };
        const files = service.list(filters);
        return { statusCode: 200, body: files };
      } catch (e) {
        logger.error("general-files.list.error", { error: String(e) });
        return errorResponse(e);
      }
    },
  }));

  // --- Delete ---
  registry.register({ method: "POST", path: "/general-files/delete" }, (request) => ({
    name: "general-files.delete",
    queueType: "serial",
    responseMode: "inline",
    work: async () => {
      try {
        const { id } = request.body as { id: string };
        service.delete(id);
        return { statusCode: 200, body: { status: "deleted", id } };
      } catch (e) {
        logger.error("general-files.delete.error", { error: String(e) });
        return errorResponse(e);
      }
    },
  }));
}