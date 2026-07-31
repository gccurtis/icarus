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
  delete(id: string): Promise<void>;
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

  async bindingView(): Promise<DataBindingView> {
    const start = performance.now();
    const all = this.store.listAll();
    const map = new Map<string, DataEntry>();
    let maxRevision = 0;
    for (const entry of all) {
      map.set(entry.displayName, entry);
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
    return this.store.getByDisplayName(displayName);
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

    const nameBytes = Buffer.byteLength(req.displayName, "utf8");
    if (nameBytes > this.config.maxDisplayNameBytes) {
      throw new Error(`displayName exceeds maxDisplayNameBytes (${this.config.maxDisplayNameBytes})`);
    }

    const existing = this.store.getByDisplayName(req.displayName);
    if (existing) throw new DataEntryConflictError(req.displayName);

    const all = this.store.listAll();
    if (all.length >= this.config.maxEntries) {
      throw new Error(`maxEntries (${this.config.maxEntries}) reached`);
    }

    const now = new Date().toISOString();
    let entry: DataEntry;

    if (req.kind === "variable" || req.kind === "function") {
      const bodyBytes = Buffer.byteLength(req.body, "utf8");
      if (bodyBytes > this.config.maxBodyBytes) {
        throw new Error(`body exceeds maxBodyBytes (${this.config.maxBodyBytes})`);
      }
      entry = {
        id: randomUUID(),
        kind: req.kind,
        displayName: req.displayName,
        description: req.description ?? "",
        contextEntries: [],
        body: req.body,
        revision: 1,
        createdAt: now,
        updatedAt: now
      } satisfies FormulaEntry;
    } else {
      const collReq = req as DeclareCollectionEntryRequest;
      if (collReq.schema.length > this.config.maxFieldsPerCollection) {
        throw new Error(`schema exceeds maxFieldsPerCollection (${this.config.maxFieldsPerCollection})`);
      }
      const rows = collReq.rows ?? [];
      if (rows.length > this.config.maxRowsPerCollection) {
        throw new Error(`rows exceed maxRowsPerCollection (${this.config.maxRowsPerCollection})`);
      }
      entry = {
        id: randomUUID(),
        kind: collReq.kind,
        displayName: collReq.displayName,
        description: collReq.description ?? "",
        contextEntries: [],
        schema: collReq.schema,
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
    if (entry.displayName !== req.newDisplayName) {
      const conflict = this.store.getByDisplayName(req.newDisplayName);
      if (conflict) throw new DataEntryConflictError(req.newDisplayName);
    }
    const nameBytes = Buffer.byteLength(req.newDisplayName, "utf8");
    if (nameBytes > this.config.maxDisplayNameBytes) {
      throw new Error(`displayName exceeds maxDisplayNameBytes (${this.config.maxDisplayNameBytes})`);
    }
    const now = new Date().toISOString();
    const updated: DataEntry = { ...entry, displayName: req.newDisplayName, revision: entry.revision + 1, updatedAt: now };
    this.store.update(updated);
    const durationMs = Math.round(performance.now() - start);
    this.logger.info("data.rename", { id: req.id, newDisplayName: req.newDisplayName, revision: updated.revision, durationMs });
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
    this.store.update(updated);
    const durationMs = Math.round(performance.now() - start);
    this.logger.info("data.update.desc", { id: req.id, revision: updated.revision, durationMs });
    return updated;
  }

  async delete(id: string): Promise<void> {
    const start = performance.now();
    const entry = this.store.getEntry(id);
    if (!entry) throw new DataEntryNotFoundError(id);
    const now = new Date().toISOString();
    this.store.softDelete(id, now);
    const durationMs = Math.round(performance.now() - start);
    this.logger.info("data.delete", { id, durationMs });
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
    const bodyBytes = Buffer.byteLength(req.body, "utf8");
    if (bodyBytes > this.config.maxBodyBytes) {
      throw new Error(`body exceeds maxBodyBytes (${this.config.maxBodyBytes})`);
    }
    const now = new Date().toISOString();
    const updated: FormulaEntry = { ...entry as FormulaEntry, body: req.body, revision: entry.revision + 1, updatedAt: now };
    this.store.update(updated);
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
    if (req.schema.length > this.config.maxFieldsPerCollection) {
      throw new Error(`schema exceeds maxFieldsPerCollection (${this.config.maxFieldsPerCollection})`);
    }
    const now = new Date().toISOString();
    const updated: CollectionEntry = { ...entry as CollectionEntry, schema: req.schema, revision: entry.revision + 1, updatedAt: now };
    this.store.update(updated);
    const durationMs = Math.round(performance.now() - start);
    this.logger.info("data.schema.replace", { id: req.id, fieldCount: req.schema.length, revision: updated.revision, durationMs });
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
    const newRows = [...coll.rows, ...req.rows];
    if (newRows.length > this.config.maxRowsPerCollection) {
      throw new Error(`rows would exceed maxRowsPerCollection (${this.config.maxRowsPerCollection})`);
    }
    const now = new Date().toISOString();
    const updated: CollectionEntry = { ...coll, rows: newRows, rowCount: newRows.length, revision: entry.revision + 1, updatedAt: now };
    this.store.update(updated);
    const durationMs = Math.round(performance.now() - start);
    this.logger.info("data.rows.append", { id: req.id, rowsAdded: req.rows.length, rowCount: updated.rowCount, durationMs });
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
    const toRemove = new Set(req.indices);
    const newRows = coll.rows.filter((_, i) => !toRemove.has(i));
    const now = new Date().toISOString();
    const updated: CollectionEntry = { ...coll, rows: newRows, rowCount: newRows.length, revision: entry.revision + 1, updatedAt: now };
    this.store.update(updated);
    const durationMs = Math.round(performance.now() - start);
    this.logger.info("data.rows.delete", { id: req.id, removed: req.indices.length, rowCount: updated.rowCount, durationMs });
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
