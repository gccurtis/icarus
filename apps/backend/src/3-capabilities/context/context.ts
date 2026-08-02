// ContextManager — in-process interface for named context sets.

import { randomUUID } from "node:crypto";
import type { Logger } from "#platform/observability/logger.js";
import type { ContextEntry, KnowledgeResourceResolver } from "#platform/knowledge/types.js";
import type { ContextStore } from "./store.js";
import { ContextRecord, ContextNotFoundError, ContextConflictError, StaleContextError, ContextValidationError } from "./types.js";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError
} from "#utils/persistence/resourceHistory.js";

export interface ContextManagerConfig {
  readonly maxEntriesPerContext: number;  // default 100,000
  readonly maxResolveDepth: number;       // default 10 — cycle guard
}

/** One operand for a composition request: either an existing context by ID, or inline entries. */
export type ContextOperand = { contextId: string } | { entries: ContextEntry[] };

/** Optional fields shared by declare() and composeNamed(). private defaults to false. */
export interface ContextWriteOptions {
  readonly description?: string;
  readonly private?: boolean;
}

/** ContextManager satisfies KnowledgeResourceResolver so it can be injected into Knowledge. */
export interface ContextManager extends KnowledgeResourceResolver {
  // ── CRUD ─────────────────────────────────────────────────────────────────
  get(id: string): Promise<ContextRecord | null>;
  getByName(displayName: string): Promise<ContextRecord | null>;
  list(opts?: { includePrivate?: boolean }): Promise<ContextRecord[]>;
  declare(displayName: string, entries: ContextEntry[], options?: ContextWriteOptions): Promise<ContextRecord>;
  update(id: string, entries: ContextEntry[], expectedRevision: number): Promise<ContextRecord>;
  delete(id: string): Promise<void>;
  purge(id: string): Promise<void>;
  pruneHistory(cutoff: string): number;
  purgeExpired(cutoff: string): number;

  // ── Resolution (satisfies KnowledgeResourceResolver) ─────────────────────
  /** Expand all kind:"context" entries recursively into leaf entries.
   *  Cycles are guarded; missing IDs are silently omitted. */
  resolve(entries: ContextEntry[]): Promise<ContextEntry[]>;

  // ── Pure composition (no I/O) ─────────────────────────────────────────────
  combine(a: ContextEntry[], b: ContextEntry[]): ContextEntry[];
  difference(a: ContextEntry[], b: ContextEntry[]): ContextEntry[];

  // ── Persisted, named composition ─────────────────────────────────────────
  /** Resolve each operand (by context ID or inline entries), apply union/difference,
   *  and persist the result as a new named context. Returns the created record. */
  composeNamed(
    op: "union" | "difference",
    a: ContextOperand,
    b: ContextOperand,
    displayName: string,
    options?: ContextWriteOptions
  ): Promise<ContextRecord>;
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

  async get(id: string): Promise<ContextRecord | null> {
    const t = performance.now();
    const record = this.store.get(id);
    this.logger.debug("context.get", { id, found: Boolean(record), durationMs: Math.round(performance.now() - t) });
    return record ?? null;
  }

  async getByName(displayName: string): Promise<ContextRecord | null> {
    const t = performance.now();
    const record = this.store.getByName(displayName);
    this.logger.debug("context.getByName", { displayName, found: Boolean(record), durationMs: Math.round(performance.now() - t) });
    return record ?? null;
  }

  async list(opts: { includePrivate?: boolean } = {}): Promise<ContextRecord[]> {
    const t = performance.now();
    const includePrivate = opts.includePrivate ?? false;
    const records = this.store.list(includePrivate);
    this.logger.debug("context.list", { includePrivate, count: records.length, durationMs: Math.round(performance.now() - t) });
    return records;
  }

  async declare(displayName: string, entries: ContextEntry[], options: ContextWriteOptions = {}): Promise<ContextRecord> {
    const t = performance.now();
    if (entries.length > this.config.maxEntriesPerContext) {
      throw new ContextValidationError(
        "entries",
        `count ${entries.length} exceeds maxEntriesPerContext (${this.config.maxEntriesPerContext})`
      );
    }
    const existing = this.store.getByName(displayName);
    if (existing) throw new ContextConflictError(displayName);

    const now = new Date().toISOString();
    const record: ContextRecord = {
      id: randomUUID(),
      displayName,
      description: options.description,
      entries: dedup(entries),
      private: options.private ?? false,
      revision: 1,
      createdAt: now,
      updatedAt: now
    };
    this.store.insert(record);
    this.logger.info("context.declare", { id: record.id, displayName, entryCount: record.entries.length, private: record.private, durationMs: Math.round(performance.now() - t) });
    return record;
  }

  async update(id: string, entries: ContextEntry[], expectedRevision: number): Promise<ContextRecord> {
    const t = performance.now();
    if (entries.length > this.config.maxEntriesPerContext) {
      throw new ContextValidationError(
        "entries",
        `count ${entries.length} exceeds maxEntriesPerContext (${this.config.maxEntriesPerContext})`
      );
    }
    const existing = this.store.get(id);
    if (!existing) throw new ContextNotFoundError(id);
    if (existing.revision !== expectedRevision) throw new StaleContextError(id, existing.revision, expectedRevision);

    const updated: ContextRecord = {
      ...existing,
      entries: dedup(entries),
      revision: existing.revision + 1,
      updatedAt: new Date().toISOString()
    };
    if (!this.store.update(updated, expectedRevision)) {
      const current = this.store.get(id);
      if (!current) throw new ContextNotFoundError(id);
      throw new StaleContextError(id, current.revision, expectedRevision);
    }
    this.logger.info("context.update", { id, entryCount: updated.entries.length, revision: updated.revision, durationMs: Math.round(performance.now() - t) });
    return updated;
  }

  async delete(id: string): Promise<void> {
    const t = performance.now();
    const existing = this.store.get(id);
    if (!existing) throw new ContextNotFoundError(id);
    const revision = this.store.delete(id, new Date().toISOString());
    if (revision === undefined) throw new ContextNotFoundError(id);
    this.logger.info("context.delete", { id, revision, durationMs: Math.round(performance.now() - t) });
  }

  async purge(id: string): Promise<void> {
    const outcome = this.store.purge(id);
    if (outcome === "current") throw new ResourceNotDeletedError("context", id);
    if (outcome === "missing") throw new ResourceHistoryNotFoundError("context", id);
    this.logger.info("context.purge", { id });
  }

  pruneHistory(cutoff: string): number {
    return this.store.pruneHistory(cutoff);
  }

  purgeExpired(cutoff: string): number {
    return this.store.purgeExpired(cutoff);
  }

  async resolve(entries: ContextEntry[]): Promise<ContextEntry[]> {
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

        const record = this.store.get(entry.id);
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

  private resolveOperand(operand: ContextOperand): ContextEntry[] {
    if ("contextId" in operand) {
      const record = this.store.get(operand.contextId);
      if (!record) throw new ContextNotFoundError(operand.contextId);
      return record.entries;
    }
    return operand.entries;
  }

  async composeNamed(
    op: "union" | "difference",
    a: ContextOperand,
    b: ContextOperand,
    displayName: string,
    options: ContextWriteOptions = {}
  ): Promise<ContextRecord> {
    const t = performance.now();
    if (!displayName || displayName.trim().length === 0) {
      throw new ContextValidationError("displayName", "is required");
    }
    const existing = this.store.getByName(displayName);
    if (existing) throw new ContextConflictError(displayName);

    const entriesA = this.resolveOperand(a);
    const entriesB = this.resolveOperand(b);
    const result = op === "union" ? this.combine(entriesA, entriesB) : this.difference(entriesA, entriesB);
    if (result.length > this.config.maxEntriesPerContext) {
      throw new ContextValidationError(
        "entries",
        `count ${result.length} exceeds maxEntriesPerContext (${this.config.maxEntriesPerContext})`
      );
    }

    const now = new Date().toISOString();
    const record: ContextRecord = {
      id: randomUUID(),
      displayName,
      description: options.description,
      entries: result,
      private: options.private ?? false,
      revision: 1,
      createdAt: now,
      updatedAt: now
    };
    this.store.insert(record);
    this.logger.info("context.composeNamed", { op, displayName, entryCount: result.length, resultId: record.id, private: record.private, durationMs: Math.round(performance.now() - t) });
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
