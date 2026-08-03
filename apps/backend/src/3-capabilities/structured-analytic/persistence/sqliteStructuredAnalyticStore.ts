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
  nextRevisionAfterHistory,
  pruneHistoryBefore,
  purgeResourceHistory
} from "#utils/persistence/resourceHistory.js";
import { NoopLogger, type Logger } from "#platform/observability/logger.js";
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
 * Thrown when a stored definition will not parse, or is not text at all.
 *
 * For the *wrong type* case there is prior art: Document and Slides both reject
 * a non-string JSON column. For a *corrupt string*, nothing does — Templates,
 * Persona, Slides, and Investigation all call bare `JSON.parse`, so a damaged
 * column throws a `SyntaxError` naming neither the row nor the column. This
 * says what it could not read, in both cases.
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

/**
 * An id whose history has not been purged cannot be used again.
 *
 * History is keyed by (kind, id, revision) and a new analytic starts at
 * revision 1, so re-using an id whose old snapshot@1 still exists collides on
 * the *next* update — which then rolls back forever, silently discarding every
 * edit, while `latestSnapshot` reports the dead analytic's final state as this
 * one's. Refusing here turns a permanent, invisible wedge into an immediate,
 * explicable fault.
 *
 * Purging the old history frees the id, which is the intended way back.
 */
export class AnalyticIdRetiredError extends Error {
  constructor(
    public readonly analyticId: string,
    public readonly survivingRevisions: number
  ) {
    super(
      `Structured Analytic id ${analyticId} still has history through revision`
      + ` ${survivingRevisions}; purge it before reusing the id`
    );
    this.name = "AnalyticIdRetiredError";
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
  private readonly logger: Logger;

  /**
   * The logger is optional so a test can construct a store without one, but
   * production always passes it: what a store actually wrote is the ground
   * truth every other log record is describing indirectly, and the bugs found
   * in this file so far were all about a write that did not happen, or happened
   * to the wrong revision.
   */
  constructor(databasePath: string, projectId: string, logger: Logger = new NoopLogger()) {
    mkdirSync(dirname(databasePath), { recursive: true });
    this.db = new Database(databasePath);
    this.tables = createStructuredAnalyticTableNames(projectId);
    initializeStructuredAnalyticSchema(this.db, this.tables);
    this.logger = logger;
    this.logger.info(
      "structured-analytic.store.opened",
      { databasePath, projectId, tables: this.tables },
      { detail: "content" }
    );
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
    // An id is retired until its history is purged. `nextRevisionAfterHistory`
    // returns 1 exactly when no history exists, so anything else means this id
    // has a past — and a new record at revision 1 would collide with it.
    //
    // Connector and General Files instead resume numbering from history. That
    // avoids the collision but not the other half of the problem: until the new
    // analytic is first updated, `latestSnapshot` still returns the *previous*
    // resource's final state, which the port promises is `undefined`. Retiring
    // the id closes both.
    const nextFree = nextRevisionAfterHistory(
      this.db,
      this.tables.history,
      RESOURCE_KIND,
      analytic.id
    );
    if (nextFree !== 1) {
      this.logger.error(
        "structured-analytic.store.insert.id-retired",
        { analyticId: analytic.id, survivingRevisions: nextFree - 1, analytic },
        { detail: "content" }
      );
      throw new AnalyticIdRetiredError(analytic.id, nextFree - 1);
    }

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

    this.logger.info("structured-analytic.store.inserted", { analytic }, { detail: "content" });
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
    // IMMEDIATE, not the default DEFERRED. A deferred transaction begins as a
    // reader at the guard SELECT and only tries to become a writer at the
    // UPDATE; in WAL mode, if another connection commits in between, that
    // upgrade fails with SQLITE_BUSY_SNAPSHOT and `busy_timeout` does not
    // apply. The caller would get a raw SqliteError in exactly the situation
    // the boolean exists to describe. Derived Outputs takes the write lock up
    // front for the same reason.
    const applied = run.immediate(analytic, expectedRevision);
    // Both outcomes, at the level each deserves: a lost CAS is an ordinary
    // concurrent-edit outcome, but it is also the first thing anyone asks about
    // when an edit "did not save".
    if (applied) {
      this.logger.info(
        "structured-analytic.store.updated",
        { analyticId: analytic.id, expectedRevision, revision: analytic.revision, analytic },
        { detail: "content" }
      );
    } else {
      this.logger.warn(
        "structured-analytic.store.update.cas-missed",
        {
          analyticId: analytic.id,
          expectedRevision,
          actualRevision: this.get(analytic.id)?.revision ?? null,
          attempted: analytic
        },
        { detail: "content" }
      );
    }
    return applied;
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
    const applied = run.immediate(id, expectedRevision, deletedAt);
    this.logger.info(
      applied
        ? "structured-analytic.store.deleted"
        : "structured-analytic.store.delete.cas-missed",
      {
        analyticId: id,
        expectedRevision,
        deletedAt,
        ...(applied ? {} : { actualRevision: this.get(id)?.revision ?? null })
      },
      { detail: "content" }
    );
    return applied;
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
    const healed = result.changes === 1;
    // A repair leaves no history and no revision bump by design, so this record
    // is the *only* evidence it happened. Without it a definition would appear
    // to change with nothing anywhere explaining why.
    this.logger.info(
      healed
        ? "structured-analytic.store.repaired"
        : "structured-analytic.store.repair.cas-missed",
      { analyticId: id, expectedRevision, definition },
      { detail: "content" }
    );
    return healed;
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
    // `purgeResourceHistory` never reads the current table, so it cannot tell a
    // live analytic from a deleted one: given a live analytic whose history
    // ended in a tombstone it would delete that history and return true.
    //
    // Retiring reused ids in `insert` makes that state unreachable, so this
    // guard is no longer the only thing standing between a live analytic and
    // its history. It still earns its place: without it, purging a live
    // analytic that has ordinary snapshot history reports
    // `ResourceHistoryNotFoundError` — a 404 saying nothing is there — instead
    // of `ResourceNotDeletedError`, the 409 that says delete it first.
    if (this.get(id)) {
      this.logger.warn("structured-analytic.store.purge.still-live", { analyticId: id });
      throw new ResourceNotDeletedError(RESOURCE_KIND, id);
    }
    // Captured before the purge, because afterwards there is nothing left to
    // say what was destroyed.
    const discarded = getResourceHistory<StructuredAnalytic>(
      this.db, this.tables.history, RESOURCE_KIND, id
    );
    if (!purgeResourceHistory(this.db, this.tables.history, RESOURCE_KIND, id)) {
      this.logger.warn("structured-analytic.store.purge.no-history", { analyticId: id });
      throw new ResourceHistoryNotFoundError(RESOURCE_KIND, id);
    }
    this.logger.info(
      "structured-analytic.store.purged",
      { analyticId: id, discardedRecords: discarded.length, discarded },
      { detail: "content" }
    );
  }

  pruneHistory(cutoff: string): number {
    // The callback drives the helper's second phase, which sweeps the retained
    // tombstone of an id that is live again. Retiring reused ids makes that
    // state unreachable here, so this is belt-and-braces — one indexed lookup
    // per expired resource, and the phase it guards silently becomes correct
    // rather than dead if that invariant ever moves.
    const removed = pruneHistoryBefore(
      this.db,
      this.tables.history,
      cutoff,
      (_kind, id) => Boolean(this.db.prepare(
        `SELECT 1 FROM ${this.tables.analytics} WHERE id = ?`
      ).get(id))
    );
    // Retention deletes without asking anyone, on a timer. A count and the
    // cutoff that produced it is the least this can leave behind.
    this.logger.info("structured-analytic.store.history-pruned", { cutoff, removed });
    return removed;
  }

  expiredDeleted(cutoff: string): string[] {
    // The shared helper sweeps a whole history table without filtering by kind.
    // This table only ever holds one kind, so the filter is belt-and-braces —
    // but it is what keeps the return type honest as `string[]` of analytic ids.
    const expired = listExpiredDeletedResources(this.db, this.tables.history, cutoff)
      .filter(resource => resource.resourceKind === RESOURCE_KIND)
      .map(resource => resource.resourceId);
    if (expired.length > 0) {
      this.logger.info(
        "structured-analytic.store.expired-deleted",
        { cutoff, analyticIds: expired },
        { detail: "content" }
      );
    }
    return expired;
  }
}
