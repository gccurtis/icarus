// SQLite implementation of NameManagerStore.
// Uses the same 16-hex-char prefix scheme as SQLiteKnowledgeStore.

import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database, { type Database as DB } from "better-sqlite3";
import type { NameEntry, NameKind } from "./types.js";
import type { NameManagerStore } from "./store.js";

/** 16-hex-char prefix derived from SHA-256(projectId). */
const tablePrefix = (projectId: string): string =>
  createHash("sha256").update(projectId).digest("hex").slice(0, 16);

function createSchema(db: DB, prefix: string): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS nm_${prefix}_names (
      id           TEXT PRIMARY KEY,
      kind         TEXT NOT NULL,
      scope_id     TEXT NOT NULL,
      display_name TEXT NOT NULL,
      body         TEXT NOT NULL,
      revision     INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL,
      deleted_at   TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS nm_${prefix}_names_live_unique
      ON nm_${prefix}_names(scope_id, display_name)
      WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS nm_${prefix}_names_scope
      ON nm_${prefix}_names(scope_id);
  `);
}

function rowToEntry(row: Record<string, unknown>): NameEntry {
  return {
    id: row.id as string,
    kind: row.kind as NameKind,
    scopeId: row.scope_id as string,
    displayName: row.display_name as string,
    body: row.body as string,
    revision: row.revision as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    deletedAt: row.deleted_at as string | undefined
  };
}

export class SQLiteNameManagerStore implements NameManagerStore {
  private readonly db: DB;
  private readonly prefix: string;

  constructor(projectId: string, dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.prefix = tablePrefix(projectId);
    createSchema(this.db, this.prefix);
  }

  getEntry(id: string): NameEntry | undefined {
    const row = this.db
      .prepare(`SELECT * FROM nm_${this.prefix}_names WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    return row ? rowToEntry(row) : undefined;
  }

  getByDisplayName(scopeId: string, displayName: string): NameEntry[] {
    const rows = this.db
      .prepare(`SELECT * FROM nm_${this.prefix}_names WHERE scope_id = ? AND display_name = ? AND deleted_at IS NULL`)
      .all(scopeId, displayName) as Record<string, unknown>[];
    return rows.map(rowToEntry);
  }

  listScope(scopeId: string, kind?: NameKind): NameEntry[] {
    if (kind) {
      const rows = this.db
        .prepare(`SELECT * FROM nm_${this.prefix}_names WHERE scope_id = ? AND kind = ? AND deleted_at IS NULL ORDER BY display_name`)
        .all(scopeId, kind) as Record<string, unknown>[];
      return rows.map(rowToEntry);
    }
    const rows = this.db
      .prepare(`SELECT * FROM nm_${this.prefix}_names WHERE scope_id = ? AND deleted_at IS NULL ORDER BY display_name`)
      .all(scopeId) as Record<string, unknown>[];
    return rows.map(rowToEntry);
  }

  insert(entry: NameEntry): void {
    this.db
      .prepare(`
        INSERT INTO nm_${this.prefix}_names
          (id, kind, scope_id, display_name, body, revision, created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        entry.id, entry.kind, entry.scopeId, entry.displayName, entry.body,
        entry.revision, entry.createdAt, entry.updatedAt, entry.deletedAt ?? null
      );
  }

  update(entry: NameEntry): void {
    this.db
      .prepare(`
        UPDATE nm_${this.prefix}_names
        SET kind = ?, display_name = ?, body = ?, revision = ?, updated_at = ?, deleted_at = ?
        WHERE id = ?
      `)
      .run(
        entry.kind, entry.displayName, entry.body, entry.revision,
        entry.updatedAt, entry.deletedAt ?? null, entry.id
      );
  }

  softDelete(id: string, deletedAt: string): void {
    this.db
      .prepare(`UPDATE nm_${this.prefix}_names SET deleted_at = ?, updated_at = ? WHERE id = ?`)
      .run(deletedAt, deletedAt, id);
  }
}
