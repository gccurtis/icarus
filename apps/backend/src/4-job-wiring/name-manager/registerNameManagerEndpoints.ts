import type { JobRegistry } from "#utils/jobs/registry.js";
import type { NameManager } from "#capabilities/built-in/name-manager/index.js";
import { NameConflictError, NameNotFoundError, StaleRevisionError } from "#capabilities/built-in/name-manager/index.js";

function nameManagerErrorResponse(e: unknown): { statusCode: number; body: unknown } {
  if (e instanceof NameNotFoundError) return { statusCode: 404, body: { error: "not_found", message: e.message } };
  if (e instanceof NameConflictError) return { statusCode: 409, body: { error: "conflict", message: e.message } };
  if (e instanceof StaleRevisionError) return { statusCode: 409, body: { error: "stale_revision", message: e.message } };
  const msg = e instanceof Error ? e.message : String(e);
  return { statusCode: 400, body: { error: "bad_request", message: msg } };
}

export function registerNameManagerEndpoints(
  registry: JobRegistry,
  nameManager: NameManager
): void {
  // POST /names — declare a name
  // Body: { scopeId, kind, displayName, body }
  registry.register({ method: "POST", path: "/names" }, (request) => ({
    name: "name-manager.declare",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        const entry = await nameManager.declare({
          scopeId: String(body.scopeId ?? ""),
          kind: body.kind as "variable" | "function",
          displayName: String(body.displayName ?? ""),
          body: String(body.body ?? "")
        });
        return { statusCode: 201, body: entry };
      } catch (e) {
        return nameManagerErrorResponse(e);
      }
    }
  }));

  // GET /names — list names in a scope
  // Query: scopeId, kind? (optional)
  registry.register({ method: "GET", path: "/names" }, (request) => ({
    name: "name-manager.list",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const query = request.query as Record<string, string>;
      const entries = await nameManager.list({
        scopeId: query.scopeId ?? "",
        kind: query.kind as "variable" | "function" | undefined
      });
      return { statusCode: 200, body: { entries } };
    }
  }));

  // GET /names/entry — get a single name by id
  // Query: id
  registry.register({ method: "GET", path: "/names/entry" }, (request) => ({
    name: "name-manager.get",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const query = request.query as Record<string, string>;
      const id = query.id ?? "";
      const entry = await nameManager.get(id);
      if (!entry) return { statusCode: 404, body: { error: "not_found", message: `Name not found: ${id}` } };
      return { statusCode: 200, body: entry };
    }
  }));

  // PATCH /names/rename — rename a name
  // Body: { id, newDisplayName, expectedRevision }
  registry.register({ method: "PATCH", path: "/names/rename" }, (request) => ({
    name: "name-manager.rename",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        const entry = await nameManager.rename({
          id: String(body.id ?? ""),
          newDisplayName: String(body.newDisplayName ?? ""),
          expectedRevision: Number(body.expectedRevision)
        });
        return { statusCode: 200, body: entry };
      } catch (e) {
        return nameManagerErrorResponse(e);
      }
    }
  }));

  // PATCH /names/body — update formula body
  // Body: { id, body, expectedRevision }
  registry.register({ method: "PATCH", path: "/names/body" }, (request) => ({
    name: "name-manager.update-body",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const reqBody = request.body as Record<string, unknown>;
        const entry = await nameManager.update({
          id: String(reqBody.id ?? ""),
          body: String(reqBody.body ?? ""),
          expectedRevision: Number(reqBody.expectedRevision)
        });
        return { statusCode: 200, body: entry };
      } catch (e) {
        return nameManagerErrorResponse(e);
      }
    }
  }));

  // DELETE /names — soft delete a name
  // Body: { id }
  registry.register({ method: "DELETE", path: "/names" }, (request) => ({
    name: "name-manager.delete",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        const id = String(body.id ?? "");
        await nameManager.delete(id);
        return { statusCode: 204, body: null };
      } catch (e) {
        return nameManagerErrorResponse(e);
      }
    }
  }));
}

