// SQLite implementation of DataStore.
// Two store instances are used per backend: one for user scope, one for project scope.
// Table prefix is derived from SHA-256(ownerId).slice(0, 16).

import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database, { type Database as DB } from "better-sqlite3";
import {
  getResourceHistory,
  initializeResourceHistorySchema,
  insertHistoryDeletion,
  insertHistorySnapshot,
  listExpiredDeletedResources,
  pruneHistoryBefore,
  purgeResourceHistory,
  type ResourceHistoryRecord
} from "#utils/persistence/resourceHistory.js";
import type { DataEntry, DataKind, FormulaEntry, CollectionEntry, FieldDef, DataRow, CellValue } from "./types.js";
import type { DataStore } from "./store.js";

const tablePrefix = (ownerId: string): string =>
  createHash("sha256").update(ownerId).digest("hex").slice(0, 16);

function createSchema(db: DB, prefix: string): void {
  const historyTable = `sd_${prefix}_history`;
  db.exec(`
    CREATE TABLE IF NOT EXISTS sd_${prefix}_entries (
      id              TEXT    PRIMARY KEY,
      kind            TEXT    NOT NULL,
      display_name    TEXT    NOT NULL,
      description     TEXT    NOT NULL DEFAULT '',
      context_entries TEXT    NOT NULL DEFAULT '[]',
      body            TEXT,
      schema_json     TEXT,
      rows_json       TEXT,
      row_count       INTEGER NOT NULL DEFAULT 0,
      revision        INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT    NOT NULL,
      updated_at      TEXT    NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS sd_${prefix}_entries_name_live_nocase
      ON sd_${prefix}_entries(display_name COLLATE NOCASE);

    CREATE INDEX IF NOT EXISTS sd_${prefix}_entries_kind
      ON sd_${prefix}_entries(kind);
  `);
  initializeResourceHistorySchema(db, historyTable);
}

function rowToEntry(row: Record<string, unknown>): DataEntry {
  const kind = row.kind as DataKind;
  const base = {
    id: row.id as string,
    kind,
    displayName: row.display_name as string,
    description: row.description as string,
    contextEntries: JSON.parse(row.context_entries as string) as ReturnType<typeof JSON.parse>,
    revision: row.revision as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  };

  if (kind === "variable" || kind === "function") {
    return { ...base, kind, body: row.body as string } satisfies FormulaEntry;
  }

  return {
    ...base,
    kind: kind as "table" | "record" | "list",
    schema: JSON.parse(row.schema_json as string) as FieldDef[],
    rows: JSON.parse(row.rows_json as string) as DataRow[],
    rowCount: row.row_count as number
  } satisfies CollectionEntry;
}

export class SQLiteDataStore implements DataStore {
  private readonly db: DB;
  private readonly prefix: string;
  private readonly historyTableName: string;

  constructor(ownerId: string, dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.prefix = tablePrefix(ownerId);
    this.historyTableName = `sd_${this.prefix}_history`;
    createSchema(this.db, this.prefix);
  }

  getEntry(id: string): DataEntry | undefined {
    const row = this.db
      .prepare(`SELECT * FROM sd_${this.prefix}_entries WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    return row ? rowToEntry(row) : undefined;
  }

  getByDisplayName(displayName: string): DataEntry | undefined {
    const row = this.db
      .prepare(`SELECT * FROM sd_${this.prefix}_entries WHERE display_name = ? COLLATE NOCASE`)
      .get(displayName) as Record<string, unknown> | undefined;
    return row ? rowToEntry(row) : undefined;
  }

  listAll(kind?: DataKind): DataEntry[] {
    if (kind) {
      const rows = this.db
        .prepare(`SELECT * FROM sd_${this.prefix}_entries WHERE kind = ? ORDER BY display_name COLLATE NOCASE, id`)
        .all(kind) as Record<string, unknown>[];
      return rows.map(rowToEntry);
    }
    const rows = this.db
      .prepare(`SELECT * FROM sd_${this.prefix}_entries ORDER BY display_name COLLATE NOCASE, id`)
      .all() as Record<string, unknown>[];
    return rows.map(rowToEntry);
  }

  insert(entry: DataEntry): void {
    const isCollection = entry.kind === "table" || entry.kind === "record" || entry.kind === "list";
    this.db
      .prepare(`
        INSERT INTO sd_${this.prefix}_entries
          (id, kind, display_name, description, context_entries, body, schema_json, rows_json, row_count, revision, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        entry.id,
        entry.kind,
        entry.displayName,
        entry.description,
        JSON.stringify(entry.contextEntries),
        isCollection ? null : (entry as FormulaEntry).body,
        isCollection ? JSON.stringify((entry as CollectionEntry).schema) : null,
        isCollection ? JSON.stringify((entry as CollectionEntry).rows) : null,
        isCollection ? (entry as CollectionEntry).rowCount : 0,
        entry.revision,
        entry.createdAt,
        entry.updatedAt
      );
  }

  update(entry: DataEntry, expectedRevision: number): boolean {
    const isCollection = entry.kind === "table" || entry.kind === "record" || entry.kind === "list";
    return this.db.transaction(() => {
      const row = this.db.prepare(`
        SELECT * FROM sd_${this.prefix}_entries WHERE id = ? AND revision = ?
      `).get(entry.id, expectedRevision) as Record<string, unknown> | undefined;
      if (!row) return false;
      insertHistorySnapshot(this.db, this.historyTableName, {
        resourceKind: "structured-data",
        resourceId: entry.id,
        revision: expectedRevision,
        snapshot: rowToEntry(row),
        recordedAt: entry.updatedAt
      });
      const result = this.db.prepare(`
        UPDATE sd_${this.prefix}_entries
        SET kind = ?, display_name = ?, description = ?, context_entries = ?,
            body = ?, schema_json = ?, rows_json = ?, row_count = ?,
            revision = ?, updated_at = ?
        WHERE id = ? AND revision = ?
      `)
      .run(
        entry.kind,
        entry.displayName,
        entry.description,
        JSON.stringify(entry.contextEntries),
        isCollection ? null : (entry as FormulaEntry).body,
        isCollection ? JSON.stringify((entry as CollectionEntry).schema) : null,
        isCollection ? JSON.stringify((entry as CollectionEntry).rows) : null,
        isCollection ? (entry as CollectionEntry).rowCount : 0,
        entry.revision,
        entry.updatedAt,
        entry.id,
        expectedRevision
      );
      return result.changes === 1;
    })();
  }

  delete(id: string, expectedRevision: number, deletedAt: string): number | undefined {
    return this.db.transaction(() => {
      const row = this.db.prepare(`
        SELECT * FROM sd_${this.prefix}_entries WHERE id = ? AND revision = ?
      `).get(id, expectedRevision) as Record<string, unknown> | undefined;
      if (!row) return undefined;
      const current = rowToEntry(row);
      insertHistorySnapshot(this.db, this.historyTableName, {
        resourceKind: "structured-data",
        resourceId: id,
        revision: current.revision,
        snapshot: current,
        recordedAt: deletedAt
      });
      const deletedRevision = current.revision + 1;
      insertHistoryDeletion(this.db, this.historyTableName, {
        resourceKind: "structured-data",
        resourceId: id,
        revision: deletedRevision,
        recordedAt: deletedAt
      });
      this.db.prepare(`DELETE FROM sd_${this.prefix}_entries WHERE id = ? AND revision = ?`)
        .run(id, expectedRevision);
      return deletedRevision;
    })();
  }

  purge(id: string): "purged" | "current" | "missing" {
    if (this.getEntry(id)) return "current";
    return purgeResourceHistory(
      this.db,
      this.historyTableName,
      "structured-data",
      id
    ) ? "purged" : "missing";
  }

  history(id: string): ResourceHistoryRecord<DataEntry>[] {
    return getResourceHistory<DataEntry>(
      this.db,
      this.historyTableName,
      "structured-data",
      id
    );
  }

  pruneHistory(cutoff: string): number {
    return pruneHistoryBefore(
      this.db,
      this.historyTableName,
      cutoff,
      (_kind, id) => Boolean(this.getEntry(id))
    );
  }

  purgeExpired(cutoff: string): number {
    let purged = 0;
    for (const resource of listExpiredDeletedResources(this.db, this.historyTableName, cutoff)) {
      if (!this.getEntry(resource.resourceId) && this.purge(resource.resourceId) === "purged") {
        purged += 1;
      }
    }
    return purged;
  }
}
