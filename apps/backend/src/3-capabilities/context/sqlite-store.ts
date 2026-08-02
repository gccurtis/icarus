// SQLite implementation of ContextStore.
// One table per database, scoped by project: ctx_${projectPrefix}_contexts.
// Prefix = SHA-256(projectId).slice(0,16).

import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database, { type Database as DB } from "better-sqlite3";
import type { ContextEntry, ContextRecord } from "./types.js";
import type { ContextStore } from "./store.js";

const tablePrefix = (id: string): string =>
  createHash("sha256").update(id).digest("hex").slice(0, 16);

function createSchema(db: DB, prefix: string): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ctx_${prefix}_contexts (
      id           TEXT    PRIMARY KEY,
      display_name TEXT    NOT NULL,
      description  TEXT,
      entries_json TEXT    NOT NULL,
      private      INTEGER NOT NULL DEFAULT 0,
      revision     INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT    NOT NULL,
      updated_at   TEXT    NOT NULL,
      deleted_at   TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ctx_${prefix}_contexts_name
      ON ctx_${prefix}_contexts(display_name)
      WHERE deleted_at IS NULL;
  `);
}

function rowToRecord(row: Record<string, unknown>): ContextRecord {
  return {
    id: row.id as string,
    displayName: row.display_name as string,
    description: (row.description as string | null) ?? undefined,
    entries: JSON.parse(row.entries_json as string) as ContextEntry[],
    private: (row.private as number) === 1,
    revision: row.revision as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    deletedAt: (row.deleted_at as string | null) ?? undefined
  };
}

export class SQLiteContextStore implements ContextStore {
  private readonly db: DB;
  private readonly tableName: string;

  constructor(projectId: string, dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    const prefix = tablePrefix(projectId);
    this.tableName = `ctx_${prefix}_contexts`;
    createSchema(this.db, prefix);
  }

  get(id: string): ContextRecord | undefined {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    return row ? rowToRecord(row) : undefined;
  }

  getByName(displayName: string): ContextRecord | undefined {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tableName} WHERE display_name = ? AND deleted_at IS NULL`)
      .get(displayName) as Record<string, unknown> | undefined;
    return row ? rowToRecord(row) : undefined;
  }

  list(includePrivate: boolean): ContextRecord[] {
    const sql = includePrivate
      ? `SELECT * FROM ${this.tableName} WHERE deleted_at IS NULL ORDER BY display_name`
      : `SELECT * FROM ${this.tableName} WHERE deleted_at IS NULL AND private = 0 ORDER BY display_name`;
    const rows = this.db.prepare(sql).all() as Record<string, unknown>[];
    return rows.map(rowToRecord);
  }

  insert(record: ContextRecord): void {
    this.db.prepare(`
      INSERT INTO ${this.tableName} (id, display_name, description, entries_json, private, revision, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.displayName,
      record.description ?? null,
      JSON.stringify(record.entries),
      record.private ? 1 : 0,
      record.revision,
      record.createdAt,
      record.updatedAt,
      record.deletedAt ?? null
    );
  }

  update(record: ContextRecord): void {
    this.db.prepare(`
      UPDATE ${this.tableName}
      SET display_name = ?, description = ?, entries_json = ?, private = ?, revision = ?, updated_at = ?, deleted_at = ?
      WHERE id = ?
    `).run(
      record.displayName,
      record.description ?? null,
      JSON.stringify(record.entries),
      record.private ? 1 : 0,
      record.revision,
      record.updatedAt,
      record.deletedAt ?? null,
      record.id
    );
  }

  softDelete(id: string, deletedAt: string): void {
    this.db
      .prepare(`UPDATE ${this.tableName} SET deleted_at = ? WHERE id = ?`)
      .run(deletedAt, id);
  }
}
