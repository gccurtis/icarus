// SQLite implementation of DataStore.
// Two store instances are used per backend: one for user scope, one for project scope.
// Table prefix is derived from SHA-256(ownerId).slice(0, 16).

import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database, { type Database as DB } from "better-sqlite3";
import type { DataEntry, DataKind, FormulaEntry, CollectionEntry, FieldDef, DataRow, CellValue } from "./types.js";
import type { DataStore } from "./store.js";

const tablePrefix = (ownerId: string): string =>
  createHash("sha256").update(ownerId).digest("hex").slice(0, 16);

function createSchema(db: DB, prefix: string): void {
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
      updated_at      TEXT    NOT NULL,
      deleted_at      TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS sd_${prefix}_entries_name_live
      ON sd_${prefix}_entries(display_name)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS sd_${prefix}_entries_kind
      ON sd_${prefix}_entries(kind);
  `);
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
    updatedAt: row.updated_at as string,
    deletedAt: (row.deleted_at as string | null) ?? undefined
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

  constructor(ownerId: string, dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.prefix = tablePrefix(ownerId);
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
      .prepare(`SELECT * FROM sd_${this.prefix}_entries WHERE display_name = ? AND deleted_at IS NULL`)
      .get(displayName) as Record<string, unknown> | undefined;
    return row ? rowToEntry(row) : undefined;
  }

  listAll(kind?: DataKind): DataEntry[] {
    if (kind) {
      const rows = this.db
        .prepare(`SELECT * FROM sd_${this.prefix}_entries WHERE kind = ? AND deleted_at IS NULL ORDER BY display_name`)
        .all(kind) as Record<string, unknown>[];
      return rows.map(rowToEntry);
    }
    const rows = this.db
      .prepare(`SELECT * FROM sd_${this.prefix}_entries WHERE deleted_at IS NULL ORDER BY display_name`)
      .all() as Record<string, unknown>[];
    return rows.map(rowToEntry);
  }

  insert(entry: DataEntry): void {
    const isCollection = entry.kind === "table" || entry.kind === "record" || entry.kind === "list";
    this.db
      .prepare(`
        INSERT INTO sd_${this.prefix}_entries
          (id, kind, display_name, description, context_entries, body, schema_json, rows_json, row_count, revision, created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        entry.updatedAt,
        entry.deletedAt ?? null
      );
  }

  update(entry: DataEntry): void {
    const isCollection = entry.kind === "table" || entry.kind === "record" || entry.kind === "list";
    this.db
      .prepare(`
        UPDATE sd_${this.prefix}_entries
        SET kind = ?, display_name = ?, description = ?, context_entries = ?,
            body = ?, schema_json = ?, rows_json = ?, row_count = ?,
            revision = ?, updated_at = ?, deleted_at = ?
        WHERE id = ?
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
        entry.deletedAt ?? null,
        entry.id
      );
  }

  softDelete(id: string, deletedAt: string): void {
    this.db
      .prepare(`UPDATE sd_${this.prefix}_entries SET deleted_at = ?, updated_at = ? WHERE id = ?`)
      .run(deletedAt, deletedAt, id);
  }
}
