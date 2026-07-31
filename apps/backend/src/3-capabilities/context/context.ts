// ContextManager — in-process interface for named context sets.

import { randomUUID } from "node:crypto";
import type { Logger } from "#platform/observability/logger.js";
import type { ContextEntry, KnowledgeResourceResolver } from "#platform/knowledge/types.js";
import type { ContextStore } from "./store.js";
import type { ContextStoreScope } from "./types.js";
import { ContextRecord, ContextNotFoundError, ContextConflictError, StaleContextError } from "./types.js";

export interface ContextManagerConfig {
  readonly maxEntriesPerContext: number;  // default 1000
  readonly maxResolveDepth: number;       // default 10 — cycle guard
}

/** ContextManager satisfies KnowledgeResourceResolver so it can be injected into Knowledge. */
export interface ContextManager extends KnowledgeResourceResolver {
  // ── CRUD ─────────────────────────────────────────────────────────────────
  /** Project-first lookup: if not in project scope, falls back to user scope. */
  get(id: string, scope?: ContextStoreScope): Promise<ContextRecord | null>;
  getByName(displayName: string, scope?: ContextStoreScope): Promise<ContextRecord | null>;
  list(opts?: { includeAnonymous?: boolean; scope?: ContextStoreScope }): Promise<ContextRecord[]>;
  declare(displayName: string, entries: ContextEntry[], scope?: ContextStoreScope): Promise<ContextRecord>;
  update(id: string, entries: ContextEntry[], expectedRevision: number, scope?: ContextStoreScope): Promise<ContextRecord>;
  delete(id: string, scope?: ContextStoreScope): Promise<void>;

  // ── Promotion ─────────────────────────────────────────────────────────────
  /** Copy a user-scoped context into the project scope. Errors on displayName conflict. */
  promote(id: string): Promise<ContextRecord>;

  // ── Resolution (satisfies KnowledgeResourceResolver) ─────────────────────
  /** Expand all kind:"context" entries recursively into leaf entries.
   *  Cycles are guarded; missing IDs are silently omitted. */
  resolve(entries: ContextEntry[], scope?: ContextStoreScope): Promise<ContextEntry[]>;

  // ── Pure composition (no I/O) ─────────────────────────────────────────────
  combine(a: ContextEntry[], b: ContextEntry[]): ContextEntry[];
  difference(a: ContextEntry[], b: ContextEntry[]): ContextEntry[];

  // ── Persisted composition ─────────────────────────────────────────────────
  /** Run combine/difference and persist the result as an anonymous (~uuid) context. */
  compose(op: "combine" | "difference", a: ContextEntry[], b: ContextEntry[], scope?: ContextStoreScope): Promise<ContextRecord>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dedup(entries: ContextEntry[]): ContextEntry[] {
  const seen = new Set<string>();
  const result: ContextEntry[] = [];
  for (const e of entries) {
    const key = `${e.kind}:${e.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(e);
    }
  }
  return result;
}

// ─── Implementation ───────────────────────────────────────────────────────────

class ContextManagerImpl implements ContextManager {
  constructor(
    private readonly store: ContextStore,
    private readonly config: ContextManagerConfig,
    private readonly logger: Logger
  ) {}

  async get(id: string, scope: ContextStoreScope = "project"): Promise<ContextRecord | null> {
    const t = performance.now();
    let record = this.store.get(id, scope);
    if (!record && scope === "project") record = this.store.get(id, "user");
    this.logger.debug("context.get", { id, scope, found: Boolean(record), durationMs: Math.round(performance.now() - t) });
    return record ?? null;
  }

  async getByName(displayName: string, scope: ContextStoreScope = "project"): Promise<ContextRecord | null> {
    const t = performance.now();
    let record = this.store.getByName(displayName, scope);
    if (!record && scope === "project") record = this.store.getByName(displayName, "user");
    this.logger.debug("context.getByName", { displayName, scope, found: Boolean(record), durationMs: Math.round(performance.now() - t) });
    return record ?? null;
  }

  async list(opts: { includeAnonymous?: boolean; scope?: ContextStoreScope } = {}): Promise<ContextRecord[]> {
    const t = performance.now();
    const scope = opts.scope ?? "project";
    const includeAnonymous = opts.includeAnonymous ?? false;
    const records = this.store.list(scope, includeAnonymous);
    this.logger.debug("context.list", { scope, includeAnonymous, count: records.length, durationMs: Math.round(performance.now() - t) });
    return records;
  }

  async declare(displayName: string, entries: ContextEntry[], scope: ContextStoreScope = "project"): Promise<ContextRecord> {
    const t = performance.now();
    if (entries.length > this.config.maxEntriesPerContext) {
      throw new Error(`Entries exceed maxEntriesPerContext (${this.config.maxEntriesPerContext})`);
    }
    const existing = this.store.getByName(displayName, scope);
    if (existing) throw new ContextConflictError(displayName);

    const now = new Date().toISOString();
    const record: ContextRecord = {
      id: randomUUID(),
      displayName,
      entries: dedup(entries),
      revision: 1,
      createdAt: now,
      updatedAt: now
    };
    this.store.insert(record, scope);
    this.logger.info("context.declare", { id: record.id, displayName, scope, entryCount: record.entries.length, durationMs: Math.round(performance.now() - t) });
    return record;
  }

  async update(id: string, entries: ContextEntry[], expectedRevision: number, scope: ContextStoreScope = "project"): Promise<ContextRecord> {
    const t = performance.now();
    if (entries.length > this.config.maxEntriesPerContext) {
      throw new Error(`Entries exceed maxEntriesPerContext (${this.config.maxEntriesPerContext})`);
    }
    const existing = this.store.get(id, scope);
    if (!existing) throw new ContextNotFoundError(id);
    if (existing.revision !== expectedRevision) throw new StaleContextError(id, existing.revision, expectedRevision);

    const updated: ContextRecord = {
      ...existing,
      entries: dedup(entries),
      revision: existing.revision + 1,
      updatedAt: new Date().toISOString()
    };
    this.store.update(updated, scope);
    this.logger.info("context.update", { id, scope, entryCount: updated.entries.length, revision: updated.revision, durationMs: Math.round(performance.now() - t) });
    return updated;
  }

  async delete(id: string, scope: ContextStoreScope = "project"): Promise<void> {
    const t = performance.now();
    const existing = this.store.get(id, scope);
    if (!existing) throw new ContextNotFoundError(id);
    this.store.softDelete(id, scope, new Date().toISOString());
    this.logger.info("context.delete", { id, scope, durationMs: Math.round(performance.now() - t) });
  }

  async promote(id: string): Promise<ContextRecord> {
    const t = performance.now();
    const userRecord = this.store.get(id, "user");
    if (!userRecord) throw new ContextNotFoundError(id);
    const existing = this.store.getByName(userRecord.displayName, "project");
    if (existing) throw new ContextConflictError(userRecord.displayName);

    const now = new Date().toISOString();
    const promoted: ContextRecord = {
      ...userRecord,
      id: randomUUID(),
      revision: 1,
      createdAt: now,
      updatedAt: now
    };
    this.store.insert(promoted, "project");
    this.logger.info("context.promote", { fromScope: "user", toScope: "project", sourceId: id, resultId: promoted.id, durationMs: Math.round(performance.now() - t) });
    return promoted;
  }

  async resolve(entries: ContextEntry[], scope: ContextStoreScope = "project"): Promise<ContextEntry[]> {
    const t = performance.now();
    const result: ContextEntry[] = [];
    const seen = new Set<string>();

    const expand = async (toExpand: ContextEntry[], depth: number): Promise<void> => {
      if (depth > this.config.maxResolveDepth) return;
      for (const entry of toExpand) {
        if (entry.kind !== "context") {
          const key = `${entry.kind}:${entry.id}`;
          if (!seen.has(key)) { seen.add(key); result.push(entry); }
          continue;
        }
        const contextKey = `context:${entry.id}`;
        if (seen.has(contextKey)) continue; // cycle guard
        seen.add(contextKey);

        let record = this.store.get(entry.id, scope);
        if (!record && scope === "project") record = this.store.get(entry.id, "user");
        if (!record) continue; // silently omit missing/deleted

        await expand(record.entries, depth + 1);
      }
    };

    await expand(entries, 0);
    this.logger.debug("context.resolve", { inputCount: entries.length, resolvedCount: result.length, durationMs: Math.round(performance.now() - t) });
    return result;
  }

  combine(a: ContextEntry[], b: ContextEntry[]): ContextEntry[] {
    const seen = new Set<string>();
    const result: ContextEntry[] = [];
    for (const e of [...a, ...b]) {
      const key = `${e.kind}:${e.id}`;
      if (!seen.has(key)) { seen.add(key); result.push(e); }
    }
    return result;
  }

  difference(a: ContextEntry[], b: ContextEntry[]): ContextEntry[] {
    const bKeys = new Set(b.map(e => `${e.kind}:${e.id}`));
    return a.filter(e => !bKeys.has(`${e.kind}:${e.id}`));
  }

  async compose(op: "combine" | "difference", a: ContextEntry[], b: ContextEntry[], scope: ContextStoreScope = "project"): Promise<ContextRecord> {
    const t = performance.now();
    const result = op === "combine" ? this.combine(a, b) : this.difference(a, b);
    const displayName = `~${randomUUID()}`;
    const now = new Date().toISOString();
    const record: ContextRecord = {
      id: randomUUID(),
      displayName,
      entries: result,
      revision: 1,
      createdAt: now,
      updatedAt: now
    };
    this.store.insert(record, scope);
    this.logger.info("context.compose", { op, scope, entryCount: result.length, resultId: record.id, durationMs: Math.round(performance.now() - t) });
    return record;
  }
}

export function createContextManager(
  store: ContextStore,
  config: ContextManagerConfig,
  logger: Logger
): ContextManager {
  return new ContextManagerImpl(store, config, logger);
}
