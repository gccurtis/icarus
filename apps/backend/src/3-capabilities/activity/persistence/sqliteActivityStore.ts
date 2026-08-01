import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database, { type Database as DatabaseConnection } from "better-sqlite3";
import {
  canonicalizeMetadata,
  digestActivityTransaction
} from "../domain/canonical.js";
import {
  ActivityTransactionConflictError,
  InvalidActivityCursorError
} from "../domain/errors.js";
import type {
  ActivityPresenceFilter,
  ActivityPresenceHeartbeat,
  ActivityTransaction,
  ActivityTransactionFilter,
  ActivityTransactionPage,
  PresenceLease,
  StoredActivityTransaction
} from "../domain/model.js";
import type { ActivityStore } from "../ports/activityStore.js";
import {
  createActivityTableNames,
  initializeActivitySchema,
  type ActivityTableNames
} from "./sqliteSchema.js";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const DEFAULT_PRESENCE_CLEANUP_LIMIT = 100;
const MAX_PRESENCE_CLEANUP_LIMIT = 1_000;

type SQLiteRow = Record<string, unknown>;

interface TransactionCursor {
  kind: "activity-transactions";
  sequence: number;
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

const boundedLimit = (
  value: number | undefined,
  fallback: number,
  maximum: number
): number => {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("Activity store limit must be a positive safe integer");
  }
  return Math.min(value, maximum);
};

const encodeCursor = (cursor: TransactionCursor): string =>
  Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");

const decodeCursor = (cursor: string): TransactionCursor => {
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<TransactionCursor>;
    const sequence = decoded.sequence;
    if (
      decoded.kind !== "activity-transactions" ||
      !Number.isSafeInteger(sequence) ||
      (sequence ?? 0) < 1
    ) {
      throw new InvalidActivityCursorError();
    }
    return { kind: "activity-transactions", sequence: sequence as number };
  } catch (error) {
    if (error instanceof InvalidActivityCursorError) throw error;
    throw new InvalidActivityCursorError();
  }
};

const rowToTransaction = (row: SQLiteRow): StoredActivityTransaction => ({
  id: row.id as string,
  sequence: Number(row.sequence),
  kind: row.kind as string,
  ...((row.resource_id as string | null) !== null
    ? { resourceId: row.resource_id as string }
    : {}),
  operation: row.operation as string,
  ...((row.revision as number | null) !== null
    ? { revision: Number(row.revision) }
    : {}),
  ...((row.change_set_id as string | null) !== null
    ? { changeSetId: row.change_set_id as string }
    : {}),
  ...((row.actor_id as string | null) !== null
    ? { actorId: row.actor_id as string }
    : {}),
  origin: row.origin as StoredActivityTransaction["origin"],
  occurredAt: row.occurred_at as string,
  metadata: decodeJson<Record<string, unknown>>(row.metadata_json),
  publishedAt: row.published_at as string
});

const rowToPresenceLease = (row: SQLiteRow): PresenceLease => ({
  sessionId: row.session_id as string,
  ...((row.actor_id as string | null) !== null
    ? { actorId: row.actor_id as string }
    : {}),
  ...((row.kind as string | null) !== null ? { kind: row.kind as string } : {}),
  ...((row.resource_id as string | null) !== null
    ? { resourceId: row.resource_id as string }
    : {}),
  state: decodeJson<Record<string, unknown>>(row.state_json),
  updatedAt: row.updated_at as string,
  expiresAt: row.expires_at as string
});

/** SQLite implementation of the project-bound Activity store. */
export class SQLiteActivityStore implements ActivityStore {
  private readonly db: DatabaseConnection;
  private readonly tables: ActivityTableNames;

  constructor(projectId: string, dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.tables = createActivityTableNames(projectId);
    initializeActivitySchema(this.db, this.tables);
  }

  close(): void {
    this.db.close();
  }

  async publish(
    transaction: ActivityTransaction,
    publishedAt: string
  ): Promise<StoredActivityTransaction> {
    const digest = digestActivityTransaction(transaction);
    const metadata = canonicalizeMetadata(transaction.metadata);

    return this.db.transaction(() => {
      const existing = this.db
        .prepare(`SELECT * FROM ${this.tables.transactions} WHERE id = ?`)
        .get(transaction.id) as SQLiteRow | undefined;
      if (existing) {
        if (existing.transaction_digest !== digest) {
          throw new ActivityTransactionConflictError(transaction.id);
        }
        return rowToTransaction(existing);
      }

      const sequenceRow = this.db
        .prepare(`SELECT next_sequence FROM ${this.tables.meta} WHERE singleton_key = 'activity'`)
        .get() as { next_sequence: number } | undefined;
      if (!sequenceRow) throw new Error("Activity sequence is not initialized");
      const sequence = Number(sequenceRow.next_sequence);
      const advanced = this.db
        .prepare(`
          UPDATE ${this.tables.meta}
          SET next_sequence = next_sequence + 1
          WHERE singleton_key = 'activity' AND next_sequence = ?
        `)
        .run(sequence);
      if (advanced.changes !== 1) throw new Error("Activity sequence allocation failed");

      this.db
        .prepare(`
          INSERT INTO ${this.tables.transactions}
            (id, sequence, kind, resource_id, operation, revision, change_set_id,
             actor_id, origin, occurred_at, metadata_json, transaction_digest,
             published_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          transaction.id,
          sequence,
          transaction.kind,
          transaction.resourceId ?? null,
          transaction.operation,
          transaction.revision ?? null,
          transaction.changeSetId ?? null,
          transaction.actorId ?? null,
          transaction.origin,
          transaction.occurredAt,
          encodeJson(metadata),
          digest,
          publishedAt
        );

      return {
        ...transaction,
        metadata,
        sequence,
        publishedAt
      };
    })();
  }

  async getTransaction(transactionId: string): Promise<StoredActivityTransaction | undefined> {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.transactions} WHERE id = ?`)
      .get(transactionId) as SQLiteRow | undefined;
    return row ? rowToTransaction(row) : undefined;
  }

  async listTransactions(
    filter: ActivityTransactionFilter = {}
  ): Promise<ActivityTransactionPage> {
    const limit = boundedLimit(filter.limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const cursor = filter.cursor ? decodeCursor(filter.cursor) : undefined;
    const where: string[] = [];
    const parameters: unknown[] = [];

    if (filter.kind !== undefined) {
      where.push("kind = ?");
      parameters.push(filter.kind);
    }
    if (filter.resourceId !== undefined) {
      where.push("resource_id = ?");
      parameters.push(filter.resourceId);
    }
    if (cursor) {
      where.push("sequence < ?");
      parameters.push(cursor.sequence);
    }

    const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const rows = this.db
      .prepare(`
        SELECT * FROM ${this.tables.transactions}
        ${clause}
        ORDER BY sequence DESC, id ASC
        LIMIT ?
      `)
      .all(...parameters, limit + 1) as SQLiteRow[];
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map(rowToTransaction);
    const last = items.at(-1);

    return {
      items,
      ...(hasMore && last
        ? { nextCursor: encodeCursor({ kind: "activity-transactions", sequence: last.sequence }) }
        : {})
    };
  }

  async upsertPresence(
    heartbeat: ActivityPresenceHeartbeat,
    updatedAt: string,
    expiresAt: string
  ): Promise<PresenceLease> {
    const state = canonicalizeMetadata(heartbeat.state);
    this.db
      .prepare(`
        INSERT INTO ${this.tables.presence}
          (session_id, actor_id, kind, resource_id, state_json, updated_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          actor_id = excluded.actor_id,
          kind = excluded.kind,
          resource_id = excluded.resource_id,
          state_json = excluded.state_json,
          updated_at = excluded.updated_at,
          expires_at = excluded.expires_at
      `)
      .run(
        heartbeat.sessionId,
        heartbeat.actorId ?? null,
        heartbeat.kind ?? null,
        heartbeat.resourceId ?? null,
        encodeJson(state),
        updatedAt,
        expiresAt
      );
    return {
      ...heartbeat,
      state,
      updatedAt,
      expiresAt
    };
  }

  async removePresence(sessionId: string): Promise<boolean> {
    return this.db
      .prepare(`DELETE FROM ${this.tables.presence} WHERE session_id = ?`)
      .run(sessionId).changes > 0;
  }

  async listPresence(
    filter: ActivityPresenceFilter = {},
    now: string
  ): Promise<PresenceLease[]> {
    const where = ["expires_at > ?"];
    const parameters: unknown[] = [now];
    if (filter.kind !== undefined) {
      where.push("kind = ?");
      parameters.push(filter.kind);
    }
    if (filter.resourceId !== undefined) {
      where.push("resource_id = ?");
      parameters.push(filter.resourceId);
    }
    const rows = this.db
      .prepare(`
        SELECT * FROM ${this.tables.presence}
        WHERE ${where.join(" AND ")}
        ORDER BY updated_at DESC, session_id ASC
      `)
      .all(...parameters) as SQLiteRow[];
    return rows.map(rowToPresenceLease);
  }

  async removeExpiredPresence(
    now: string,
    limit?: number
  ): Promise<number> {
    const bounded = boundedLimit(
      limit,
      DEFAULT_PRESENCE_CLEANUP_LIMIT,
      MAX_PRESENCE_CLEANUP_LIMIT
    );
    return this.db
      .prepare(`
        DELETE FROM ${this.tables.presence}
        WHERE rowid IN (
          SELECT rowid FROM ${this.tables.presence}
          WHERE expires_at <= ?
          ORDER BY expires_at ASC, session_id ASC
          LIMIT ?
        )
      `)
      .run(now, bounded).changes;
  }
}
