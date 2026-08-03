import type { JobRegistry } from "#utils/jobs/registry.js";
import type { ContextManager, ContextOperand } from "#context";
import type { ContextEntry } from "#context";
import { ContextNotFoundError, ContextConflictError, StaleContextError, ContextValidationError } from "#context";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError
} from "#utils/persistence/resourceHistory.js";

function contextErrorResponse(e: unknown): { statusCode: number; body: unknown } {
  if (e instanceof ContextNotFoundError) return { statusCode: 404, body: { error: "not_found", message: e.message } };
  if (e instanceof ContextConflictError) return { statusCode: 409, body: { error: "conflict", message: e.message } };
  if (e instanceof StaleContextError) return { statusCode: 409, body: { error: "stale_revision", message: e.message } };
  if (e instanceof ContextValidationError) return { statusCode: 400, body: { error: "context_invalid", message: e.message, field: e.field } };
  if (e instanceof ResourceNotDeletedError) return { statusCode: 409, body: { error: "not_deleted", message: e.message } };
  if (e instanceof ResourceHistoryNotFoundError) return { statusCode: 404, body: { error: "not_found", message: e.message } };
  const msg = e instanceof Error ? e.message : String(e);
  return { statusCode: 400, body: { error: "bad_request", message: msg } };
}

function parseEntries(raw: unknown): ContextEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
    .map(e => ({ id: String(e.id ?? ""), kind: String(e.kind ?? "") }))
    .filter(e => e.id && e.kind);
}

/**
 * Distinguishes "no excludes field" from "an empty excludes field", because
 * `update` reads them differently: omitted leaves the existing exclusions
 * alone, `[]` clears them. Collapsing the two would make it impossible to
 * replace entries without also silently widening the scope.
 */
function parseExcludes(raw: unknown): ContextEntry[] | undefined {
  return raw === undefined ? undefined : parseEntries(raw);
}

function parseOperand(raw: unknown): ContextOperand {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.contextId === "string" && obj.contextId.length > 0) {
      return { contextId: obj.contextId };
    }
    if (Array.isArray(obj.entries)) {
      return { entries: parseEntries(obj.entries) };
    }
  }
  throw new Error("Operand must be { contextId } or { entries }");
}

function parseDescription(raw: unknown): string | undefined {
  return typeof raw === "string" ? raw : undefined;
}

/** Strict on purpose: only a literal boolean true counts. Anything else, including
 *  missing, null, or a truthy-looking string, is treated as "not private". */
function parsePrivate(raw: unknown): boolean {
  return raw === true;
}

export function registerContextEndpoints(
  registry: JobRegistry,
  ctx: ContextManager
): void {
  registry.register({ method: "POST", path: "/contexts" }, (request) => ({
    name: "context.declare",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        const record = await ctx.declare(
          String(body.displayName ?? ""),
          parseEntries(body.entries),
          {
            description: parseDescription(body.description),
            private: parsePrivate(body.private),
            ...(parseExcludes(body.excludes) !== undefined
              ? { excludes: parseExcludes(body.excludes) }
              : {})
          }
        );
        return { statusCode: 201, body: record };
      } catch (e) { return contextErrorResponse(e); }
    }
  }));

  registry.register({ method: "GET", path: "/contexts" }, (request) => ({
    name: "context.list",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const query = request.query as Record<string, string>;
      const records = await ctx.list({ includePrivate: query.includePrivate === "true" });
      return { statusCode: 200, body: { records } };
    }
  }));

  registry.register({ method: "GET", path: "/contexts/entry" }, (request) => ({
    name: "context.get",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const query = request.query as Record<string, string>;
      const record = await ctx.get(query.id ?? "");
      if (!record) return { statusCode: 404, body: { error: "not_found", message: `Context not found: ${query.id}` } };
      return { statusCode: 200, body: record };
    }
  }));

  registry.register({ method: "GET", path: "/contexts/by-name" }, (request) => ({
    name: "context.getByName",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const query = request.query as Record<string, string>;
      const record = await ctx.getByName(query.displayName ?? "");
      if (!record) return { statusCode: 404, body: { error: "not_found", message: `Context not found: ${query.displayName}` } };
      return { statusCode: 200, body: record };
    }
  }));

  registry.register({ method: "PATCH", path: "/contexts/entries" }, (request) => ({
    name: "context.update",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        const excludes = parseExcludes(body.excludes);
        const record = await ctx.update(
          String(body.id ?? ""),
          parseEntries(body.entries),
          Number(body.expectedRevision),
          excludes !== undefined ? { excludes } : {}
        );
        return { statusCode: 200, body: record };
      } catch (e) { return contextErrorResponse(e); }
    }
  }));

  registry.register({ method: "DELETE", path: "/contexts" }, (request) => ({
    name: "context.delete",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        await ctx.delete(String(body.id ?? ""));
        return { statusCode: 204, body: null };
      } catch (e) { return contextErrorResponse(e); }
    }
  }));

  registry.register({ method: "POST", path: "/contexts/purge" }, (request) => ({
    name: "context.purge",
    queueType: "serial",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        await ctx.purge(String(body.id ?? ""));
        return { statusCode: 204, body: null };
      } catch (e) { return contextErrorResponse(e); }
    }
  }));

  registry.register({ method: "POST", path: "/contexts/resolve" }, (request) => ({
    name: "context.resolve",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const body = request.body as Record<string, unknown>;
      const resolved = await ctx.resolve(parseEntries(body.entries));
      return { statusCode: 200, body: { entries: resolved } };
    }
  }));

  // ── Composition (persisted, named) ───────────────────────────────────────
  // Both endpoints resolve two operands (by context ID or inline entries),
  // apply the set operation, persist the result under the given displayName,
  // and return only the new context's ID.

  registry.register({ method: "POST", path: "/contexts/union" }, (request) => ({
    name: "context.union",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        const record = await ctx.composeNamed(
          "union",
          parseOperand(body.a),
          parseOperand(body.b),
          String(body.displayName ?? ""),
          { description: parseDescription(body.description), private: parsePrivate(body.private) }
        );
        return { statusCode: 201, body: { contextId: record.id } };
      } catch (e) { return contextErrorResponse(e); }
    }
  }));

  registry.register({ method: "POST", path: "/contexts/difference" }, (request) => ({
    name: "context.difference",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        const record = await ctx.composeNamed(
          "difference",
          parseOperand(body.a),
          parseOperand(body.b),
          String(body.displayName ?? ""),
          { description: parseDescription(body.description), private: parsePrivate(body.private) }
        );
        return { statusCode: 201, body: { contextId: record.id } };
      } catch (e) { return contextErrorResponse(e); }
    }
  }));
}
