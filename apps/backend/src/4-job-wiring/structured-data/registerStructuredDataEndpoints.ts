import type { JobRegistry } from "#utils/jobs/registry.js";
import type { Logger } from "#platform/observability/logger.js";
import type { StructuredData } from "#structured-data";
import { DataEntryNotFoundError, DataEntryConflictError, StaleDataRevisionError } from "#structured-data";
import type { FormulaEngine } from "#formula";
import { toWire } from "#formula";
import { normalizeKey } from "#formula/resolver.js";
import type { FormulaNameResolver } from "#init/create/formula-name-resolver.js";

function sdError(e: unknown): { statusCode: number; body: unknown } {
  if (e instanceof DataEntryNotFoundError) return { statusCode: 404, body: { error: "not_found", message: e.message } };
  if (e instanceof DataEntryConflictError) return { statusCode: 409, body: { error: "conflict", message: e.message } };
  if (e instanceof StaleDataRevisionError) return { statusCode: 409, body: { error: "stale_revision", message: e.message } };
  const msg = e instanceof Error ? e.message : String(e);
  return { statusCode: 400, body: { error: "bad_request", message: msg } };
}

export function registerStructuredDataEndpoints(
  registry: JobRegistry,
  sd: StructuredData,
  formula: FormulaEngine,
  resolver: FormulaNameResolver,
  logger: Logger
): void {
  const base = "/structured-data";

  // POST /structured-data — declare a new entry
  registry.register({ method: "POST", path: base }, (request) => ({
    name: "structured-data.declare",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        const kind = body.kind as string;
        let entry;
        if (kind === "variable" || kind === "function") {
          entry = await sd.declare({
            kind,
            displayName: String(body.displayName ?? ""),
            body: String(body.body ?? ""),
            description: body.description !== undefined ? String(body.description) : undefined
          });
        } else if (kind === "table" || kind === "record" || kind === "list") {
          entry = await sd.declare({
            kind,
            displayName: String(body.displayName ?? ""),
            schema: (body.schema ?? []) as import("#structured-data").FieldDef[],
            rows: (body.rows ?? []) as import("#structured-data").DataRow[],
            description: body.description !== undefined ? String(body.description) : undefined
          });
        } else {
          return { statusCode: 400, body: { error: "bad_request", message: `Unknown kind: ${kind}` } };
        }
        return { statusCode: 201, body: entry };
      } catch (e) {
        return sdError(e);
      }
    }
  }));

  // GET /structured-data — list entries, optional ?kind= filter
  registry.register({ method: "GET", path: base }, (request) => ({
    name: "structured-data.list",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const query = request.query as Record<string, string>;
      const kind = query.kind as Parameters<typeof sd.list>[0];
      const entries = await sd.list(kind);
      return { statusCode: 200, body: { entries } };
    }
  }));

  // GET /structured-data/entry?id=
  registry.register({ method: "GET", path: `${base}/entry` }, (request) => ({
    name: "structured-data.get",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const query = request.query as Record<string, string>;
      const id = query.id ?? "";
      const entry = await sd.get(id);
      if (!entry) return { statusCode: 404, body: { error: "not_found", message: `Entry not found: ${id}` } };
      return { statusCode: 200, body: entry };
    }
  }));

  // GET /structured-data/by-name?displayName=
  registry.register({ method: "GET", path: `${base}/by-name` }, (request) => ({
    name: "structured-data.getByName",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const query = request.query as Record<string, string>;
      const displayName = query.displayName ?? "";
      const entry = await sd.getByName(displayName);
      if (!entry) return { statusCode: 404, body: { error: "not_found", message: `Entry not found: ${displayName}` } };
      return { statusCode: 200, body: entry };
    }
  }));

  // PATCH /structured-data/rename
  registry.register({ method: "PATCH", path: `${base}/rename` }, (request) => ({
    name: "structured-data.rename",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        const entry = await sd.rename({
          id: String(body.id ?? ""),
          newDisplayName: String(body.newDisplayName ?? ""),
          expectedRevision: Number(body.expectedRevision)
        });
        return { statusCode: 200, body: entry };
      } catch (e) {
        return sdError(e);
      }
    }
  }));

  // PATCH /structured-data/description
  registry.register({ method: "PATCH", path: `${base}/description` }, (request) => ({
    name: "structured-data.updateDescription",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        const entry = await sd.updateDescription({
          id: String(body.id ?? ""),
          description: String(body.description ?? ""),
          expectedRevision: Number(body.expectedRevision)
        });
        return { statusCode: 200, body: entry };
      } catch (e) {
        return sdError(e);
      }
    }
  }));

  // DELETE /structured-data
  registry.register({ method: "DELETE", path: base }, (request) => ({
    name: "structured-data.delete",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        await sd.delete(String(body.id ?? ""));
        return { statusCode: 204, body: null };
      } catch (e) {
        return sdError(e);
      }
    }
  }));

  // POST /structured-data/query
  registry.register({ method: "POST", path: `${base}/query` }, (request) => ({
    name: "structured-data.query",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const body = request.body as Record<string, unknown>;
      const result = await sd.query({
        kind: body.kind as Parameters<typeof sd.list>[0],
        text: body.text !== undefined ? String(body.text) : undefined,
        scope: body.scope as Parameters<typeof sd.query>[0]["scope"]
      });
      return { statusCode: 200, body: result };
    }
  }));

  // PATCH /structured-data/body — variable/function only
  registry.register({ method: "PATCH", path: `${base}/body` }, (request) => ({
    name: "structured-data.updateBody",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        const entry = await sd.updateBody({
          id: String(body.id ?? ""),
          body: String(body.body ?? ""),
          expectedRevision: Number(body.expectedRevision)
        });
        return { statusCode: 200, body: entry };
      } catch (e) {
        return sdError(e);
      }
    }
  }));

  // PATCH /structured-data/schema — collection only
  registry.register({ method: "PATCH", path: `${base}/schema` }, (request) => ({
    name: "structured-data.replaceSchema",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        const entry = await sd.replaceSchema({
          id: String(body.id ?? ""),
          schema: (body.schema ?? []) as import("#structured-data").FieldDef[],
          expectedRevision: Number(body.expectedRevision)
        });
        return { statusCode: 200, body: entry };
      } catch (e) {
        return sdError(e);
      }
    }
  }));

  // POST /structured-data/rows — collection only
  registry.register({ method: "POST", path: `${base}/rows` }, (request) => ({
    name: "structured-data.appendRows",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        const entry = await sd.appendRows({
          id: String(body.id ?? ""),
          rows: (body.rows ?? []) as import("#structured-data").DataRow[],
          expectedRevision: Number(body.expectedRevision)
        });
        return { statusCode: 200, body: entry };
      } catch (e) {
        return sdError(e);
      }
    }
  }));

  // DELETE /structured-data/rows — collection only
  registry.register({ method: "DELETE", path: `${base}/rows` }, (request) => ({
    name: "structured-data.deleteRows",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const body = request.body as Record<string, unknown>;
        const entry = await sd.deleteRows({
          id: String(body.id ?? ""),
          indices: (body.indices ?? []) as number[],
          expectedRevision: Number(body.expectedRevision)
        });
        return { statusCode: 200, body: entry };
      } catch (e) {
        return sdError(e);
      }
    }
  }));

  // GET /structured-data/value/entry?id=... — return evaluated FormulaValue for entry
  registry.register({ method: "GET", path: `${base}/value/entry` }, (request) => ({
    name: "structured-data.valueByEntryId",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const start = performance.now();
      const query = request.query as Record<string, string>;
      const id = query.id ?? "";
      const entry = await sd.get(id);
      if (!entry) {
        logger.warn("structured-data.value.entry.not-found", { id });
        return { statusCode: 404, body: { error: "not_found", message: `Entry not found: ${id}` } };
      }
      const snapshot = await resolver.buildSnapshot();
      const binding = snapshot.bindings.get(normalizeKey(entry.displayName));
      if (!binding) {
        logger.warn("structured-data.value.entry.unresolved", { id: entry.id, displayName: entry.displayName });
        return { statusCode: 409, body: { error: "unresolved", message: `Entry not resolved: ${entry.displayName}` } };
      }
      logger.info("structured-data.value.entry", {
        id: entry.id,
        displayName: entry.displayName,
        valueKind: binding.value.kind,
        durationMs: Math.round(performance.now() - start)
      });
      return {
        statusCode: 200,
        body: {
          entry: { id: entry.id, displayName: entry.displayName, kind: entry.kind, revision: entry.revision },
          valueKind: binding.value.kind,
          value: toWire(binding.value),
          resolution: {
            snapshotDigest: snapshot.snapshotDigest,
            bindingCount: snapshot.bindings.size,
            ownerRevision: binding.ownerRevision,
            valueDigest: binding.valueDigest
          }
        }
      };
    }
  }));

  // GET /structured-data/value/by-name?displayName=... — same as by id
  registry.register({ method: "GET", path: `${base}/value/by-name` }, (request) => ({
    name: "structured-data.valueByDisplayName",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      const start = performance.now();
      const query = request.query as Record<string, string>;
      const displayName = query.displayName ?? "";
      const entry = await sd.getByName(displayName);
      if (!entry) {
        logger.warn("structured-data.value.by-name.not-found", { displayName });
        return { statusCode: 404, body: { error: "not_found", message: `Entry not found: ${displayName}` } };
      }
      const snapshot = await resolver.buildSnapshot();
      const binding = snapshot.bindings.get(normalizeKey(entry.displayName));
      if (!binding) {
        logger.warn("structured-data.value.by-name.unresolved", { id: entry.id, displayName: entry.displayName });
        return { statusCode: 409, body: { error: "unresolved", message: `Entry not resolved: ${entry.displayName}` } };
      }
      logger.info("structured-data.value.by-name", {
        id: entry.id,
        displayName: entry.displayName,
        valueKind: binding.value.kind,
        durationMs: Math.round(performance.now() - start)
      });
      return {
        statusCode: 200,
        body: {
          entry: { id: entry.id, displayName: entry.displayName, kind: entry.kind, revision: entry.revision },
          valueKind: binding.value.kind,
          value: toWire(binding.value),
          resolution: {
            snapshotDigest: snapshot.snapshotDigest,
            bindingCount: snapshot.bindings.size,
            ownerRevision: binding.ownerRevision,
            valueDigest: binding.valueDigest
          }
        }
      };
    }
  }));

  // POST /structured-data/evaluate — evaluate ad-hoc source against current bindings
  registry.register({ method: "POST", path: `${base}/evaluate` }, (request) => ({
    name: "structured-data.evaluate",
    queueType: "concurrent",
    responseMode: "inline",
    work: async () => {
      try {
        const start = performance.now();
        const body = request.body as Record<string, unknown>;
        const source = String(body.source ?? "");
        const parsed = formula.parse({ source, languageVersion: "formula/v1" });
        if (!parsed.ok || !parsed.value) {
          logger.warn("structured-data.evaluate.parse-error", { sourcePreview: source.slice(0, 120), diagnostics: parsed.diagnostics ?? [] });
          return { statusCode: 400, body: { error: "parse_error", diagnostics: parsed.diagnostics ?? [] } };
        }
        const snapshot = await resolver.buildSnapshot();
        const evaluated = formula.evaluate({ expression: parsed.value, resolver: snapshot });
        if (!evaluated.ok || !evaluated.value) {
          logger.warn("structured-data.evaluate.eval-error", { sourcePreview: source.slice(0, 120), diagnostics: evaluated.diagnostics ?? [] });
          return { statusCode: 400, body: { error: "evaluation_error", diagnostics: evaluated.diagnostics ?? [] } };
        }
        logger.info("structured-data.evaluate", {
          sourcePreview: source.slice(0, 120),
          valueKind: evaluated.value.value.kind,
          steps: evaluated.value.steps,
          bindingCount: snapshot.bindings.size,
          durationMs: Math.round(performance.now() - start)
        });
        return {
          statusCode: 200,
          body: {
            valueKind: evaluated.value.value.kind,
            value: toWire(evaluated.value.value),
            observedDependencies: evaluated.value.observedDependencies,
            dependencyDigest: evaluated.value.dependencyDigest,
            evaluationDigest: evaluated.value.evaluationDigest,
            steps: evaluated.value.steps,
            snapshotDigest: snapshot.snapshotDigest,
            bindingCount: snapshot.bindings.size
          }
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error("structured-data.evaluate.unexpected", { message: msg });
        return { statusCode: 400, body: { error: "bad_request", message: msg } };
      }
    }
  }));
}
