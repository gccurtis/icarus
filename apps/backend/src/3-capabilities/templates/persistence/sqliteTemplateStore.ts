import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database, { type Database as DatabaseConnection } from "better-sqlite3";
import type { TemplateCommittedFact, TemplateRecord } from "../domain/model.js";
import type {
  TemplateClaimOutcome,
  TemplateCommandClaim,
  TemplateFinalizeCommit,
  TemplateStore
} from "../ports/templateStore.js";
import {
  createTemplateTableNames,
  initializeTemplateSchema,
  type TemplateTableNames
} from "./sqliteSchema.js";
import {
  decodeJson,
  encodeJson,
  rowToFact,
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
      .prepare(`SELECT * FROM ${this.tables.templates} WHERE id = ? AND deleted_at IS NULL`)
      .get(id) as SQLiteRow | undefined;
    return row ? rowToTemplate(row) : undefined;
  }

  list(kind?: string): TemplateRecord[] {
    const sql = kind === undefined
      ? `SELECT * FROM ${this.tables.templates}
         WHERE deleted_at IS NULL AND state = 'ready'
         ORDER BY created_at, id`
      : `SELECT * FROM ${this.tables.templates}
         WHERE deleted_at IS NULL AND state = 'ready' AND kind = ?
         ORDER BY created_at, id`;
    const rows = (kind === undefined
      ? this.db.prepare(sql).all()
      : this.db.prepare(sql).all(kind)) as SQLiteRow[];
    return rows.map(rowToTemplate);
  }

  countLive(): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS total FROM ${this.tables.templates} WHERE deleted_at IS NULL`
      )
      .get() as { total: number };
    return row.total;
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
             (id, kind, resource_id, description, state, created_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, NULL)`
        )
        .run(
          record.id,
          record.kind,
          record.resourceId,
          record.description ?? null,
          record.state,
          record.createdAt
        );
      return true;
    } catch (error) {
      if (isUniqueViolation(error)) return false;
      throw error;
    }
  }

  markReady(commit: TemplateFinalizeCommit): void {
    const run = this.db.transaction((input: TemplateFinalizeCommit) => {
      this.db
        .prepare(`UPDATE ${this.tables.templates} SET state = 'ready' WHERE id = ?`)
        .run(input.templateId);
      this.insertFact(input.fact);
    });
    run(commit);
  }

  softDelete(commit: TemplateFinalizeCommit): void {
    const run = this.db.transaction((input: TemplateFinalizeCommit) => {
      this.db
        .prepare(`UPDATE ${this.tables.templates} SET deleted_at = ? WHERE id = ?`)
        .run(input.at, input.templateId);
      this.insertFact(input.fact);
    });
    run(commit);
  }

  deleteReservation(id: string): void {
    this.db
      .prepare(`DELETE FROM ${this.tables.templates} WHERE id = ? AND state = 'reserving'`)
      .run(id);
  }

  listUnpublishedFacts(limit = DEFAULT_OUTBOX_LIMIT): TemplateCommittedFact[] {
    const bounded = Math.min(Math.max(1, limit), MAX_OUTBOX_LIMIT);
    const rows = this.db
      .prepare(
        `SELECT * FROM ${this.tables.activityOutbox}
         WHERE published_at IS NULL
         ORDER BY occurred_at, fact_id
         LIMIT ?`
      )
      .all(bounded) as SQLiteRow[];
    return rows.map(rowToFact);
  }

  markFactPublished(factId: string, publishedAt: string): void {
    this.db
      .prepare(
        `UPDATE ${this.tables.activityOutbox} SET published_at = ? WHERE fact_id = ?`
      )
      .run(publishedAt, factId);
  }

  /**
   * OR IGNORE because fact IDs are derived from the request, not generated. A
   * resumed command re-presents the same fact and must not append a duplicate.
   */
  private insertFact(fact: TemplateCommittedFact): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO ${this.tables.activityOutbox}
           (fact_id, kind, template_id, resource_kind, resource_id, actor_id,
            occurred_at, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`
      )
      .run(
        fact.factId,
        fact.kind,
        fact.templateId,
        fact.resourceKind,
        fact.resourceId,
        fact.actorId ?? null,
        fact.occurredAt
      );
  }
}
