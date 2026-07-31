// NameManager — in-process interface for managing named variables and functions.

import { randomUUID } from "node:crypto";
import type { Logger } from "#platform/observability/logger.js";
import type { NameManagerStore } from "./store.js";
import type {
  NameEntry, NameKind, NameManagerSnapshot, NameResolution,
  SnapshotRequest, ResolveRequest, ListRequest,
  DeclareNameRequest, RenameRequest, UpdateBodyRequest
} from "./types.js";
import { StaleRevisionError, NameConflictError, NameNotFoundError } from "./types.js";

export interface NameManagerConfig {
  readonly maxDisplayNameBytes: number;
  readonly maxNamesPerScope: number;
}

export interface NameManager {
  // Read
  snapshot(req: SnapshotRequest): Promise<NameManagerSnapshot>;
  resolve(req: ResolveRequest): Promise<NameResolution>;
  get(id: string): Promise<NameEntry | undefined>;
  list(req: ListRequest): Promise<NameEntry[]>;
  // Write
  declare(req: DeclareNameRequest): Promise<NameEntry>;
  rename(req: RenameRequest): Promise<NameEntry>;
  update(req: UpdateBodyRequest): Promise<NameEntry>;
  delete(id: string): Promise<void>;
}

class NameManagerImpl implements NameManager {
  constructor(
    private readonly store: NameManagerStore,
    private readonly config: NameManagerConfig,
    private readonly logger: Logger
  ) {}

  async snapshot(req: SnapshotRequest): Promise<NameManagerSnapshot> {
    const start = performance.now();
    const entries = this.store.listScope(req.scopeId);
    const map = new Map<string, NameEntry>();
    let maxRevision = 0;
    for (const entry of entries) {
      map.set(entry.displayName, entry);
      if (entry.revision > maxRevision) maxRevision = entry.revision;
    }
    const durationMs = Math.round(performance.now() - start);
    this.logger.debug("name-manager.snapshot", { scopeId: req.scopeId, count: entries.length, durationMs });
    return {
      id: randomUUID(),
      scopeId: req.scopeId,
      entries: map,
      snapshotRevision: maxRevision,
      createdAt: new Date().toISOString()
    };
  }

  async resolve(req: ResolveRequest): Promise<NameResolution> {
    const matches = this.store.getByDisplayName(req.scopeId, req.displayName);
    if (matches.length === 0) return { found: false };
    if (matches.length === 1) return { found: true, entry: matches[0] };
    return { found: true, ambiguous: true, candidates: matches };
  }

  async get(id: string): Promise<NameEntry | undefined> {
    return this.store.getEntry(id);
  }

  async list(req: ListRequest): Promise<NameEntry[]> {
    return this.store.listScope(req.scopeId, req.kind);
  }

  async declare(req: DeclareNameRequest): Promise<NameEntry> {
    const start = performance.now();

    // Validate display name length
    const nameBytes = Buffer.byteLength(req.displayName, "utf8");
    if (nameBytes > this.config.maxDisplayNameBytes) {
      throw new Error(`Display name exceeds maxDisplayNameBytes (${this.config.maxDisplayNameBytes})`);
    }

    // Check for conflicts
    const existing = this.store.getByDisplayName(req.scopeId, req.displayName);
    if (existing.length > 0) {
      throw new NameConflictError(req.displayName, req.scopeId);
    }

    // Check scope limit
    const scopeEntries = this.store.listScope(req.scopeId);
    if (scopeEntries.length >= this.config.maxNamesPerScope) {
      throw new Error(`Scope '${req.scopeId}' has reached maxNamesPerScope (${this.config.maxNamesPerScope})`);
    }

    const now = new Date().toISOString();
    const entry: NameEntry = {
      id: randomUUID(),
      kind: req.kind,
      scopeId: req.scopeId,
      displayName: req.displayName,
      body: req.body,
      revision: 1,
      createdAt: now,
      updatedAt: now
    };

    this.store.insert(entry);
    const durationMs = Math.round(performance.now() - start);
    this.logger.info("name-manager.declare", { id: entry.id, kind: entry.kind, scopeId: entry.scopeId, displayName: entry.displayName, durationMs });
    return entry;
  }

  async rename(req: RenameRequest): Promise<NameEntry> {
    const start = performance.now();
    const entry = this.store.getEntry(req.id);
    if (!entry) throw new NameNotFoundError(req.id);

    if (entry.revision !== req.expectedRevision) {
      throw new StaleRevisionError(req.id, entry.revision, req.expectedRevision);
    }

    // Check for conflicts with new name
    if (entry.displayName !== req.newDisplayName) {
      const existing = this.store.getByDisplayName(entry.scopeId, req.newDisplayName);
      if (existing.length > 0) throw new NameConflictError(req.newDisplayName, entry.scopeId);
    }

    const nameBytes = Buffer.byteLength(req.newDisplayName, "utf8");
    if (nameBytes > this.config.maxDisplayNameBytes) {
      throw new Error(`Display name exceeds maxDisplayNameBytes (${this.config.maxDisplayNameBytes})`);
    }

    const now = new Date().toISOString();
    const updated: NameEntry = { ...entry, displayName: req.newDisplayName, revision: entry.revision + 1, updatedAt: now };
    this.store.update(updated);

    const durationMs = Math.round(performance.now() - start);
    this.logger.info("name-manager.rename", { id: req.id, from: entry.displayName, to: req.newDisplayName, revision: updated.revision, durationMs });
    return updated;
  }

  async update(req: UpdateBodyRequest): Promise<NameEntry> {
    const start = performance.now();
    const entry = this.store.getEntry(req.id);
    if (!entry) throw new NameNotFoundError(req.id);

    if (entry.revision !== req.expectedRevision) {
      throw new StaleRevisionError(req.id, entry.revision, req.expectedRevision);
    }

    const now = new Date().toISOString();
    const updated: NameEntry = { ...entry, body: req.body, revision: entry.revision + 1, updatedAt: now };
    this.store.update(updated);

    const durationMs = Math.round(performance.now() - start);
    this.logger.info("name-manager.update", { id: req.id, revision: updated.revision, durationMs });
    return updated;
  }

  async delete(id: string): Promise<void> {
    const start = performance.now();
    const entry = this.store.getEntry(id);
    if (!entry) throw new NameNotFoundError(id);
    const now = new Date().toISOString();
    this.store.softDelete(id, now);
    const durationMs = Math.round(performance.now() - start);
    this.logger.info("name-manager.delete", { id, scopeId: entry.scopeId, displayName: entry.displayName, durationMs });
  }
}

export function createNameManager(
  store: NameManagerStore,
  config: NameManagerConfig,
  logger: Logger
): NameManager {
  return new NameManagerImpl(store, config, logger);
}
