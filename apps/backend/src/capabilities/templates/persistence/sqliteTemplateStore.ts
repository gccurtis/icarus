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
} from "#shared/persistence/resourceHistory.js";
import type { TemplateCommittedTransaction, TemplateRecord } from "../domain/model.js";
import type {
  TemplateClaimOutcome,
  TemplateCommandClaim,
  TemplateFinalizeCommit,
  TemplateStore,
  TemplateUpdateCommit
} from "../ports/templateStore.js";
import {
  createTemplateTableNames,
  initializeTemplateSchema,
  type TemplateTableNames
} from "./sqliteSchema.js";
import {
  decodeJson,
  encodeJson,
  rowToTransaction,
  rowToTemplate,
  type SQLiteRow
} from "./sqliteMappers.js";

const DEFAULT_OUTBOX_LIMIT = 100;
const MAX_OUTBOX_LIMIT = 1_000;

const UNIQUE_VIOLATION = "SQLITE_CONSTRAINT_PRIMARYKEY";
const UNIQUE_INDEX_VIOLATION = "SQLITE_CONSTRAINT_UNIQUE";

const isUniqueViolation = (error: unknown): boolean => {
  const code = (error as { code?: string } | null)?.code;
  return code === UNIQUE_VIOLATION || code === UNIQUE_INDEX_VIOLATION;
};

export class SQLiteTemplateStore implements TemplateStore {
  private readonly db: DatabaseConnection;
  private readonly tables: TemplateTableNames;

  constructor(projectId: string, filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.db = new Database(filePath);
    this.tables = createTemplateTableNames(projectId);
    initializeTemplateSchema(this.db, this.tables);
  }

  get(id: string): TemplateRecord | undefined {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.templates} WHERE id = ?`)
      .get(id) as SQLiteRow | undefined;
    return row ? rowToTemplate(row) : undefined;
  }

  list(kind?: string): TemplateRecord[] {
    const sql = kind === undefined
      ? `SELECT * FROM ${this.tables.templates}
         WHERE state = 'ready'
         ORDER BY created_at, id`
      : `SELECT * FROM ${this.tables.templates}
         WHERE state = 'ready' AND kind = ?
         ORDER BY created_at, id`;
    const rows = (kind === undefined
      ? this.db.prepare(sql).all()
      : this.db.prepare(sql).all(kind)) as SQLiteRow[];
    return rows.map(rowToTemplate);
  }

  claimCommand(claim: TemplateCommandClaim): TemplateClaimOutcome {
    const existing = this.db
      .prepare(`SELECT * FROM ${this.tables.commandClaims} WHERE request_id = ?`)
      .get(claim.requestId) as SQLiteRow | undefined;

    if (existing) {
      return {
        state: existing.state === "completed" ? "completed" : "pending",
        requestDigest: existing.request_digest as string,
        commandType: existing.command_type as TemplateCommandClaim["commandType"],
        ...((existing.template_id as string | null) !== null
          ? { templateId: existing.template_id as string }
          : {}),
        ...((existing.result_json as Buffer | null) !== null
          ? { result: decodeJson<unknown>(existing.result_json) }
          : {})
      };
    }

    this.db
      .prepare(
        `INSERT INTO ${this.tables.commandClaims}
           (request_id, request_digest, command_type, template_id, state,
            result_json, created_at, updated_at)
         VALUES (?, ?, ?, NULL, 'pending', NULL, ?, ?)`
      )
      .run(
        claim.requestId,
        claim.requestDigest,
        claim.commandType,
        claim.createdAt,
        claim.createdAt
      );

    return {
      state: "claimed",
      requestDigest: claim.requestDigest,
      commandType: claim.commandType
    };
  }

  bindClaimTemplateId(requestId: string, templateId: string, at: string): void {
    this.db
      .prepare(
        `UPDATE ${this.tables.commandClaims}
         SET template_id = ?, updated_at = ?
         WHERE request_id = ?`
      )
      .run(templateId, at, requestId);
  }

  completeClaim(requestId: string, result: unknown, at: string): void {
    this.db
      .prepare(
        `UPDATE ${this.tables.commandClaims}
         SET state = 'completed', result_json = ?, updated_at = ?
         WHERE request_id = ?`
      )
      .run(encodeJson(result), at, requestId);
  }

  reserve(record: TemplateRecord): boolean {
    try {
      this.db
        .prepare(
          `INSERT INTO ${this.tables.templates}
             (id, kind, resource_id, name, description, context_bindings_json,
              state, revision, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          record.id,
          record.kind,
          record.resourceId,
          record.name,
          record.description ?? null,
          encodeJson(record.contextBindings),
          record.state,
          record.revision,
          record.createdAt,
          record.updatedAt
        );
      return true;
    } catch (error) {
      if (isUniqueViolation(error)) return false;
      throw error;
    }
  }

  nameTaken(kind: string, name: string, exceptId?: string): boolean {
    const row = exceptId === undefined
      ? this.db.prepare(
          `SELECT 1 FROM ${this.tables.templates}
           WHERE kind = ? AND name = ? COLLATE NOCASE`
        ).get(kind, name)
      : this.db.prepare(
          `SELECT 1 FROM ${this.tables.templates}
           WHERE kind = ? AND name = ? COLLATE NOCASE AND id != ?`
        ).get(kind, name, exceptId);
    return row !== undefined;
  }

  update(commit: TemplateUpdateCommit): boolean {
    const run = this.db.transaction((input: TemplateUpdateCommit): boolean => {
      const row = this.db.prepare(
        `SELECT * FROM ${this.tables.templates} WHERE id = ? AND state = 'ready'`
      ).get(input.record.id) as SQLiteRow | undefined;
      if (!row) return false;

      const current = rowToTemplate(row);
      if (current.revision !== input.expectedRevision) return false;

      // Archive what is being replaced, at the revision it held. Without this
      // an update would be the one revision transition leaving no history, and
      // latestSnapshot() would report pre-update state as current.
      insertHistorySnapshot(this.db, this.tables.history, {
        resourceKind: "template",
        resourceId: current.id,
        revision: current.revision,
        snapshot: current,
        recordedAt: input.at
      });

      this.db.prepare(
        `UPDATE ${this.tables.templates}
         SET name = ?, description = ?, context_bindings_json = ?,
             revision = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        input.record.name,
        input.record.description ?? null,
        encodeJson(input.record.contextBindings),
        input.record.revision,
        input.record.updatedAt,
        input.record.id
      );

      this.insertTransaction(input.transaction);
      return true;
    });
    return run(commit);
  }

  markReady(commit: TemplateFinalizeCommit): void {
    const run = this.db.transaction((input: TemplateFinalizeCommit) => {
      this.db
        .prepare(`UPDATE ${this.tables.templates} SET state = 'ready', updated_at = ? WHERE id = ?`)
        .run(input.at, input.templateId);
      this.insertTransaction(input.transaction);
    });
    run(commit);
  }

  delete(commit: TemplateFinalizeCommit): void {
    const run = this.db.transaction((input: TemplateFinalizeCommit) => {
      const row = this.db.prepare(
        `SELECT * FROM ${this.tables.templates} WHERE id = ? AND state = 'ready'`
      ).get(input.templateId) as SQLiteRow | undefined;
      if (!row) return;
      const snapshot = rowToTemplate(row);
      insertHistorySnapshot(this.db, this.tables.history, {
        resourceKind: "template",
        resourceId: snapshot.id,
        revision: snapshot.revision,
        snapshot,
        recordedAt: input.at
      });
      insertHistoryDeletion(this.db, this.tables.history, {
        resourceKind: "template",
        resourceId: snapshot.id,
        revision: snapshot.revision + 1,
        recordedAt: input.at
      });
      this.db.prepare(`DELETE FROM ${this.tables.templates} WHERE id = ?`).run(input.templateId);
      this.insertTransaction(input.transaction);
    });
    run(commit);
  }

  deleteReservation(id: string): void {
    this.db
      .prepare(`DELETE FROM ${this.tables.templates} WHERE id = ? AND state = 'reserving'`)
      .run(id);
  }

  latestSnapshot(id: string): TemplateRecord | undefined {
    return getResourceHistory<TemplateRecord>(
      this.db,
      this.tables.history,
      "template",
      id
    ).slice().reverse().find((record) => record.recordType === "snapshot")?.snapshot;
  }

  purge(id: string): void {
    if (this.get(id)) throw new ResourceNotDeletedError("template", id);
    if (!purgeResourceHistory(this.db, this.tables.history, "template", id)) {
      throw new ResourceHistoryNotFoundError("template", id);
    }
  }

  pruneHistory(cutoff: string): number {
    return pruneHistoryBefore(
      this.db,
      this.tables.history,
      cutoff,
      (_kind, id) => Boolean(this.db.prepare(
        `SELECT 1 FROM ${this.tables.templates} WHERE id = ?`
      ).get(id))
    );
  }

  expiredDeleted(cutoff: string): string[] {
    return listExpiredDeletedResources(this.db, this.tables.history, cutoff)
      .filter(({ resourceKind }) => resourceKind === "template")
      .map(({ resourceId }) => resourceId);
  }

  listUnpublishedTransactions(limit = DEFAULT_OUTBOX_LIMIT): TemplateCommittedTransaction[] {
    const bounded = Math.min(Math.max(1, limit), MAX_OUTBOX_LIMIT);
    const rows = this.db
      .prepare(
        `SELECT * FROM ${this.tables.transactionOutbox}
         WHERE published_at IS NULL
         ORDER BY occurred_at, source_transaction_id
         LIMIT ?`
      )
      .all(bounded) as SQLiteRow[];
    return rows.map(rowToTransaction);
  }

  markTransactionPublished(sourceTransactionId: string, publishedAt: string): void {
    this.db
      .prepare(
        `UPDATE ${this.tables.transactionOutbox}
         SET published_at = ? WHERE source_transaction_id = ?`
      )
      .run(publishedAt, sourceTransactionId);
  }

  /**
   * OR IGNORE because source transaction IDs are derived from the request. A
   * resumed command re-presents the same transaction and must not append a
   * duplicate outbox row.
   */
  private insertTransaction(transaction: TemplateCommittedTransaction): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO ${this.tables.transactionOutbox}
           (source_transaction_id, transaction_kind, template_id, resource_kind, resource_id, actor_id,
            origin, occurred_at, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`
      )
      .run(
        transaction.sourceTransactionId,
        transaction.kind,
        transaction.templateId,
        transaction.resourceKind,
        transaction.resourceId,
        transaction.actorId ?? null,
        transaction.origin,
        transaction.occurredAt
      );
  }
}
