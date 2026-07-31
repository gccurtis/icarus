import type { JobRegistry } from "#utils/jobs/registry.js";
import type { ContextManager } from "#context";
import type { ContextEntry, ContextStoreScope } from "#context";
import { ContextNotFoundError, ContextConflictError, StaleContextError } from "#context";

function contextErrorResponse(e: unknown): { statusCode: number; body: unknown } {
  if (e instanceof ContextNotFoundError) return { statusCode: 404, body: { error: "not_found", message: e.message } };
  if (e instanceof ContextConflictError) return { statusCode: 409, body: { error: "conflict", message: e.message } };
  if (e instanceof StaleContextError) return { statusCode: 409, body: { error: "stale_revision", message: e.message } };
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

export function registerContextEndpoints(
  registry: JobRegistry,
  ctx: ContextManager
): void {
  // ── User-scoped endpoints (/user/contexts/…) ────────────────────────────

  registry.register({ method: "POST", path: "/user/contexts" }, (request) => ({
    name: "context.user.declare",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        const record = await ctx.declare(
          String(body.displayName ?? ""),
          parseEntries(body.entries),
          "user" as ContextStoreScope
        );
        return { statusCode: 201, body: record };
      } catch (e) { return contextErrorResponse(e); }
    }
  }));

  registry.register({ method: "GET", path: "/user/contexts" }, (request) => ({
    name: "context.user.list",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const query = request.query as Record<string, string>;
      const records = await ctx.list({ scope: "user", includeAnonymous: query.includeAnonymous === "true" });
      return { statusCode: 200, body: { records } };
    }
  }));

  registry.register({ method: "GET", path: "/user/contexts/entry" }, (request) => ({
    name: "context.user.get",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const query = request.query as Record<string, string>;
      const record = await ctx.get(query.id ?? "", "user");
      if (!record) return { statusCode: 404, body: { error: "not_found", message: `Context not found: ${query.id}` } };
      return { statusCode: 200, body: record };
    }
  }));

  registry.register({ method: "GET", path: "/user/contexts/by-name" }, (request) => ({
    name: "context.user.getByName",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const query = request.query as Record<string, string>;
      const record = await ctx.getByName(query.displayName ?? "", "user");
      if (!record) return { statusCode: 404, body: { error: "not_found", message: `Context not found: ${query.displayName}` } };
      return { statusCode: 200, body: record };
    }
  }));

  registry.register({ method: "PATCH", path: "/user/contexts/entries" }, (request) => ({
    name: "context.user.update",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        const record = await ctx.update(
          String(body.id ?? ""),
          parseEntries(body.entries),
          Number(body.expectedRevision),
          "user"
        );
        return { statusCode: 200, body: record };
      } catch (e) { return contextErrorResponse(e); }
    }
  }));

  registry.register({ method: "DELETE", path: "/user/contexts" }, (request) => ({
    name: "context.user.delete",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        await ctx.delete(String(body.id ?? ""), "user");
        return { statusCode: 204, body: null };
      } catch (e) { return contextErrorResponse(e); }
    }
  }));

  registry.register({ method: "POST", path: "/user/contexts/resolve" }, (request) => ({
    name: "context.user.resolve",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const body = request.body as Record<string, unknown>;
      const resolved = await ctx.resolve(parseEntries(body.entries), "user");
      return { statusCode: 200, body: { entries: resolved } };
    }
  }));

  registry.register({ method: "POST", path: "/user/contexts/combine" }, (request) => ({
    name: "context.user.combine",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const body = request.body as Record<string, unknown>;
      const result = ctx.combine(parseEntries(body.a), parseEntries(body.b));
      return { statusCode: 200, body: { entries: result } };
    }
  }));

  registry.register({ method: "POST", path: "/user/contexts/difference" }, (request) => ({
    name: "context.user.difference",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const body = request.body as Record<string, unknown>;
      const result = ctx.difference(parseEntries(body.a), parseEntries(body.b));
      return { statusCode: 200, body: { entries: result } };
    }
  }));

  registry.register({ method: "POST", path: "/user/contexts/compose" }, (request) => ({
    name: "context.user.compose",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        const op = body.op === "difference" ? "difference" : "combine";
        const record = await ctx.compose(op, parseEntries(body.a), parseEntries(body.b), "user");
        return { statusCode: 201, body: record };
      } catch (e) { return contextErrorResponse(e); }
    }
  }));

  // ── Project-scoped endpoints (/project/contexts/…) ──────────────────────

  registry.register({ method: "POST", path: "/project/contexts" }, (request) => ({
    name: "context.project.declare",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        const record = await ctx.declare(
          String(body.displayName ?? ""),
          parseEntries(body.entries),
          "project"
        );
        return { statusCode: 201, body: record };
      } catch (e) { return contextErrorResponse(e); }
    }
  }));

  registry.register({ method: "GET", path: "/project/contexts" }, (request) => ({
    name: "context.project.list",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const query = request.query as Record<string, string>;
      const records = await ctx.list({ scope: "project", includeAnonymous: query.includeAnonymous === "true" });
      return { statusCode: 200, body: { records } };
    }
  }));

  registry.register({ method: "GET", path: "/project/contexts/entry" }, (request) => ({
    name: "context.project.get",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const query = request.query as Record<string, string>;
      const record = await ctx.get(query.id ?? "", "project");
      if (!record) return { statusCode: 404, body: { error: "not_found", message: `Context not found: ${query.id}` } };
      return { statusCode: 200, body: record };
    }
  }));

  registry.register({ method: "GET", path: "/project/contexts/by-name" }, (request) => ({
    name: "context.project.getByName",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const query = request.query as Record<string, string>;
      const record = await ctx.getByName(query.displayName ?? "", "project");
      if (!record) return { statusCode: 404, body: { error: "not_found", message: `Context not found: ${query.displayName}` } };
      return { statusCode: 200, body: record };
    }
  }));

  registry.register({ method: "PATCH", path: "/project/contexts/entries" }, (request) => ({
    name: "context.project.update",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        const record = await ctx.update(
          String(body.id ?? ""),
          parseEntries(body.entries),
          Number(body.expectedRevision),
          "project"
        );
        return { statusCode: 200, body: record };
      } catch (e) { return contextErrorResponse(e); }
    }
  }));

  registry.register({ method: "DELETE", path: "/project/contexts" }, (request) => ({
    name: "context.project.delete",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        await ctx.delete(String(body.id ?? ""), "project");
        return { statusCode: 204, body: null };
      } catch (e) { return contextErrorResponse(e); }
    }
  }));

  registry.register({ method: "POST", path: "/project/contexts/resolve" }, (request) => ({
    name: "context.project.resolve",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const body = request.body as Record<string, unknown>;
      const resolved = await ctx.resolve(parseEntries(body.entries), "project");
      return { statusCode: 200, body: { entries: resolved } };
    }
  }));

  registry.register({ method: "POST", path: "/project/contexts/combine" }, (request) => ({
    name: "context.project.combine",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const body = request.body as Record<string, unknown>;
      const result = ctx.combine(parseEntries(body.a), parseEntries(body.b));
      return { statusCode: 200, body: { entries: result } };
    }
  }));

  registry.register({ method: "POST", path: "/project/contexts/difference" }, (request) => ({
    name: "context.project.difference",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const body = request.body as Record<string, unknown>;
      const result = ctx.difference(parseEntries(body.a), parseEntries(body.b));
      return { statusCode: 200, body: { entries: result } };
    }
  }));

  registry.register({ method: "POST", path: "/project/contexts/compose" }, (request) => ({
    name: "context.project.compose",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        const op = body.op === "difference" ? "difference" : "combine";
        const record = await ctx.compose(op, parseEntries(body.a), parseEntries(body.b), "project");
        return { statusCode: 201, body: record };
      } catch (e) { return contextErrorResponse(e); }
    }
  }));

  // ── Promotion (user → project) ─────────────────────────────────────────

  registry.register({ method: "POST", path: "/user/contexts/promote" }, (request) => ({
    name: "context.promote",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        const record = await ctx.promote(String(body.id ?? ""));
        return { statusCode: 201, body: record };
      } catch (e) { return contextErrorResponse(e); }
    }
  }));
}
