// SQLite implementation of ContextStore.
// One table per database, scoped by project: ctx_${projectPrefix}_contexts.
// Prefix = SHA-256(projectId).slice(0,16).

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
import type { ContextEntry, ContextRecord } from "./types.js";
import type { ContextStore } from "./store.js";

const tablePrefix = (id: string): string =>
  createHash("sha256").update(id).digest("hex").slice(0, 16);

function createSchema(db: DB, prefix: string): void {
  const historyTable = `ctx_${prefix}_history`;
  db.exec(`
    CREATE TABLE IF NOT EXISTS ctx_${prefix}_contexts (
      id           TEXT    PRIMARY KEY,
      display_name TEXT    NOT NULL,
      description  TEXT,
      entries_json TEXT    NOT NULL,
      private      INTEGER NOT NULL DEFAULT 0,
      revision     INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT    NOT NULL,
      updated_at   TEXT    NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ctx_${prefix}_contexts_name
      ON ctx_${prefix}_contexts(display_name);
  `);
  initializeResourceHistorySchema(db, historyTable);
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
    updatedAt: row.updated_at as string
  };
}

export class SQLiteContextStore implements ContextStore {
  private readonly db: DB;
  private readonly tableName: string;
  private readonly historyTableName: string;

  constructor(projectId: string, dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    const prefix = tablePrefix(projectId);
    this.tableName = `ctx_${prefix}_contexts`;
    this.historyTableName = `ctx_${prefix}_history`;
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
      .prepare(`SELECT * FROM ${this.tableName} WHERE display_name = ?`)
      .get(displayName) as Record<string, unknown> | undefined;
    return row ? rowToRecord(row) : undefined;
  }

  list(includePrivate: boolean): ContextRecord[] {
    const sql = includePrivate
      ? `SELECT * FROM ${this.tableName} ORDER BY display_name`
      : `SELECT * FROM ${this.tableName} WHERE private = 0 ORDER BY display_name`;
    const rows = this.db.prepare(sql).all() as Record<string, unknown>[];
    return rows.map(rowToRecord);
  }

  insert(record: ContextRecord): void {
    this.db.prepare(`
      INSERT INTO ${this.tableName} (id, display_name, description, entries_json, private, revision, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.id,
      record.displayName,
      record.description ?? null,
      JSON.stringify(record.entries),
      record.private ? 1 : 0,
      record.revision,
      record.createdAt,
      record.updatedAt
    );
  }

  update(record: ContextRecord, expectedRevision: number): boolean {
    return this.db.transaction(() => {
      const row = this.db.prepare(`
        SELECT * FROM ${this.tableName} WHERE id = ? AND revision = ?
      `).get(record.id, expectedRevision) as Record<string, unknown> | undefined;
      if (!row) return false;
      insertHistorySnapshot(this.db, this.historyTableName, {
        resourceKind: "context",
        resourceId: record.id,
        revision: expectedRevision,
        snapshot: rowToRecord(row),
        recordedAt: record.updatedAt
      });
      const result = this.db.prepare(`
        UPDATE ${this.tableName}
        SET display_name = ?, description = ?, entries_json = ?, private = ?, revision = ?, updated_at = ?
        WHERE id = ? AND revision = ?
      `).run(
        record.displayName,
        record.description ?? null,
        JSON.stringify(record.entries),
        record.private ? 1 : 0,
        record.revision,
        record.updatedAt,
        record.id,
        expectedRevision
      );
      return result.changes === 1;
    })();
  }

  delete(id: string, deletedAt: string): number | undefined {
    return this.db.transaction(() => {
      const row = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`)
        .get(id) as Record<string, unknown> | undefined;
      if (!row) return undefined;
      const current = rowToRecord(row);
      insertHistorySnapshot(this.db, this.historyTableName, {
        resourceKind: "context",
        resourceId: id,
        revision: current.revision,
        snapshot: current,
        recordedAt: deletedAt
      });
      const deletedRevision = current.revision + 1;
      insertHistoryDeletion(this.db, this.historyTableName, {
        resourceKind: "context",
        resourceId: id,
        revision: deletedRevision,
        recordedAt: deletedAt
      });
      this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`).run(id);
      return deletedRevision;
    })();
  }

  purge(id: string): "purged" | "current" | "missing" {
    if (this.get(id)) return "current";
    return purgeResourceHistory(this.db, this.historyTableName, "context", id)
      ? "purged"
      : "missing";
  }

  history(id: string): ResourceHistoryRecord<ContextRecord>[] {
    return getResourceHistory<ContextRecord>(
      this.db,
      this.historyTableName,
      "context",
      id
    );
  }

  pruneHistory(cutoff: string): number {
    return pruneHistoryBefore(
      this.db,
      this.historyTableName,
      cutoff,
      (_kind, id) => Boolean(this.get(id))
    );
  }

  purgeExpired(cutoff: string): number {
    let purged = 0;
    for (const resource of listExpiredDeletedResources(
      this.db,
      this.historyTableName,
      cutoff
    )) {
      if (!this.get(resource.resourceId) && this.purge(resource.resourceId) === "purged") {
        purged += 1;
      }
    }
    return purged;
  }
}
