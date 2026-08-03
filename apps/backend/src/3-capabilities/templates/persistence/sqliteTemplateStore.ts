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
import { InvalidTemplateCursorError } from "../domain/errors.js";
import type {
  TemplateCommittedTransaction,
  TemplateListFilter,
  TemplateRecord
} from "../domain/model.js";
import type {
  TemplateCommandReceipt,
  TemplateCreateCommit,
  TemplateFinalizeCommit,
  TemplateListPage,
  TemplateStore,
  TemplateUpdateCommit
} from "../ports/templateStore.js";
import {
  createTemplateTableNames,
  initializeTemplateSchema,
  type TemplateTableNames
} from "./sqliteSchema.js";
import {
  encodeJson,
  rowToReceipt,
  rowToTransaction,
  rowToTemplate,
  type SQLiteRow
} from "./sqliteMappers.js";

const DEFAULT_OUTBOX_LIMIT = 100;
const MAX_OUTBOX_LIMIT = 1_000;

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

const CURSOR_KIND = "template-catalog";

interface CatalogCursor {
  readonly kind: typeof CURSOR_KIND;
  readonly createdAt: string;
  readonly id: string;
}

const boundedLimit = (value: number | undefined): number =>
  value === undefined
    ? DEFAULT_PAGE_SIZE
    : Math.min(Math.max(1, Math.trunc(value)), MAX_PAGE_SIZE);

/**
 * `%` and `_` are LIKE wildcards, so a term containing either has to be escaped
 * or it stops being a substring search. `\` is escaped first, or it would
 * escape the escapes this adds.
 */
const escapeLikeTerm = (term: string): string =>
  term.replace(/[\\%_]/g, (character) => `\\${character}`);

const encodeCursor = (cursor: Omit<CatalogCursor, "kind">): string =>
  Buffer.from(JSON.stringify({ kind: CURSOR_KIND, ...cursor }), "utf8").toString("base64url");

/**
 * The `kind` tag is what makes a cursor from another capability's listing fail
 * loudly here instead of decoding into a plausible-looking position.
 */
const decodeCursor = (cursor: string): CatalogCursor => {
  let decoded: Partial<CatalogCursor>;
  try {
    decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<CatalogCursor>;
  } catch {
    throw new InvalidTemplateCursorError();
  }
  if (
    decoded.kind !== CURSOR_KIND ||
    typeof decoded.createdAt !== "string" ||
    typeof decoded.id !== "string"
  ) {
    throw new InvalidTemplateCursorError();
  }
  return { kind: CURSOR_KIND, createdAt: decoded.createdAt, id: decoded.id };
};

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

  list(filter: TemplateListFilter = {}): TemplateListPage {
    const pageSize = boundedLimit(filter.limit);
    const clauses: string[] = [];
    const parameters: unknown[] = [];

    if (filter.kinds !== undefined) {
      // An explicit empty list means "no kinds", which matches nothing. Left as
      // a real answer rather than normalised to "every kind": a caller that
      // filtered everything out should see nothing, not the whole catalog.
      if (filter.kinds.length === 0) return { items: [] };
      clauses.push(`kind IN (${filter.kinds.map(() => "?").join(", ")})`);
      parameters.push(...filter.kinds);
    }
    if (filter.search !== undefined && filter.search.length > 0) {
      // NOCASE on both, and the term is escaped: without ESCAPE a search for
      // "50%" or "a_b" would silently become a wildcard and match far too much.
      clauses.push(
        `(name LIKE ? ESCAPE '\\' COLLATE NOCASE
          OR (description IS NOT NULL AND description LIKE ? ESCAPE '\\' COLLATE NOCASE))`
      );
      const term = `%${escapeLikeTerm(filter.search)}%`;
      parameters.push(term, term);
    }
    if (filter.cursor !== undefined) {
      const after = decodeCursor(filter.cursor);
      clauses.push("(created_at > ? OR (created_at = ? AND id > ?))");
      parameters.push(after.createdAt, after.createdAt, after.id);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .prepare(
        `SELECT * FROM ${this.tables.templates}
         ${where}
         ORDER BY created_at, id
         LIMIT ?`
      )
      // One extra row rather than a second COUNT query: its presence is the
      // only thing "is there another page" needs to know.
      .all(...parameters, pageSize + 1) as SQLiteRow[];

    const hasMore = rows.length > pageSize;
    const items = (hasMore ? rows.slice(0, pageSize) : rows).map(rowToTemplate);
    const last = items[items.length - 1];
    return hasMore && last
      ? { items, nextCursor: encodeCursor({ createdAt: last.createdAt, id: last.id }) }
      : { items };
  }

  getReceipt(requestId: string): TemplateCommandReceipt | undefined {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.commandReceipts} WHERE request_id = ?`)
      .get(requestId) as SQLiteRow | undefined;
    return row ? rowToReceipt(row) : undefined;
  }

  recordReceipt(receipt: TemplateCommandReceipt): void {
    this.insertReceipt(receipt);
  }

  create(commit: TemplateCreateCommit): boolean {
    const run = this.db.transaction((input: TemplateCreateCommit) => {
      const record = input.record;
      this.db
        .prepare(
          `INSERT INTO ${this.tables.templates}
             (id, kind, resource_id, name, description, context_bindings_json,
              revision, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          record.id,
          record.kind,
          record.resourceId,
          record.name,
          record.description ?? null,
          encodeJson(record.contextBindings),
          record.revision,
          record.createdAt,
          record.updatedAt
        );
      this.insertReceipt(input.receipt);
      this.insertTransaction(input.transaction);
    });
    // The catch is outside the transaction on purpose: better-sqlite3 rolls the
    // whole thing back and rethrows, so by the time we see the violation none of
    // the three writes survives.
    try {
      run(commit);
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
        `SELECT * FROM ${this.tables.templates} WHERE id = ?`
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

      this.insertReceipt(input.receipt);
      this.insertTransaction(input.transaction);
      return true;
    });
    return run(commit);
  }

  delete(commit: TemplateFinalizeCommit): void {
    const run = this.db.transaction((input: TemplateFinalizeCommit) => {
      const row = this.db.prepare(
        `SELECT * FROM ${this.tables.templates} WHERE id = ?`
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
      this.insertReceipt(input.receipt);
      this.insertTransaction(input.transaction);
    });
    run(commit);
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
   * OR IGNORE for the same reason as insertTransaction below: a command that
   * committed its receipt inside its own transaction is written again by the
   * service's generic path, and the second write must be a no-op rather than a
   * primary-key violation. First write wins, which is also the right answer for
   * a divergent reuse — the committed result is the authoritative one.
   */
  private insertReceipt(receipt: TemplateCommandReceipt): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO ${this.tables.commandReceipts}
           (request_id, request_digest, command_type, result_json, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        receipt.requestId,
        receipt.requestDigest,
        receipt.commandType,
        encodeJson(receipt.result),
        receipt.createdAt
      );
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
