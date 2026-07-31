// SQLite implementation of ContextStore.
// Two tables per database: ctx_user_${userPrefix}_contexts and ctx_proj_${projectPrefix}_contexts.
// Prefix = SHA-256(id).slice(0,16).

import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database, { type Database as DB } from "better-sqlite3";
import type { ContextEntry, ContextRecord, ContextStoreScope } from "./types.js";
import type { ContextStore } from "./store.js";

const tablePrefix = (id: string): string =>
  createHash("sha256").update(id).digest("hex").slice(0, 16);

function createSchema(db: DB, userP: string, projP: string): void {
  for (const p of [`ctx_user_${userP}`, `ctx_proj_${projP}`]) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${p}_contexts (
        id           TEXT    PRIMARY KEY,
        display_name TEXT    NOT NULL,
        entries_json TEXT    NOT NULL,
        revision     INTEGER NOT NULL DEFAULT 1,
        created_at   TEXT    NOT NULL,
        updated_at   TEXT    NOT NULL,
        deleted_at   TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS ${p}_contexts_name
        ON ${p}_contexts(display_name)
        WHERE deleted_at IS NULL;
    `);
  }
}

function rowToRecord(row: Record<string, unknown>): ContextRecord {
  return {
    id: row.id as string,
    displayName: row.display_name as string,
    entries: JSON.parse(row.entries_json as string) as ContextEntry[],
    revision: row.revision as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    deletedAt: (row.deleted_at as string | null) ?? undefined
  };
}

export class SQLiteContextStore implements ContextStore {
  private readonly db: DB;
  private readonly userP: string;
  private readonly projP: string;

  constructor(userId: string, projectId: string, dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.userP = tablePrefix(userId);
    this.projP = tablePrefix(projectId);
    createSchema(this.db, this.userP, this.projP);
  }

  private tbl(scope: ContextStoreScope): string {
    return scope === "user"
      ? `ctx_user_${this.userP}_contexts`
      : `ctx_proj_${this.projP}_contexts`;
  }

  get(id: string, scope: ContextStoreScope): ContextRecord | undefined {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tbl(scope)} WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    return row ? rowToRecord(row) : undefined;
  }

  getByName(displayName: string, scope: ContextStoreScope): ContextRecord | undefined {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tbl(scope)} WHERE display_name = ? AND deleted_at IS NULL`)
      .get(displayName) as Record<string, unknown> | undefined;
    return row ? rowToRecord(row) : undefined;
  }

  list(scope: ContextStoreScope, includeAnonymous: boolean): ContextRecord[] {
    const tbl = this.tbl(scope);
    const sql = includeAnonymous
      ? `SELECT * FROM ${tbl} WHERE deleted_at IS NULL ORDER BY display_name`
      : `SELECT * FROM ${tbl} WHERE deleted_at IS NULL AND display_name NOT LIKE '~%' ORDER BY display_name`;
    const rows = this.db.prepare(sql).all() as Record<string, unknown>[];
    return rows.map(rowToRecord);
  }

  insert(record: ContextRecord, scope: ContextStoreScope): void {
    const tbl = this.tbl(scope);
    this.db.prepare(`
      INSERT INTO ${tbl} (id, display_name, entries_json, revision, created_at, updated_at, deleted_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.displayName,
      JSON.stringify(record.entries),
      record.revision,
      record.createdAt,
      record.updatedAt,
      record.deletedAt ?? null
    );
  }

  update(record: ContextRecord, scope: ContextStoreScope): void {
    const tbl = this.tbl(scope);
    this.db.prepare(`
      UPDATE ${tbl}
      SET display_name = ?, entries_json = ?, revision = ?, updated_at = ?, deleted_at = ?
      WHERE id = ?
    `).run(
      record.displayName,
      JSON.stringify(record.entries),
      record.revision,
      record.updatedAt,
      record.deletedAt ?? null,
      record.id
    );
  }

  softDelete(id: string, scope: ContextStoreScope, deletedAt: string): void {
    this.db
      .prepare(`UPDATE ${this.tbl(scope)} SET deleted_at = ? WHERE id = ?`)
      .run(deletedAt, id);
  }
}
