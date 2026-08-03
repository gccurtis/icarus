import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database, { type Database as DatabaseConnection } from "better-sqlite3";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError,
  getResourceHistory,
  insertHistoryDeletion,
  insertHistorySnapshot,
  listExpiredDeletedResources,
  pruneHistoryBefore,
  purgeResourceHistory
} from "#utils/persistence/resourceHistory.js";
import type { AnalyticDefinition, StructuredAnalytic } from "../domain/model.js";
import type { StructuredAnalyticStore } from "../ports/structuredAnalyticStore.js";
import {
  createStructuredAnalyticTableNames,
  initializeStructuredAnalyticSchema,
  type StructuredAnalyticTableNames
} from "./sqliteSchema.js";

/**
 * The resource kind this capability owns in the shared history table. One
 * literal, used by every history call, so a typo cannot split a resource's
 * history across two kinds.
 */
const RESOURCE_KIND = "structured-analytic";

interface SQLiteRow {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly definition_json: string;
  readonly revision: number;
  readonly created_by: string;
  readonly updated_by: string;
  readonly created_at: string;
  readonly updated_at: string;
}

/**
 * Thrown when a stored definition will not parse.
 *
 * No other store in this backend handles this case — a corrupt JSON column
 * propagates a bare `SyntaxError` naming neither the row nor the column. That
 * is not a convention worth copying, so this one says what it could not read.
 */
export class CorruptAnalyticRowError extends Error {
  constructor(
    public readonly analyticId: string,
    public readonly reason: string
  ) {
    super(`Structured Analytic ${analyticId} has an unreadable definition: ${reason}`);
    this.name = "CorruptAnalyticRowError";
  }
}

const decodeDefinition = (raw: unknown, id: string): AnalyticDefinition => {
  if (typeof raw !== "string") {
    // A Buffer here would mean something wrote this column with a BLOB encoder.
    // SQLite's dynamic typing accepts that silently and hands back a Uint8Array.
    throw new CorruptAnalyticRowError(id, `expected TEXT, found ${typeof raw}`);
  }
  try {
    return JSON.parse(raw) as AnalyticDefinition;
  } catch (error) {
    throw new CorruptAnalyticRowError(id, error instanceof Error ? error.message : String(error));
  }
};

/**
 * Absent, not `undefined`, for an omitted description.
 *
 * `deepEqual` against a record that never had the key fails if this writes
 * `description: undefined`, and the first thing that notices is a history
 * assertion, which makes it look like a history bug.
 */
const rowToAnalytic = (row: SQLiteRow): StructuredAnalytic => ({
  id: row.id,
  title: row.title,
  ...(row.description !== null ? { description: row.description } : {}),
  definition: decodeDefinition(row.definition_json, row.id),
  revision: Number(row.revision),
  createdBy: row.created_by,
  updatedBy: row.updated_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export class SQLiteStructuredAnalyticStore implements StructuredAnalyticStore {
  private readonly db: DatabaseConnection;
  private readonly tables: StructuredAnalyticTableNames;

  constructor(databasePath: string, projectId: string) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new Database(databasePath);
    this.tables = createStructuredAnalyticTableNames(projectId);
    initializeStructuredAnalyticSchema(this.db, this.tables);
  }

  close(): void {
    this.db.close();
  }

  // ── Reads ───────────────────────────────────────────────────────────────

  get(id: string): StructuredAnalytic | undefined {
    const row = this.db.prepare(
      `SELECT * FROM ${this.tables.analytics} WHERE id = ?`
    ).get(id) as SQLiteRow | undefined;
    return row ? rowToAnalytic(row) : undefined;
  }

  list(): StructuredAnalytic[] {
    const rows = this.db.prepare(
      `SELECT * FROM ${this.tables.analytics} ORDER BY updated_at DESC, id ASC`
    ).all() as SQLiteRow[];
    return rows.map(rowToAnalytic);
  }

  // ── Writes ──────────────────────────────────────────────────────────────

  insert(analytic: StructuredAnalytic): void {
    this.db.prepare(
      `INSERT INTO ${this.tables.analytics}
         (id, title, description, definition_json, revision,
          created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      analytic.id,
      analytic.title,
      analytic.description ?? null,
      JSON.stringify(analytic.definition),
      analytic.revision,
      analytic.createdBy,
      analytic.updatedBy,
      analytic.createdAt,
      analytic.updatedAt
    );
  }

  update(analytic: StructuredAnalytic, expectedRevision: number): boolean {
    const run = this.db.transaction(
      (next: StructuredAnalytic, expected: number): boolean => {
        // The CAS lives in the WHERE clause as well as here. Inside one
        // transaction the read is enough, but a guard that survives being
        // copied out of its transaction is worth the extra predicate.
        const row = this.db.prepare(
          `SELECT * FROM ${this.tables.analytics} WHERE id = ? AND revision = ?`
        ).get(next.id, expected) as SQLiteRow | undefined;
        if (!row) return false;

        const current = rowToAnalytic(row);

        // The replacement must be exactly one revision ahead. Nothing else
        // checks this, and getting it wrong surfaces much later as a history
        // primary-key collision on some unrelated update.
        if (next.revision !== current.revision + 1) {
          throw new Error(
            `Structured Analytic ${next.id}: replacement is at revision ${next.revision},`
            + ` expected ${current.revision + 1}`
          );
        }

        // Archive what is being replaced, at the revision it held. Without this
        // an update would be the one revision transition leaving no history,
        // and latestSnapshot() would report pre-update state as current.
        insertHistorySnapshot(this.db, this.tables.history, {
          resourceKind: RESOURCE_KIND,
          resourceId: current.id,
          revision: current.revision,
          snapshot: current,
          recordedAt: next.updatedAt
        });

        const result = this.db.prepare(
          `UPDATE ${this.tables.analytics}
             SET title = ?, description = ?, definition_json = ?,
                 revision = ?, updated_by = ?, updated_at = ?
           WHERE id = ? AND revision = ?`
        ).run(
          next.title,
          next.description ?? null,
          JSON.stringify(next.definition),
          next.revision,
          next.updatedBy,
          next.updatedAt,
          next.id,
          expected
        );
        return result.changes === 1;
      }
    );
    return run(analytic, expectedRevision);
  }

  delete(id: string, expectedRevision: number, deletedAt: string): boolean {
    const run = this.db.transaction((target: string, expected: number, at: string): boolean => {
      const row = this.db.prepare(
        `SELECT * FROM ${this.tables.analytics} WHERE id = ? AND revision = ?`
      ).get(target, expected) as SQLiteRow | undefined;
      if (!row) return false;

      const snapshot = rowToAnalytic(row);
      // The final state, then a tombstone one revision later. Both carry the
      // same recordedAt so retention treats the pair as one event.
      insertHistorySnapshot(this.db, this.tables.history, {
        resourceKind: RESOURCE_KIND,
        resourceId: snapshot.id,
        revision: snapshot.revision,
        snapshot,
        recordedAt: at
      });
      insertHistoryDeletion(this.db, this.tables.history, {
        resourceKind: RESOURCE_KIND,
        resourceId: snapshot.id,
        revision: snapshot.revision + 1,
        recordedAt: at
      });

      const result = this.db.prepare(
        `DELETE FROM ${this.tables.analytics} WHERE id = ? AND revision = ?`
      ).run(target, expected);
      return result.changes === 1;
    });
    return run(id, expectedRevision, deletedAt);
  }

  /**
   * Deliberately not a transaction and deliberately not a revision bump: one
   * conditional UPDATE, no history, no `updated_at`. See the port for why each
   * of those is load-bearing rather than an omission.
   */
  repairInputNames(
    id: string,
    expectedRevision: number,
    definition: AnalyticDefinition
  ): boolean {
    const result = this.db.prepare(
      `UPDATE ${this.tables.analytics}
          SET definition_json = ?
        WHERE id = ? AND revision = ?`
    ).run(JSON.stringify(definition), id, expectedRevision);
    return result.changes === 1;
  }

  // ── History and retention ───────────────────────────────────────────────

  latestSnapshot(id: string): StructuredAnalytic | undefined {
    return getResourceHistory<StructuredAnalytic>(
      this.db,
      this.tables.history,
      RESOURCE_KIND,
      id
    ).slice().reverse().find(record => record.recordType === "snapshot")?.snapshot;
  }

  purge(id: string): void {
    // Load-bearing, not defensive. `purgeResourceHistory` never reads the
    // current table, so it cannot tell a live analytic from a deleted one: on a
    // live analytic whose history happens to end in a tombstone it would delete
    // that history and return true.
    if (this.get(id)) throw new ResourceNotDeletedError(RESOURCE_KIND, id);
    if (!purgeResourceHistory(this.db, this.tables.history, RESOURCE_KIND, id)) {
      throw new ResourceHistoryNotFoundError(RESOURCE_KIND, id);
    }
  }

  pruneHistory(cutoff: string): number {
    return pruneHistoryBefore(
      this.db,
      this.tables.history,
      cutoff,
      (_kind, id) => Boolean(this.db.prepare(
        `SELECT 1 FROM ${this.tables.analytics} WHERE id = ?`
      ).get(id))
    );
  }

  expiredDeleted(cutoff: string): string[] {
    // The shared helper sweeps a whole history table without filtering by kind.
    // This table only ever holds one kind, so the filter is belt-and-braces —
    // but it is what keeps the return type honest as `string[]` of analytic ids.
    return listExpiredDeletedResources(this.db, this.tables.history, cutoff)
      .filter(resource => resource.resourceKind === RESOURCE_KIND)
      .map(resource => resource.resourceId);
  }
}
