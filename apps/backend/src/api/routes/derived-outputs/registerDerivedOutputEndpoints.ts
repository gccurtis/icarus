import type { JobRegistry } from "#workflows/registry.js";
import type { Logger } from "#capabilities/observability/logger.js";
import type { DerivedOutputService } from "#derived-outputs";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError
} from "#shared/persistence/resourceHistory.js";
import {
  DerivedOutputNotFoundError,
  DerivedOutputConflictError,
  DerivedOutputIdempotencyConflictError,
  StaleDefinitionRevisionError
} from "#derived-outputs";

function deError(e: unknown): { statusCode: number; body: unknown } {
  if (e instanceof ResourceNotDeletedError)
    return { statusCode: 409, body: { error: "not_deleted", message: e.message } };
  if (e instanceof ResourceHistoryNotFoundError)
    return { statusCode: 404, body: { error: "not_found", message: e.message } };
  if (e instanceof DerivedOutputNotFoundError)
    return { statusCode: 404, body: { error: "not_found", message: e.message } };
  if (e instanceof DerivedOutputConflictError)
    return { statusCode: 409, body: { error: "conflict", message: e.message } };
  if (e instanceof DerivedOutputIdempotencyConflictError)
    return { statusCode: 409, body: { error: "idempotency_mismatch", message: e.message } };
  if (e instanceof StaleDefinitionRevisionError)
    return { statusCode: 409, body: { error: "stale_revision", message: e.message } };
  const msg = e instanceof Error ? e.message : String(e);
  return { statusCode: 400, body: { error: "bad_request", message: msg } };
}

export function registerDerivedOutputEndpoints(
  registry: JobRegistry,
  service: DerivedOutputService,
  logger: Logger
): void {
  const base = "/derived-outputs";

  // POST /derived-outputs — declare a new output
  registry.register({ method: "POST", path: base }, (request) => ({
    name: "derived-outputs.declare",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        const output = await service.declare({
          prompt: String(body.prompt ?? ""),
          contextEntries: Array.isArray(body.contextEntries)
            ? (body.contextEntries as Array<{ id: string; kind: string }>)
            : undefined,
          stabilisationText:
            body.stabilisationText !== undefined
              ? String(body.stabilisationText)
              : undefined
        });

        // Run the first refresh
        const result = await service.refresh(output.id);
        return { statusCode: 201, body: result };
      } catch (e) {
        logger.error("derived-outputs.declare.error", {
          error: e instanceof Error ? e.message : String(e)
        });
        return deError(e);
      }
    }
  }));

  // GET /derived-outputs?id= — read output metadata
  registry.register({ method: "GET", path: base }, (request) => ({
    name: "derived-outputs.get",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const query = request.query as Record<string, string>;
        const id = query.id ?? "";
        const output = await service.get(id);
        if (!output)
          return { statusCode: 404, body: { error: "not_found", message: `Derived output not found: ${id}` } };
        return { statusCode: 200, body: output };
      } catch (e) {
        return deError(e);
      }
    }
  }));

  // GET /derived-output-revisions?outputId=&revision=
  registry.register(
    { method: "GET", path: "/derived-output-revisions" },
    (request) => ({
      name: "derived-outputs.get-revision",
      queueType: "concurrent",
      responseMode: "inline",
      work: async () => {
        try {
          const query = request.query as Record<string, string>;
          const outputId = query.outputId ?? "";
          const revision = Number(query.revision ?? 0);
          const rev = await service.getRevision(outputId, revision);
          if (!rev)
            return {
              statusCode: 404,
              body: { error: "not_found", message: `Revision not found: ${outputId} rev ${revision}` }
            };
          return { statusCode: 200, body: rev };
        } catch (e) {
          return deError(e);
        }
      }
    })
  );

  // PATCH /derived-output-definition
  registry.register(
    { method: "PATCH", path: "/derived-output-definition" },
    (request) => ({
      name: "derived-outputs.update-definition",
      queueType: "serial",
      responseMode: "inline",
      work: async () => {
        try {
          const body = request.body as Record<string, unknown>;
          const output = await service.updateDefinition(
            String(body.id ?? ""),
            {
              prompt: String(body.prompt ?? ""),
              contextEntries: Array.isArray(body.contextEntries)
                ? (body.contextEntries as Array<{ id: string; kind: string }>)
                : [],
              stabilisationText: String(body.stabilisationText ?? ""),
              expectedDefinitionRevision: Number(body.expectedDefinitionRevision ?? 0)
            }
          );
          return { statusCode: 200, body: output };
        } catch (e) {
          return deError(e);
        }
      }
    })
  );

  // POST /derived-output-refresh
  registry.register(
    { method: "POST", path: "/derived-output-refresh" },
    (request) => ({
      name: "derived-outputs.refresh",
      queueType: "concurrent",
      responseMode: "inline",
      work: async () => {
        try {
          const body = request.body as Record<string, unknown>;
          const result = await service.refresh(String(body.id ?? ""));
          return { statusCode: 200, body: result };
        } catch (e) {
          return deError(e);
        }
      }
    })
  );

  // DELETE /derived-outputs?id=
  registry.register({ method: "DELETE", path: base }, (request) => ({
    name: "derived-outputs.delete",
    queueType: "serial",
    responseMode: "inline",
    work: async () => {
      try {
        const query = request.query as Record<string, string>;
        await service.delete(query.id ?? "");
        return { statusCode: 204, body: null };
      } catch (e) {
        return deError(e);
      }
    }
  }));

  registry.register({ method: "POST", path: "/derived-outputs/purge" }, (request) => ({
    name: "derived-outputs.purge",
    queueType: "serial",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        await service.purge(String(body.id ?? ""));
        return { statusCode: 204, body: null };
      } catch (e) {
        return deError(e);
      }
    }
  }));

  logger.info("derived-outputs.endpoints.registered", {
    count: 7,
    endpoints: [
      "POST /derived-outputs",
      "GET /derived-outputs",
      "GET /derived-output-revisions",
      "PATCH /derived-output-definition",
      "POST /derived-output-refresh",
      "DELETE /derived-outputs",
      "POST /derived-outputs/purge"
    ]
  });
}
