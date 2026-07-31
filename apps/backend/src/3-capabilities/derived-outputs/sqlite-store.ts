// SQLite implementation of DerivedOutputStore.
// Table prefix = SHA-256(projectId).slice(0, 16).
// Pattern follows SQLiteDataStore and SQLiteContextStore.

import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database, { type Database as DB } from "better-sqlite3";
import type {
  DerivedOutput,
  DerivedOutputDefinition,
  DerivedOutputRevision,
  DerivedOutputFreshness,
  DerivedEvidence,
  DerivedEvidenceSpan,
  DerivedOutputKind,
  DerivedOutputStatus,
  RefreshAttempt
} from "./domain/model.js";
import type { DerivedOutputStore } from "./store.js";

const tablePrefix = (projectId: string): string =>
  createHash("sha256").update(projectId).digest("hex").slice(0, 16);

function createSchema(db: DB, prefix: string): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS do_${prefix}_outputs (
      id                           TEXT    PRIMARY KEY,
      kind                         TEXT    NOT NULL,
      prompt                       TEXT    NOT NULL,
      context_entries              TEXT    NOT NULL DEFAULT '[]',
      stabilisation_text           TEXT    NOT NULL DEFAULT '',
      definition_revision          INTEGER NOT NULL DEFAULT 1,
      head_revision                INTEGER NOT NULL DEFAULT 0,
      freshness_state              TEXT    NOT NULL DEFAULT 'current',
      freshness_last_checked_at    TEXT,
      freshness_stale_since        TEXT,
      freshness_diagnostic_code    TEXT,
      freshness_diagnostic_message TEXT,
      created_at                   TEXT    NOT NULL,
      updated_at                   TEXT    NOT NULL
    );

    CREATE TABLE IF NOT EXISTS do_${prefix}_revisions (
      output_id            TEXT    NOT NULL,
      revision             INTEGER NOT NULL,
      definition_revision  INTEGER NOT NULL,
      content_text         TEXT    NOT NULL,
      evidence_json        TEXT    NOT NULL DEFAULT '[]',
      status               TEXT    NOT NULL,
      created_at           TEXT    NOT NULL,
      PRIMARY KEY (output_id, revision)
    );

    CREATE TABLE IF NOT EXISTS do_${prefix}_refresh_attempts (
      id                           TEXT PRIMARY KEY,
      output_id                    TEXT NOT NULL,
      frozen_definition_revision   INTEGER NOT NULL,
      frozen_context_digest        TEXT NOT NULL,
      candidate_revision           INTEGER,
      candidate_status             TEXT,
      settled                      INTEGER NOT NULL DEFAULT 0,
      discarded_reason             TEXT,
      usage_prompt_tokens          INTEGER NOT NULL DEFAULT 0,
      usage_completion_tokens      INTEGER NOT NULL DEFAULT 0,
      usage_total_tokens           INTEGER NOT NULL DEFAULT 0,
      usage_reasoning_tokens       INTEGER NOT NULL DEFAULT 0,
      started_at                   TEXT NOT NULL,
      completed_at                 TEXT
    );
  `);
}

// ─── Row mappers ────────────────────────────────────────────────────────────

function rowToOutput(row: Record<string, unknown>): DerivedOutput {
  const definition: DerivedOutputDefinition = {
    prompt: row.prompt as string,
    contextEntries: JSON.parse(row.context_entries as string),
    stabilisationText: row.stabilisation_text as string,
    definitionRevision: row.definition_revision as number
  };

  const freshness: DerivedOutputFreshness = {
    state: row.freshness_state as DerivedOutputFreshness["state"],
    lastCheckedAt: (row.freshness_last_checked_at as string) ?? null,
    staleSince: (row.freshness_stale_since as string) ?? undefined,
    diagnostic:
      row.freshness_diagnostic_code
        ? {
            code: row.freshness_diagnostic_code as string,
            message: row.freshness_diagnostic_message as string
          }
        : undefined
  };

  return {
    id: row.id as string,
    kind: row.kind as DerivedOutputKind,
    definition,
    headRevision: row.head_revision as number,
    freshness,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  };
}

function rowToRevision(row: Record<string, unknown>): DerivedOutputRevision {
  return {
    outputId: row.output_id as string,
    revision: row.revision as number,
    definitionRevision: row.definition_revision as number,
    content: row.content_text as string,
    evidence: JSON.parse(row.evidence_json as string) as DerivedEvidence[],
    status: row.status as DerivedOutputStatus,
    createdAt: row.created_at as string
  };
}

export class SQLiteDerivedOutputStore implements DerivedOutputStore {
  private readonly db: DB;
  private readonly prefix: string;

  constructor(projectId: string, dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.prefix = tablePrefix(projectId);
    createSchema(this.db, this.prefix);
  }

  // ── Output CRUD ──────────────────────────────────────────────────────────

  getOutput(id: string): DerivedOutput | null {
    const row = this.db
      .prepare(`SELECT * FROM do_${this.prefix}_outputs WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined;
    return row ? rowToOutput(row) : null;
  }

  insertOutput(output: DerivedOutput): void {
    const d = output.definition;
    const f = output.freshness;
    this.db
      .prepare(`
        INSERT INTO do_${this.prefix}_outputs
          (id, kind, prompt, context_entries, stabilisation_text,
           definition_revision, head_revision,
           freshness_state, freshness_last_checked_at,
           freshness_stale_since, freshness_diagnostic_code,
           freshness_diagnostic_message,
           created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        output.id,
        output.kind,
        d.prompt,
        JSON.stringify(d.contextEntries),
        d.stabilisationText,
        d.definitionRevision,
        output.headRevision,
        f.state,
        f.lastCheckedAt,
        f.staleSince ?? null,
        f.diagnostic?.code ?? null,
        f.diagnostic?.message ?? null,
        output.createdAt,
        output.updatedAt
      );
  }

  updateOutputHead(id: string, headRevision: number): void {
    this.db
      .prepare(
        `UPDATE do_${this.prefix}_outputs SET head_revision = ?, updated_at = ? WHERE id = ?`
      )
      .run(headRevision, new Date().toISOString(), id);
  }

  updateOutputDefinition(
    id: string,
    prompt: string,
    contextEntriesJson: string,
    stabilisationText: string,
    definitionRevision: number
  ): void {
    this.db
      .prepare(`
        UPDATE do_${this.prefix}_outputs
        SET prompt = ?, context_entries = ?, stabilisation_text = ?,
            definition_revision = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(
        prompt,
        contextEntriesJson,
        stabilisationText,
        definitionRevision,
        new Date().toISOString(),
        id
      );
  }

  updateOutputFreshness(
    id: string,
    state: string,
    lastCheckedAt: string,
    staleSince: string | null,
    diagnosticCode: string | null,
    diagnosticMessage: string | null
  ): void {
    this.db
      .prepare(`
        UPDATE do_${this.prefix}_outputs
        SET freshness_state = ?, freshness_last_checked_at = ?,
            freshness_stale_since = ?,
            freshness_diagnostic_code = ?,
            freshness_diagnostic_message = ?,
            updated_at = ?
        WHERE id = ?
      `)
      .run(
        state,
        lastCheckedAt,
        staleSince,
        diagnosticCode,
        diagnosticMessage,
        new Date().toISOString(),
        id
      );
  }

  deleteOutput(id: string): void {
    this.db
      .prepare(`DELETE FROM do_${this.prefix}_outputs WHERE id = ?`)
      .run(id);
    // Cascade: remove revisions and attempts for this output.
    this.db
      .prepare(`DELETE FROM do_${this.prefix}_revisions WHERE output_id = ?`)
      .run(id);
    this.db
      .prepare(`DELETE FROM do_${this.prefix}_refresh_attempts WHERE output_id = ?`)
      .run(id);
  }

  // ── Revision CRUD ────────────────────────────────────────────────────────

  getRevision(outputId: string, revision: number): DerivedOutputRevision | null {
    const row = this.db
      .prepare(
        `SELECT * FROM do_${this.prefix}_revisions WHERE output_id = ? AND revision = ?`
      )
      .get(outputId, revision) as Record<string, unknown> | undefined;
    return row ? rowToRevision(row) : null;
  }

  getHeadRevision(outputId: string): DerivedOutputRevision | null {
    const row = this.db
      .prepare(
        `SELECT * FROM do_${this.prefix}_revisions WHERE output_id = ? ORDER BY revision DESC LIMIT 1`
      )
      .get(outputId) as Record<string, unknown> | undefined;
    return row ? rowToRevision(row) : null;
  }

  insertRevision(revision: DerivedOutputRevision): void {
    this.db
      .prepare(`
        INSERT INTO do_${this.prefix}_revisions
          (output_id, revision, definition_revision, content_text,
           evidence_json, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        revision.outputId,
        revision.revision,
        revision.definitionRevision,
        revision.content,
        JSON.stringify(revision.evidence),
        revision.status,
        revision.createdAt
      );
  }

  // ── Refresh attempts ─────────────────────────────────────────────────────

  insertAttempt(attempt: RefreshAttempt): void {
    this.db
      .prepare(`
        INSERT INTO do_${this.prefix}_refresh_attempts
          (id, output_id, frozen_definition_revision, frozen_context_digest,
           settled, usage_prompt_tokens, usage_completion_tokens,
           usage_total_tokens, usage_reasoning_tokens,
           started_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        attempt.id,
        attempt.outputId,
        attempt.frozenDefinitionRevision,
        attempt.frozenContextDigest,
        attempt.settled ? 1 : 0,
        attempt.usagePromptTokens,
        attempt.usageCompletionTokens,
        attempt.usageTotalTokens,
        attempt.usageReasoningTokens,
        attempt.startedAt
      );
  }

  updateAttemptResult(
    id: string,
    candidateRevision: number | null,
    candidateStatus: string | null,
    settled: boolean,
    discardedReason: string | null,
    usagePromptTokens: number,
    usageCompletionTokens: number,
    usageTotalTokens: number,
    usageReasoningTokens: number,
    completedAt: string
  ): void {
    this.db
      .prepare(`
        UPDATE do_${this.prefix}_refresh_attempts
        SET candidate_revision = ?, candidate_status = ?,
            settled = ?,
            discarded_reason = ?,
            usage_prompt_tokens = ?,
            usage_completion_tokens = ?,
            usage_total_tokens = ?,
            usage_reasoning_tokens = ?,
            completed_at = ?
        WHERE id = ?
      `)
      .run(
        candidateRevision,
        candidateStatus,
        settled ? 1 : 0,
        discardedReason,
        usagePromptTokens,
        usageCompletionTokens,
        usageTotalTokens,
        usageReasoningTokens,
        completedAt,
        id
      );
  }
}