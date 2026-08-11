import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database, { type Database as DatabaseConnection } from "better-sqlite3";
import {
  getLatestHistoryRecord,
  insertHistoryDeletion,
  insertHistorySnapshot,
  listExpiredDeletedResources,
  pruneHistoryBefore,
  purgeResourceHistory
} from "#shared/persistence/resourceHistory.js";
import { InvalidCommentCursorError } from "../domain/errors.js";
import type {
  Comment,
  CommentCommittedTransaction,
  CommentCommandReceipt,
  CommentCommandResult,
  CommentPage,
  CommentState,
  JsonObject
} from "../domain/model.js";
import type {
  CommentListFilter,
  CommentStore,
  CommentWriteCommit
} from "../ports/commentStore.js";
import {
  createCommentTableNames,
  initializeCommentSchema,
  type CommentTableNames
} from "./sqliteSchema.js";

const DEFAULT_OUTBOX_LIMIT = 100;
const MAX_OUTBOX_LIMIT = 1_000;

type SQLiteRow = Record<string, unknown>;

interface CommentCursor {
  kind: "comments-target";
  resourceKind: string;
  resourceId: string;
  state: CommentState | null;
  createdAt: string;
  id: string;
}

const encodeJson = (value: unknown): Buffer =>
  Buffer.from(JSON.stringify(value), "utf8");

const decodeJson = <T>(value: unknown): T => {
  const text = Buffer.isBuffer(value)
    ? value.toString("utf8")
    : typeof value === "string"
      ? value
      : "";
  return JSON.parse(text) as T;
};

const rowToComment = (row: SQLiteRow): Comment => ({
  id: row.id as string,
  body: row.body as string,
  mentions: decodeJson<string[]>(row.mentions_json),
  target: {
    resourceKind: row.resource_kind as string,
    resourceId: row.resource_id as string,
    ...((row.sub_target_json as Buffer | string | null) !== null
      ? { subTarget: decodeJson<JsonObject>(row.sub_target_json) }
      : {})
  },
  state: row.state as CommentState,
  revision: Number(row.revision),
  createdBy: row.created_by as string,
  updatedBy: row.updated_by as string,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string
});

const rowToReceipt = (row: SQLiteRow): CommentCommandReceipt => ({
  requestId: row.request_id as string,
  requestDigest: row.request_digest as string,
  result: decodeJson<CommentCommandResult>(row.result_json),
  createdAt: row.created_at as string
});

const rowToTransaction = (row: SQLiteRow): CommentCommittedTransaction => ({
  sourceTransactionId: row.source_transaction_id as string,
  sourceRequestId: row.source_request_id as string,
  operation: row.operation as CommentCommittedTransaction["operation"],
  commentId: row.comment_id as string,
  resourceKind: row.resource_kind as string,
  resourceId: row.resource_id as string,
  state: row.state as CommentState,
  mentionCount: Number(row.mention_count),
  actorId: row.actor_id as string,
  origin: row.origin as CommentCommittedTransaction["origin"],
  occurredAt: row.occurred_at as string,
  ...((row.published_at as string | null) !== null
    ? { publishedAt: row.published_at as string }
    : {})
});

const encodeCursor = (cursor: CommentCursor): string =>
  Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");

const decodeCursor = (
  value: string,
  filter: Pick<CommentListFilter, "resourceKind" | "resourceId" | "state">
): CommentCursor => {
  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<CommentCursor>;
    if (
      cursor.kind !== "comments-target" ||
      typeof cursor.resourceKind !== "string" ||
      typeof cursor.resourceId !== "string" ||
      (cursor.state !== null && cursor.state !== "open" && cursor.state !== "resolved") ||
      typeof cursor.createdAt !== "string" ||
      typeof cursor.id !== "string" ||
      cursor.resourceKind !== filter.resourceKind ||
      cursor.resourceId !== filter.resourceId ||
      cursor.state !== (filter.state ?? null)
    ) {
      throw new InvalidCommentCursorError();
    }
    return cursor as CommentCursor;
  } catch (error) {
    if (error instanceof InvalidCommentCursorError) throw error;
    throw new InvalidCommentCursorError();
  }
};

const insertReceipt = (
  db: DatabaseConnection,
  tables: CommentTableNames,
  receipt: CommentCommandReceipt
): void => {
  db.prepare(`
    INSERT INTO ${tables.receipts}
      (request_id, request_digest, result_json, created_at)
    VALUES (?, ?, ?, ?)
  `).run(
    receipt.requestId,
    receipt.requestDigest,
    encodeJson(receipt.result),
    receipt.createdAt
  );
};

const insertTransaction = (
  db: DatabaseConnection,
  tables: CommentTableNames,
  transaction: CommentCommittedTransaction
): void => {
  db.prepare(`
    INSERT INTO ${tables.transactionOutbox}
      (source_transaction_id, source_request_id, operation, comment_id, resource_kind,
       resource_id, state, mention_count, actor_id, origin, occurred_at, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `).run(
    transaction.sourceTransactionId,
    transaction.sourceRequestId,
    transaction.operation,
    transaction.commentId,
    transaction.resourceKind,
    transaction.resourceId,
    transaction.state,
    transaction.mentionCount,
    transaction.actorId,
    transaction.origin,
    transaction.occurredAt
  );
};

const insertComment = (
  db: DatabaseConnection,
  tables: CommentTableNames,
  comment: Comment
): void => {
  db.prepare(`
    INSERT INTO ${tables.comments}
      (id, body, mentions_json, resource_kind, resource_id, sub_target_json,
       state, revision, created_by, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    comment.id,
    comment.body,
    encodeJson(comment.mentions),
    comment.target.resourceKind,
    comment.target.resourceId,
    comment.target.subTarget === undefined ? null : encodeJson(comment.target.subTarget),
    comment.state,
    comment.revision,
    comment.createdBy,
    comment.updatedBy,
    comment.createdAt,
    comment.updatedAt
  );
};

/** SQLite implementation of the project-bound Comments store. */
export class SQLiteCommentStore implements CommentStore {
  private readonly db: DatabaseConnection;
  private readonly tables: CommentTableNames;

  constructor(projectId: string, dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.tables = createCommentTableNames(projectId);
    initializeCommentSchema(this.db, this.tables);
  }

  close(): void {
    this.db.close();
  }

  async getComment(commentId: string): Promise<Comment | undefined> {
    const row = this.db.prepare(`
      SELECT * FROM ${this.tables.comments}
      WHERE id = ?
    `).get(commentId) as SQLiteRow | undefined;
    return row ? rowToComment(row) : undefined;
  }

  async listComments(filter: CommentListFilter): Promise<CommentPage> {
    const cursor = filter.cursor ? decodeCursor(filter.cursor, filter) : undefined;
    const where = ["resource_kind = ?", "resource_id = ?"];
    const parameters: unknown[] = [filter.resourceKind, filter.resourceId];
    if (filter.state !== undefined) {
      where.push("state = ?");
      parameters.push(filter.state);
    }
    if (cursor) {
      where.push("(created_at > ? OR (created_at = ? AND id > ?))");
      parameters.push(cursor.createdAt, cursor.createdAt, cursor.id);
    }
    const rows = this.db.prepare(`
      SELECT * FROM ${this.tables.comments}
      WHERE ${where.join(" AND ")}
      ORDER BY created_at ASC, id ASC
      LIMIT ?
    `).all(...parameters, filter.limit + 1) as SQLiteRow[];
    const hasMore = rows.length > filter.limit;
    const items = rows.slice(0, filter.limit).map(rowToComment);
    const last = items.at(-1);
    return {
      items,
      ...(hasMore && last
        ? {
            nextCursor: encodeCursor({
              kind: "comments-target",
              resourceKind: filter.resourceKind,
              resourceId: filter.resourceId,
              state: filter.state ?? null,
              createdAt: last.createdAt,
              id: last.id
            })
          }
        : {})
    };
  }

  async getReceipt(requestId: string): Promise<CommentCommandReceipt | undefined> {
    const row = this.db.prepare(`
      SELECT * FROM ${this.tables.receipts} WHERE request_id = ?
    `).get(requestId) as SQLiteRow | undefined;
    return row ? rowToReceipt(row) : undefined;
  }

  async commitCreation(commit: CommentWriteCommit): Promise<void> {
    this.db.transaction(() => {
      insertComment(this.db, this.tables, commit.comment);
      insertReceipt(this.db, this.tables, commit.receipt);
      insertTransaction(this.db, this.tables, commit.transaction);
    })();
  }

  async commitMutation(commit: CommentWriteCommit): Promise<boolean> {
    return this.db.transaction(() => {
      const row = this.db.prepare(`
        SELECT * FROM ${this.tables.comments}
        WHERE id = ? AND revision = ?
      `).get(commit.comment.id, commit.comment.revision - 1) as SQLiteRow | undefined;
      if (!row) return false;
      const previous = rowToComment(row);
      insertHistorySnapshot(this.db, this.tables.history, {
        resourceKind: "comment",
        resourceId: previous.id,
        revision: previous.revision,
        snapshot: previous,
        recordedAt: commit.comment.updatedAt
      });

      if (commit.transaction.operation === "deleted") {
        insertHistoryDeletion(this.db, this.tables.history, {
          resourceKind: "comment",
          resourceId: previous.id,
          revision: commit.comment.revision,
          recordedAt: commit.comment.updatedAt
        });
        this.db.prepare(`DELETE FROM ${this.tables.comments} WHERE id = ? AND revision = ?`)
          .run(previous.id, previous.revision);
      } else {
        const changed = this.db.prepare(`
          UPDATE ${this.tables.comments}
          SET body = ?, mentions_json = ?, resource_kind = ?, resource_id = ?,
              sub_target_json = ?, state = ?, revision = ?, updated_by = ?, updated_at = ?
          WHERE id = ? AND revision = ?
        `).run(
          commit.comment.body,
          encodeJson(commit.comment.mentions),
          commit.comment.target.resourceKind,
          commit.comment.target.resourceId,
          commit.comment.target.subTarget === undefined
            ? null
            : encodeJson(commit.comment.target.subTarget),
          commit.comment.state,
          commit.comment.revision,
          commit.comment.updatedBy,
          commit.comment.updatedAt,
          commit.comment.id,
          previous.revision
        );
        if (changed.changes !== 1) return false;
      }
      insertReceipt(this.db, this.tables, commit.receipt);
      insertTransaction(this.db, this.tables, commit.transaction);
      return true;
    })();
  }

  async recordReceipt(receipt: CommentCommandReceipt): Promise<void> {
    this.db.transaction(() => insertReceipt(this.db, this.tables, receipt))();
  }

  async purge(
    commentId: string,
    receipt: CommentCommandReceipt
  ): Promise<"purged" | "current" | "missing"> {
    return this.db.transaction(() => {
      if (this.db.prepare(`SELECT 1 FROM ${this.tables.comments} WHERE id = ?`).get(commentId)) {
        return "current" as const;
      }
      const latest = getLatestHistoryRecord(
        this.db,
        this.tables.history,
        "comment",
        commentId
      );
      if (!latest || latest.recordType !== "deleted") return "missing" as const;
      insertReceipt(this.db, this.tables, receipt);
      purgeResourceHistory(this.db, this.tables.history, "comment", commentId);
      return "purged" as const;
    })();
  }

  async listUnpublishedTransactions(limit = DEFAULT_OUTBOX_LIMIT): Promise<CommentCommittedTransaction[]> {
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new Error("Comment Activity outbox limit must be a positive safe integer");
    }
    const bounded = Math.min(limit, MAX_OUTBOX_LIMIT);
    const rows = this.db.prepare(`
      SELECT * FROM ${this.tables.transactionOutbox}
      WHERE published_at IS NULL
      ORDER BY occurred_at ASC, source_transaction_id ASC
      LIMIT ?
    `).all(bounded) as SQLiteRow[];
    return rows.map(rowToTransaction);
  }

  async markTransactionPublished(sourceTransactionId: string, publishedAt: string): Promise<void> {
    this.db.prepare(`
      UPDATE ${this.tables.transactionOutbox}
      SET published_at = COALESCE(published_at, ?)
      WHERE source_transaction_id = ?
    `).run(publishedAt, sourceTransactionId);
  }

  async pruneHistory(cutoff: string): Promise<number> {
    return pruneHistoryBefore(
      this.db,
      this.tables.history,
      cutoff,
      (_kind, id) => Boolean(
        this.db.prepare(`SELECT 1 FROM ${this.tables.comments} WHERE id = ?`).get(id)
      )
    );
  }

  async purgeExpired(cutoff: string): Promise<number> {
    let purged = 0;
    for (const resource of listExpiredDeletedResources(this.db, this.tables.history, cutoff)) {
      if (await this.getComment(resource.resourceId)) continue;
      if (purgeResourceHistory(this.db, this.tables.history, "comment", resource.resourceId)) {
        purged += 1;
      }
    }
    return purged;
  }
}
