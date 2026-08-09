// ContextManager — in-process interface for named context sets.

import { randomUUID } from "node:crypto";
import type { Logger } from "#platform/observability/logger.js";
import type { ContextEntry, KnowledgeResourceResolver } from "#platform/knowledge/types.js";
import type { ContextStore } from "./store.js";
import {
  ContextRecord,
  ContextNotFoundError,
  ContextConflictError,
  StaleContextError,
  ContextValidationError,
  isProjectEntry,
  type ProjectMembershipPort
} from "./types.js";
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
  /**
   * Subtracted from the expansion of the record's entries at resolve time.
   * See `ContextRecord.excludes`.
   */
  readonly excludes?: ContextEntry[];
}

/** ContextManager satisfies KnowledgeResourceResolver so it can be injected into Knowledge. */
export interface ContextManager extends KnowledgeResourceResolver {
  // ── CRUD ─────────────────────────────────────────────────────────────────
  get(id: string): Promise<ContextRecord | null>;
  getByName(displayName: string): Promise<ContextRecord | null>;
  list(opts?: { includePrivate?: boolean }): Promise<ContextRecord[]>;
  declare(displayName: string, entries: ContextEntry[], options?: ContextWriteOptions): Promise<ContextRecord>;
  /**
   * Replaces the entry set. `excludes` is replaced only when supplied —
   * omitting it leaves the existing exclusions alone, because a caller
   * updating entries has not thereby said anything about exclusions. Pass `[]`
   * to clear them.
   */
  update(
    id: string,
    entries: ContextEntry[],
    expectedRevision: number,
    options?: { excludes?: ContextEntry[] }
  ): Promise<ContextRecord>;
  delete(id: string): Promise<void>;
  purge(id: string): Promise<void>;
  pruneHistory(cutoff: string): number;
  purgeExpired(cutoff: string): number;

  // ── Resolution (satisfies KnowledgeResourceResolver) ─────────────────────
  /** Expand all kind:"context" entries recursively into leaf entries, expand
   *  `kind: "project"` into the project's current membership, and subtract each
   *  record's `excludes` from its own expansion.
   *  Cycles are guarded; missing IDs are silently omitted. */
  resolve(entries: ContextEntry[]): Promise<ContextEntry[]>;

  /**
   * Supplies the live project membership behind `kind: "project"`. Called once
   * during composition, after the resource capabilities exist — the same
   * mutable-during-wiring shape the resource registry uses.
   *
   * Until this is called, a `project` entry expands to **nothing** and logs a
   * warning. That is deliberate: an unresolvable "everything" that silently
   * became "everything" would ground a caller on the whole corpus without
   * their knowing, and an empty result is the failure you can see.
   */
  setProjectMembership(port: ProjectMembershipPort): void;

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

const entryKey = (entry: ContextEntry): string => `${entry.kind}:${entry.id}`;

function dedup(entries: ContextEntry[]): ContextEntry[] {
  const seen = new Set<string>();
  const result: ContextEntry[] = [];
  for (const e of entries) {
    const key = entryKey(e);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(e);
    }
  }
  return result;
}

/**
 * Removes `excludes` from `entries`.
 *
 * **Matches on `id` alone, not on `kind:id`.** The two sides are written by
 * different people at different times: the expansion's spelling comes from
 * whichever capability owns the resource (`general::file::markdown`), while the
 * exclusion's comes from whoever typed it (`general-file`). Requiring the kinds
 * to agree would let an exclusion silently fail to subtract — and an exclusion
 * that silently fails leaks exactly the thing someone asked to keep out.
 *
 * The cost of the looser match is that two resources sharing an `id` across
 * kinds would both be excluded. That errs toward excluding too much, which
 * narrows a scope rather than leaking one, so it is the safe direction to be
 * wrong in. Resource IDs are allocated by their storing capability and are not
 * expected to collide in practice.
 */
function subtract(entries: ContextEntry[], excludes: ContextEntry[]): ContextEntry[] {
  if (excludes.length === 0) return entries;
  const excludedIds = new Set(excludes.map((entry) => entry.id));
  return entries.filter((entry) => !excludedIds.has(entry.id));
}

// ─── Implementation ───────────────────────────────────────────────────────────

/**
 * Per-call resolution bookkeeping. Threaded rather than held on the instance so
 * concurrent resolves cannot see each other's memo or counters.
 */
interface ResolutionState {
  /** contextId → its fully resolved set. Makes a diamond cost one expansion. */
  readonly memo: Map<string, ContextEntry[]>;
  /** Fetched at most once per resolve, so one call sees one membership. */
  projectEntries: ContextEntry[] | undefined;
  projectExpansions: number;
  contextsVisited: number;
  cyclesCut: number;
  depthCuts: number;
  missing: number;
  excluded: number;
}

class ContextManagerImpl implements ContextManager {
  private projectMembershipPort: ProjectMembershipPort | undefined;

  constructor(
    private readonly store: ContextStore,
    private readonly config: ContextManagerConfig,
    private readonly logger: Logger
  ) {}

  setProjectMembership(port: ProjectMembershipPort): void {
    this.projectMembershipPort = port;
    this.logger.info("context.project-membership.registered");
  }

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
    this.assertWithinEntryLimit("entries", entries);
    this.assertWithinEntryLimit("excludes", options.excludes ?? []);
    const existing = this.store.getByName(displayName);
    if (existing) throw new ContextConflictError(displayName);

    const now = new Date().toISOString();
    const excludes = dedup(options.excludes ?? []);
    const record: ContextRecord = {
      id: randomUUID(),
      displayName,
      description: options.description,
      entries: dedup(entries),
      ...(excludes.length > 0 ? { excludes } : {}),
      private: options.private ?? false,
      revision: 1,
      createdAt: now,
      updatedAt: now
    };
    this.store.insert(record);
    this.logger.info("context.declare", {
      id: record.id,
      displayName,
      entryCount: record.entries.length,
      excludeCount: excludes.length,
      namesProject: record.entries.some(isProjectEntry),
      private: record.private,
      durationMs: Math.round(performance.now() - t)
    });
    this.logger.info(
      "context.declare.detail",
      { id: record.id, displayName, description: record.description, entries: record.entries, excludes },
      { detail: "content" }
    );
    return record;
  }

  private assertWithinEntryLimit(field: string, entries: ContextEntry[]): void {
    if (entries.length > this.config.maxEntriesPerContext) {
      throw new ContextValidationError(
        field,
        `count ${entries.length} exceeds maxEntriesPerContext (${this.config.maxEntriesPerContext})`
      );
    }
  }

  async update(
    id: string,
    entries: ContextEntry[],
    expectedRevision: number,
    options: { excludes?: ContextEntry[] } = {}
  ): Promise<ContextRecord> {
    const t = performance.now();
    this.assertWithinEntryLimit("entries", entries);
    if (options.excludes) this.assertWithinEntryLimit("excludes", options.excludes);
    const existing = this.store.get(id);
    if (!existing) throw new ContextNotFoundError(id);
    if (existing.revision !== expectedRevision) throw new StaleContextError(id, existing.revision, expectedRevision);

    // Omitted means "leave them alone" rather than "clear them": a caller
    // replacing entries has said nothing about exclusions, and reading silence
    // as deletion would quietly widen a scope that was deliberately narrowed.
    const excludes = dedup(options.excludes ?? existing.excludes ?? []);
    const updated: ContextRecord = {
      ...existing,
      entries: dedup(entries),
      ...(excludes.length > 0 ? { excludes } : { excludes: undefined }),
      revision: existing.revision + 1,
      updatedAt: new Date().toISOString()
    };
    if (!this.store.update(updated, expectedRevision)) {
      const current = this.store.get(id);
      if (!current) throw new ContextNotFoundError(id);
      throw new StaleContextError(id, current.revision, expectedRevision);
    }
    this.logger.info("context.update", {
      id,
      entryCount: updated.entries.length,
      excludeCount: excludes.length,
      excludesReplaced: options.excludes !== undefined,
      namesProject: updated.entries.some(isProjectEntry),
      revision: updated.revision,
      durationMs: Math.round(performance.now() - t)
    });
    this.logger.info(
      "context.update.detail",
      {
        id,
        revision: updated.revision,
        before: { entries: existing.entries, excludes: existing.excludes ?? [] },
        after: { entries: updated.entries, excludes }
      },
      { detail: "content" }
    );
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

  /**
   * Expansion is per-record rather than into one shared accumulator, because a
   * record's `excludes` apply to *its own* expansion and nothing else. Context A
   * holding Context B does not inherit B's exclusions as its own — it inherits
   * B's result, which already has them subtracted. That composes: every record
   * resolves to a set, and a set is what its parent sees.
   */
  async resolve(entries: ContextEntry[]): Promise<ContextEntry[]> {
    const t = performance.now();
    const state: ResolutionState = {
      memo: new Map(),
      projectEntries: undefined,
      projectExpansions: 0,
      contextsVisited: 0,
      cyclesCut: 0,
      depthCuts: 0,
      missing: 0,
      excluded: 0
    };

    const resolved = dedup(await this.expandList(entries, new Set(), 0, state));

    this.logger.debug("context.resolve", {
      inputCount: entries.length,
      resolvedCount: resolved.length,
      contextsVisited: state.contextsVisited,
      projectExpansions: state.projectExpansions,
      projectEntryCount: state.projectEntries?.length ?? 0,
      excludedCount: state.excluded,
      cyclesCut: state.cyclesCut,
      depthCuts: state.depthCuts,
      missingContexts: state.missing,
      durationMs: Math.round(performance.now() - t)
    });
    // The resolved membership itself, not just its size: when a prompt grounds
    // on the wrong thing this is the line that says what it actually got.
    this.logger.debug(
      "context.resolve.detail",
      { input: entries, resolved },
      { detail: "content" }
    );
    return resolved;
  }

  /** Expand one list of entries. Leaves pass through; contexts and the project
   *  sentinel expand. */
  private async expandList(
    toExpand: ContextEntry[],
    ancestors: ReadonlySet<string>,
    depth: number,
    state: ResolutionState
  ): Promise<ContextEntry[]> {
    if (depth > this.config.maxResolveDepth) {
      state.depthCuts += 1;
      return [];
    }

    const collected: ContextEntry[] = [];
    for (const entry of toExpand) {
      if (isProjectEntry(entry)) {
        collected.push(...(await this.projectMembership(state)));
        continue;
      }
      if (entry.kind !== "context") {
        collected.push(entry);
        continue;
      }
      collected.push(...(await this.expandContext(entry.id, ancestors, depth, state)));
    }
    return collected;
  }

  /**
   * One Context record's resolved set.
   *
   * The cycle guard is the **ancestor path**, not everything seen so far. A
   * global set would be wrong now that exclusions exist: a Context reached twice
   * by different routes must resolve to the same set both times, and a global
   * "already visited, skip" would silently hand the second route an empty one.
   * The memo is what keeps that from costing anything on a diamond.
   */
  private async expandContext(
    contextId: string,
    ancestors: ReadonlySet<string>,
    depth: number,
    state: ResolutionState
  ): Promise<ContextEntry[]> {
    if (ancestors.has(contextId)) {
      state.cyclesCut += 1;
      return [];
    }
    const memoized = state.memo.get(contextId);
    if (memoized) return memoized;

    const record = this.store.get(contextId);
    if (!record) {
      state.missing += 1;
      return []; // silently omit missing/deleted
    }
    state.contextsVisited += 1;

    const nested = new Set(ancestors);
    nested.add(contextId);

    const included = await this.expandList(record.entries, nested, depth + 1, state);

    // Exclusions expand too, so "everything except what that Context holds"
    // tracks that Context rather than a snapshot of it.
    let removed: ContextEntry[] = [];
    let exclusionTruncated = false;
    if (record.excludes?.length) {
      const cutsBefore = state.cyclesCut + state.depthCuts;
      removed = await this.expandList(record.excludes, nested, depth + 1, state);
      exclusionTruncated = state.cyclesCut + state.depthCuts > cutsBefore;
    }

    if (exclusionTruncated) {
      // A cycle or the depth cap stopped us working out what to keep out. On
      // the include side a cut branch is an omission — you get less than you
      // asked for, which is harmless. On the exclude side the same rule would
      // hand back the very resources someone said to withhold, so this fails
      // the other way and withholds everything.
      this.logger.error("context.resolve.exclusion-incomplete", {
        contextId,
        includedCount: included.length,
        reason: "a cycle or the depth cap truncated the exclusion list"
      });
      return [];
    }

    const result = subtract(included, removed);
    state.excluded += included.length - result.length;

    if (removed.length > 0) {
      this.logger.debug("context.resolve.excluded", {
        contextId,
        includedCount: included.length,
        excludeCount: removed.length,
        remainingCount: result.length
      });
    }

    // Only memoize a complete answer. A branch cut by the depth cap or a cycle
    // is truncated *for this path*, and caching it would leak that truncation
    // onto a shallower path that would have resolved it fully.
    if (depth + 1 <= this.config.maxResolveDepth) {
      state.memo.set(contextId, result);
    }
    return result;
  }

  /** Fetched at most once per resolve: membership is a snapshot of one call. */
  private async projectMembership(state: ResolutionState): Promise<ContextEntry[]> {
    state.projectExpansions += 1;
    if (state.projectEntries) return state.projectEntries;

    if (!this.projectMembershipPort) {
      // Empty, not everything. See setProjectMembership.
      this.logger.warn("context.resolve.project-unavailable", {
        reason: "no project membership port registered"
      });
      state.projectEntries = [];
      return state.projectEntries;
    }

    const t = performance.now();
    try {
      state.projectEntries = await this.projectMembershipPort.listProjectEntries();
    } catch (error) {
      // A failed enumeration must not become "everything" — the caller asked
      // for the project and we do not know what it holds, so they get nothing
      // and a loud line rather than a silently over-broad scope.
      this.logger.error("context.resolve.project-failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      state.projectEntries = [];
      return state.projectEntries;
    }
    this.logger.debug("context.resolve.project", {
      entryCount: state.projectEntries.length,
      durationMs: Math.round(performance.now() - t)
    });
    this.logger.debug(
      "context.resolve.project.detail",
      { entries: state.projectEntries },
      { detail: "content" }
    );
    return state.projectEntries;
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

  /**
   * A composition operand as *stored*, not as expanded.
   *
   * A `{contextId}` operand becomes a nested `kind: "context"` reference rather
   * than a copy of that context's entries. That is the whole of what makes a
   * composed context live: copying the entries would freeze the operand as it
   * stood at compose time, so "everything in A except B" would stop tracking A
   * the moment anything was added to it. A reference is re-expanded on every
   * resolve.
   *
   * The record is still loaded, so a composition naming a context that does not
   * exist fails at compose time rather than silently resolving to nothing later.
   */
  private operandEntries(operand: ContextOperand): ContextEntry[] {
    if ("contextId" in operand) {
      const record = this.store.get(operand.contextId);
      if (!record) throw new ContextNotFoundError(operand.contextId);
      return [{ id: operand.contextId, kind: "context" }];
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

    const entriesA = this.operandEntries(a);
    const entriesB = this.operandEntries(b);

    // A union stores both operands and resolves to their combined expansion. A
    // difference stores the left operand and puts the right one in `excludes`,
    // which is the same statement made at resolve time instead of write time.
    // Neither materialises a leaf set, so both stay correct as their operands
    // change — the point of the exercise.
    const entries = op === "union" ? dedup([...entriesA, ...entriesB]) : dedup(entriesA);
    const excludes = op === "union" ? [] : dedup(entriesB);
    this.assertWithinEntryLimit("entries", entries);
    this.assertWithinEntryLimit("excludes", excludes);

    const now = new Date().toISOString();
    const record: ContextRecord = {
      id: randomUUID(),
      displayName,
      description: options.description,
      entries,
      ...(excludes.length > 0 ? { excludes } : {}),
      private: options.private ?? false,
      revision: 1,
      createdAt: now,
      updatedAt: now
    };
    this.store.insert(record);
    this.logger.info("context.composeNamed", {
      op,
      displayName,
      entryCount: entries.length,
      excludeCount: excludes.length,
      resultId: record.id,
      private: record.private,
      durationMs: Math.round(performance.now() - t)
    });
    this.logger.info(
      "context.composeNamed.detail",
      { op, resultId: record.id, displayName, entries, excludes },
      { detail: "content" }
    );
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
