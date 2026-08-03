import type { JobRegistry } from "#utils/jobs/registry.js";
import type { Logger } from "#platform/observability/logger.js";
import type { DerivedOutputService } from "#derived-outputs";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError
} from "#utils/persistence/resourceHistory.js";
import {
  DerivedOutputNotFoundError,
  DerivedOutputConflictError,
  DerivedOutputEmptyScopeError,
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
  if (e instanceof DerivedOutputEmptyScopeError)
    return { statusCode: 400, body: { error: "empty_scope", message: e.message } };
  const msg = e instanceof Error ? e.message : String(e);
  return { statusCode: 400, body: { error: "bad_request", message: msg } };
}

/**
 * Rejects a malformed `contextEntries` instead of coercing it away.
 *
 * Both of these sites used to turn anything non-array into `undefined` or `[]`,
 * which then meant "the whole project". A typo in the body silently produced
 * the broadest possible grounding. Now a bad value is a 400 and an omitted one
 * is `undefined`, which `declare` still distinguishes from an explicit empty
 * list.
 */
function requireContextEntries(
  raw: unknown,
  { required }: { required: boolean }
): Array<{ id: string; kind: string }> | undefined {
  if (raw === undefined || raw === null) {
    if (required) throw new Error("contextEntries is required");
    return undefined;
  }
  if (!Array.isArray(raw)) throw new Error("contextEntries must be an array");
  return raw.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`contextEntries[${index}] must be an object`);
    }
    const { id, kind } = entry as Record<string, unknown>;
    if (typeof id !== "string" || id.length === 0) {
      throw new Error(`contextEntries[${index}].id must be a non-empty string`);
    }
    if (typeof kind !== "string" || kind.length === 0) {
      throw new Error(`contextEntries[${index}].kind must be a non-empty string`);
    }
    return { id, kind };
  });
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
          contextEntries: requireContextEntries(body.contextEntries, { required: false }),
          stabilisationText:
            body.stabilisationText !== undefined
              ? String(body.stabilisationText)
              : undefined
        });

        // Run the first refresh
        try {
          const result = await service.refresh(output.id);
          return { statusCode: 201, body: result };
        } catch (refreshError) {
          if (!(refreshError instanceof DerivedOutputEmptyScopeError)) throw refreshError;
          // The declaration succeeded and the refresh could not run. Returning a
          // bare 400 would strand the Output behind an ID the caller never saw,
          // so the id comes back with the error and the caller can give it a
          // scope through a definition update.
          logger.warn("derived-outputs.declare.empty-scope", { outputId: output.id });
          return {
            statusCode: 400,
            body: {
              error: "empty_scope",
              message: refreshError.message,
              outputId: output.id
            }
          };
        }
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
              // Required here: `updateDefinition` replaces the definition
              // wholesale, so omitting the scope would silently erase it.
              contextEntries: requireContextEntries(body.contextEntries, { required: true })!,
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
