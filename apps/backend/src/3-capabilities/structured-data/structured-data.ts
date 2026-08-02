// StructuredData — in-process interface for all named values in a project.

import { randomUUID } from "node:crypto";
import type { Logger } from "#platform/observability/logger.js";
import type { DataStore } from "./store.js";
import type {
  DataEntry, DataKind, DataQuery, DataQueryResult,
  DataBindingView, FormulaEntry, CollectionEntry, FieldDef, DataRow
} from "./types.js";
import {
  DataEntryNotFoundError, DataEntryConflictError, StaleDataRevisionError
} from "./types.js";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError
} from "#utils/persistence/resourceHistory.js";
import {
  canonicalizeDisplayName,
  normalizeDisplayNameKey,
  validateAppendRows,
  validateCollectionRows,
  validateCollectionSchema,
  validateDeleteIndices,
  validateDisplayName,
  validateFormulaBody
} from "./validation.js";

export interface StructuredDataConfig {
  readonly maxDisplayNameBytes: number;    // default 256
  readonly maxEntries: number;             // default 10000
  readonly maxFieldsPerCollection: number; // default 256
  readonly maxRowsPerCollection: number;   // default 100000
  readonly maxBodyBytes: number;           // default 65536
}

export interface DeclareFormulaEntryRequest {
  readonly kind: "variable" | "function";
  readonly displayName: string;
  readonly body: string;
  readonly description?: string;
}

export interface DeclareCollectionEntryRequest {
  readonly kind: "table" | "record" | "list";
  readonly displayName: string;
  readonly schema: FieldDef[];
  readonly rows?: DataRow[];
  readonly description?: string;
}

export type DeclareEntryRequest = DeclareFormulaEntryRequest | DeclareCollectionEntryRequest;

export interface RenameEntryRequest {
  readonly id: string;
  readonly newDisplayName: string;
  readonly expectedRevision: number;
}

export interface UpdateBodyRequest {
  readonly id: string;
  readonly body: string;
  readonly expectedRevision: number;
}

export interface UpdateDescriptionRequest {
  readonly id: string;
  readonly description: string;
  readonly expectedRevision: number;
}

export interface DeleteEntryRequest {
  readonly id: string;
  readonly expectedRevision: number;
}

export interface ReplaceSchemaRequest {
  readonly id: string;
  readonly schema: FieldDef[];
  readonly expectedRevision: number;
}

export interface AppendRowsRequest {
  readonly id: string;
  readonly rows: DataRow[];
  readonly expectedRevision: number;
}

export interface DeleteRowsRequest {
  readonly id: string;
  readonly indices: number[];
  readonly expectedRevision: number;
}

export interface StructuredData {
  // Read
  bindingView(): Promise<DataBindingView>;
  get(id: string): Promise<DataEntry | undefined>;
  getByName(displayName: string): Promise<DataEntry | undefined>;
  list(kind?: DataKind): Promise<DataEntry[]>;
  query(q: DataQuery): Promise<DataQueryResult>;
  // Write — all kinds
  declare(req: DeclareEntryRequest): Promise<DataEntry>;
  rename(req: RenameEntryRequest): Promise<DataEntry>;
  updateDescription(req: UpdateDescriptionRequest): Promise<DataEntry>;
  delete(req: DeleteEntryRequest): Promise<void>;
  purge(id: string): Promise<void>;
  pruneHistory(cutoff: string): number;
  purgeExpired(cutoff: string): number;
  // Write — formula/function only
  updateBody(req: UpdateBodyRequest): Promise<DataEntry>;
  // Write — collection only
  replaceSchema(req: ReplaceSchemaRequest): Promise<CollectionEntry>;
  appendRows(req: AppendRowsRequest): Promise<CollectionEntry>;
  deleteRows(req: DeleteRowsRequest): Promise<CollectionEntry>;
}

class StructuredDataImpl implements StructuredData {
  constructor(
    private readonly store: DataStore,
    private readonly config: StructuredDataConfig,
    private readonly logger: Logger
  ) {}

  private persistUpdate(entry: DataEntry, expectedRevision: number): void {
    if (this.store.update(entry, expectedRevision)) return;
    const current = this.store.getEntry(entry.id);
    if (!current) throw new DataEntryNotFoundError(entry.id);
    throw new StaleDataRevisionError(entry.id, current.revision, expectedRevision);
  }

  async bindingView(): Promise<DataBindingView> {
    const start = performance.now();
    const all = this.store.listAll();
    const map = new Map<string, DataEntry>();
    let maxRevision = 0;
    for (const entry of all) {
      map.set(normalizeDisplayNameKey(entry.displayName), entry);
      if (entry.revision > maxRevision) maxRevision = entry.revision;
    }
    const durationMs = Math.round(performance.now() - start);
    this.logger.debug("data.bindingView", { count: all.length, viewRevision: maxRevision, durationMs });
    return { id: randomUUID(), entries: map, viewRevision: maxRevision, createdAt: new Date().toISOString() };
  }

  async get(id: string): Promise<DataEntry | undefined> {
    return this.store.getEntry(id);
  }

  async getByName(displayName: string): Promise<DataEntry | undefined> {
    return this.store.getByDisplayName(canonicalizeDisplayName(displayName));
  }

  async list(kind?: DataKind): Promise<DataEntry[]> {
    return this.store.listAll(kind);
  }

  async query(q: DataQuery): Promise<DataQueryResult> {
    const start = performance.now();
    let entries = this.store.listAll(q.kind);

    if (q.text) {
      const lower = q.text.toLowerCase();
      entries = entries.filter(
        (e) => e.displayName.toLowerCase().includes(lower) || e.description.toLowerCase().includes(lower)
      );
    }

    if (q.scope && q.scope.length > 0) {
      const scopeKeys = new Set(q.scope.map((ce) => `${ce.kind}:${ce.id}`));
      entries = entries.filter((e) =>
        e.contextEntries.some((ce) => scopeKeys.has(`${ce.kind}:${ce.id}`))
      );
    }

    const durationMs = Math.round(performance.now() - start);
    this.logger.debug("data.query", {
      kind: q.kind,
      hasText: Boolean(q.text),
      hasScopeFilter: Boolean(q.scope?.length),
      resultCount: entries.length,
      durationMs
    });
    return { entries, totalCount: entries.length };
  }

  async declare(req: DeclareEntryRequest): Promise<DataEntry> {
    const start = performance.now();

    const displayName = validateDisplayName(req.displayName, this.config.maxDisplayNameBytes);

    const existing = this.store.getByDisplayName(displayName);
    if (existing) throw new DataEntryConflictError(displayName);

    const all = this.store.listAll();
    if (all.length >= this.config.maxEntries) {
      throw new Error(`maxEntries (${this.config.maxEntries}) reached`);
    }

    const now = new Date().toISOString();
    let entry: DataEntry;

    if (req.kind === "variable" || req.kind === "function") {
      const body = validateFormulaBody(req.body, this.config.maxBodyBytes);
      entry = {
        id: randomUUID(),
        kind: req.kind,
        displayName,
        description: req.description ?? "",
        contextEntries: [],
        body,
        revision: 1,
        createdAt: now,
        updatedAt: now
      } satisfies FormulaEntry;
    } else {
      const collReq = req as DeclareCollectionEntryRequest;
      const schema = validateCollectionSchema(
        collReq.kind,
        collReq.schema,
        this.config.maxFieldsPerCollection
      );
      const rows = validateCollectionRows(
        collReq.kind,
        schema,
        collReq.rows ?? [],
        this.config.maxRowsPerCollection,
        this.config.maxBodyBytes
      );
      entry = {
        id: randomUUID(),
        kind: collReq.kind,
        displayName,
        description: collReq.description ?? "",
        contextEntries: [],
        schema,
        rows,
        rowCount: rows.length,
        revision: 1,
        createdAt: now,
        updatedAt: now
      } satisfies CollectionEntry;
    }

    this.store.insert(entry);
    const durationMs = Math.round(performance.now() - start);
    this.logger.info("data.declare", { id: entry.id, kind: entry.kind, displayName: entry.displayName, durationMs });
    return entry;
  }

  async rename(req: RenameEntryRequest): Promise<DataEntry> {
    const start = performance.now();
    const entry = this.store.getEntry(req.id);
    if (!entry) throw new DataEntryNotFoundError(req.id);
    if (entry.revision !== req.expectedRevision) {
      throw new StaleDataRevisionError(req.id, entry.revision, req.expectedRevision);
    }
    const newDisplayName = validateDisplayName(
      req.newDisplayName,
      this.config.maxDisplayNameBytes
    );
    if (normalizeDisplayNameKey(entry.displayName) !== normalizeDisplayNameKey(newDisplayName)) {
      const conflict = this.store.getByDisplayName(newDisplayName);
      if (conflict) throw new DataEntryConflictError(newDisplayName);
    }
    const now = new Date().toISOString();
    const updated: DataEntry = { ...entry, displayName: newDisplayName, revision: entry.revision + 1, updatedAt: now };
    this.persistUpdate(updated, req.expectedRevision);
    const durationMs = Math.round(performance.now() - start);
    this.logger.info("data.rename", { id: req.id, newDisplayName, revision: updated.revision, durationMs });
    return updated;
  }

  async updateDescription(req: UpdateDescriptionRequest): Promise<DataEntry> {
    const start = performance.now();
    const entry = this.store.getEntry(req.id);
    if (!entry) throw new DataEntryNotFoundError(req.id);
    if (entry.revision !== req.expectedRevision) {
      throw new StaleDataRevisionError(req.id, entry.revision, req.expectedRevision);
    }
    const now = new Date().toISOString();
    const updated: DataEntry = { ...entry, description: req.description, revision: entry.revision + 1, updatedAt: now };
    this.persistUpdate(updated, req.expectedRevision);
    const durationMs = Math.round(performance.now() - start);
    this.logger.info("data.update.desc", { id: req.id, revision: updated.revision, durationMs });
    return updated;
  }

  async delete(req: DeleteEntryRequest): Promise<void> {
    const start = performance.now();
    const entry = this.store.getEntry(req.id);
    if (!entry) throw new DataEntryNotFoundError(req.id);
    if (entry.revision !== req.expectedRevision) {
      throw new StaleDataRevisionError(req.id, entry.revision, req.expectedRevision);
    }
    const now = new Date().toISOString();
    const deletedRevision = this.store.delete(req.id, req.expectedRevision, now);
    if (deletedRevision === undefined) {
      const current = this.store.getEntry(req.id);
      if (!current) throw new DataEntryNotFoundError(req.id);
      throw new StaleDataRevisionError(req.id, current.revision, req.expectedRevision);
    }
    const durationMs = Math.round(performance.now() - start);
    this.logger.info("data.delete", { id: req.id, revision: deletedRevision, durationMs });
  }

  async purge(id: string): Promise<void> {
    const outcome = this.store.purge(id);
    if (outcome === "current") throw new ResourceNotDeletedError("structured-data", id);
    if (outcome === "missing") throw new ResourceHistoryNotFoundError("structured-data", id);
    this.logger.info("data.purge", { id });
  }

  pruneHistory(cutoff: string): number {
    return this.store.pruneHistory(cutoff);
  }

  purgeExpired(cutoff: string): number {
    return this.store.purgeExpired(cutoff);
  }

  async updateBody(req: UpdateBodyRequest): Promise<DataEntry> {
    const start = performance.now();
    const entry = this.store.getEntry(req.id);
    if (!entry) throw new DataEntryNotFoundError(req.id);
    if (entry.kind !== "variable" && entry.kind !== "function") {
      throw new Error(`updateBody requires a variable or function entry, got: ${entry.kind}`);
    }
    if (entry.revision !== req.expectedRevision) {
      throw new StaleDataRevisionError(req.id, entry.revision, req.expectedRevision);
    }
    const body = validateFormulaBody(req.body, this.config.maxBodyBytes);
    const now = new Date().toISOString();
    const updated: FormulaEntry = { ...entry as FormulaEntry, body, revision: entry.revision + 1, updatedAt: now };
    this.persistUpdate(updated, req.expectedRevision);
    const durationMs = Math.round(performance.now() - start);
    this.logger.info("data.update.body", { id: req.id, revision: updated.revision, durationMs });
    return updated;
  }

  async replaceSchema(req: ReplaceSchemaRequest): Promise<CollectionEntry> {
    const start = performance.now();
    const entry = this.store.getEntry(req.id);
    if (!entry) throw new DataEntryNotFoundError(req.id);
    if (entry.kind !== "table" && entry.kind !== "record" && entry.kind !== "list") {
      throw new Error(`replaceSchema requires a collection entry, got: ${entry.kind}`);
    }
    if (entry.revision !== req.expectedRevision) {
      throw new StaleDataRevisionError(req.id, entry.revision, req.expectedRevision);
    }
    const schema = validateCollectionSchema(
      entry.kind,
      req.schema,
      this.config.maxFieldsPerCollection
    );
    const rows = validateCollectionRows(
      entry.kind,
      schema,
      entry.rows,
      this.config.maxRowsPerCollection,
      this.config.maxBodyBytes
    );
    const now = new Date().toISOString();
    const updated: CollectionEntry = {
      ...entry as CollectionEntry,
      schema,
      rows,
      rowCount: rows.length,
      revision: entry.revision + 1,
      updatedAt: now
    };
    this.persistUpdate(updated, req.expectedRevision);
    const durationMs = Math.round(performance.now() - start);
    this.logger.info("data.schema.replace", { id: req.id, fieldCount: schema.length, revision: updated.revision, durationMs });
    return updated;
  }

  async appendRows(req: AppendRowsRequest): Promise<CollectionEntry> {
    const start = performance.now();
    const entry = this.store.getEntry(req.id);
    if (!entry) throw new DataEntryNotFoundError(req.id);
    if (entry.kind !== "table" && entry.kind !== "record" && entry.kind !== "list") {
      throw new Error(`appendRows requires a collection entry, got: ${entry.kind}`);
    }
    if (entry.revision !== req.expectedRevision) {
      throw new StaleDataRevisionError(req.id, entry.revision, req.expectedRevision);
    }
    const coll = entry as CollectionEntry;
    const appendedRows = validateAppendRows(
      coll,
      req.rows,
      this.config.maxRowsPerCollection,
      this.config.maxBodyBytes
    );
    const newRows = [...coll.rows, ...appendedRows];
    const now = new Date().toISOString();
    const updated: CollectionEntry = { ...coll, rows: newRows, rowCount: newRows.length, revision: entry.revision + 1, updatedAt: now };
    this.persistUpdate(updated, req.expectedRevision);
    const durationMs = Math.round(performance.now() - start);
    this.logger.info("data.rows.append", { id: req.id, rowsAdded: appendedRows.length, rowCount: updated.rowCount, durationMs });
    return updated;
  }

  async deleteRows(req: DeleteRowsRequest): Promise<CollectionEntry> {
    const start = performance.now();
    const entry = this.store.getEntry(req.id);
    if (!entry) throw new DataEntryNotFoundError(req.id);
    if (entry.kind !== "table" && entry.kind !== "record" && entry.kind !== "list") {
      throw new Error(`deleteRows requires a collection entry, got: ${entry.kind}`);
    }
    if (entry.revision !== req.expectedRevision) {
      throw new StaleDataRevisionError(req.id, entry.revision, req.expectedRevision);
    }
    const coll = entry as CollectionEntry;
    const indices = validateDeleteIndices(coll, req.indices);
    const toRemove = new Set(indices);
    const newRows = coll.rows.filter((_, i) => !toRemove.has(i));
    const now = new Date().toISOString();
    const updated: CollectionEntry = { ...coll, rows: newRows, rowCount: newRows.length, revision: entry.revision + 1, updatedAt: now };
    this.persistUpdate(updated, req.expectedRevision);
    const durationMs = Math.round(performance.now() - start);
    this.logger.info("data.rows.delete", { id: req.id, removed: indices.length, rowCount: updated.rowCount, durationMs });
    return updated;
  }
}

export function createStructuredData(
  store: DataStore,
  config: StructuredDataConfig,
  logger: Logger
): StructuredData {
  return new StructuredDataImpl(store, config, logger);
}
