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
  DerivedRefreshResult,
  DerivedOutputFreshness,
  DerivedEvidence,
  DerivedEvidenceSpan,
  DerivedOutputKind,
  DerivedOutputStatus,
  RefreshAttempt
} from "./domain/model.js";
import type {
  DerivedOutputStore,
  DerivedOutputDeclarationClaim,
  DerivedOutputDefinitionUpdateClaim,
  DerivedOutputRefreshClaim,
  FailRefreshInput,
  FailRefreshResult,
  KnowledgeInvalidationResult,
  SettleRefreshInput,
  SettleRefreshResult,
  UpdateOutputDefinitionInput,
  UpdateOutputDefinitionResult
} from "./store.js";

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

    CREATE TABLE IF NOT EXISTS do_${prefix}_runtime_state (
      singleton             INTEGER PRIMARY KEY CHECK (singleton = 1),
      knowledge_generation  INTEGER NOT NULL DEFAULT 0
        CHECK (knowledge_generation >= 0)
    );

    INSERT OR IGNORE INTO do_${prefix}_runtime_state
      (singleton, knowledge_generation)
    VALUES (1, 0);

    CREATE TABLE IF NOT EXISTS do_${prefix}_declarations (
      idempotency_key TEXT PRIMARY KEY
        CHECK (length(trim(idempotency_key)) > 0 AND length(idempotency_key) <= 512),
      request_digest  TEXT NOT NULL
        CHECK (length(request_digest) = 64 AND request_digest NOT GLOB '*[^0-9a-f]*'),
      output_id       TEXT NOT NULL UNIQUE,
      created_at      TEXT NOT NULL,
      FOREIGN KEY (output_id)
        REFERENCES do_${prefix}_outputs(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS do_${prefix}_refresh_claims (
      idempotency_key TEXT PRIMARY KEY
        CHECK (length(trim(idempotency_key)) > 0 AND length(idempotency_key) <= 512),
      request_digest  TEXT NOT NULL
        CHECK (length(request_digest) = 64 AND request_digest NOT GLOB '*[^0-9a-f]*'),
      output_id       TEXT NOT NULL,
      result_json     TEXT,
      created_at      TEXT NOT NULL,
      completed_at    TEXT,
      CHECK ((result_json IS NULL) = (completed_at IS NULL)),
      FOREIGN KEY (output_id)
        REFERENCES do_${prefix}_outputs(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS do_${prefix}_refresh_claims_output
      ON do_${prefix}_refresh_claims(output_id, created_at);

    CREATE TABLE IF NOT EXISTS do_${prefix}_definition_update_claims (
      idempotency_key TEXT PRIMARY KEY
        CHECK (length(trim(idempotency_key)) > 0 AND length(idempotency_key) <= 512),
      request_digest  TEXT NOT NULL
        CHECK (length(request_digest) = 64 AND request_digest NOT GLOB '*[^0-9a-f]*'),
      output_id       TEXT NOT NULL,
      result_json     TEXT,
      created_at      TEXT NOT NULL,
      completed_at    TEXT,
      CHECK ((result_json IS NULL) = (completed_at IS NULL)),
      FOREIGN KEY (output_id)
        REFERENCES do_${prefix}_outputs(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS do_${prefix}_definition_update_claims_output
      ON do_${prefix}_definition_update_claims(output_id, created_at);

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
  const evidence = JSON.parse(row.evidence_json as string) as DerivedEvidence[];
  return {
    outputId: row.output_id as string,
    revision: row.revision as number,
    definitionRevision: row.definition_revision as number,
    content: row.content_text as string,
    // Legacy rows called these JavaScript string offsets "bytes". They were
    // always UTF-16 offsets, so normalise the label on read.
    evidence: evidence.map((item) => ({
      ...item,
      span: (item.span as { kind?: string }).kind === "bytes"
        ? {
            ...(item.span as unknown as { start: number; end: number }),
            kind: "characters" as const
          }
        : item.span
    })),
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
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("busy_timeout = 5000");
    this.db.pragma("foreign_keys = ON");
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

  claimDeclaration(
    candidate: DerivedOutput,
    idempotencyKey: string,
    requestDigest: string
  ): DerivedOutputDeclarationClaim {
    const claim = this.db.transaction((): DerivedOutputDeclarationClaim => {
      const existing = this.db.prepare(`
        SELECT request_digest, output_id
        FROM do_${this.prefix}_declarations
        WHERE idempotency_key = ?
      `).get(idempotencyKey) as {
        request_digest: string;
        output_id: string;
      } | undefined;

      if (existing) {
        const output = this.getOutput(existing.output_id);
        if (!output) {
          throw new Error(
            `Derived output declaration '${idempotencyKey}' references a missing output`
          );
        }
        return {
          output,
          requestDigest: existing.request_digest,
          created: false
        };
      }

      this.insertOutput(candidate);
      this.db.prepare(`
        INSERT INTO do_${this.prefix}_declarations
          (idempotency_key, request_digest, output_id, created_at)
        VALUES (?, ?, ?, ?)
      `).run(
        idempotencyKey,
        requestDigest,
        candidate.id,
        candidate.createdAt
      );
      return { output: candidate, requestDigest, created: true };
    });

    return claim.immediate();
  }

  claimRefresh(
    outputId: string,
    idempotencyKey: string,
    requestDigest: string,
    createdAt: string
  ): DerivedOutputRefreshClaim {
    return this.db.transaction((): DerivedOutputRefreshClaim => {
      const existing = this.db.prepare(`
        SELECT request_digest, result_json
        FROM do_${this.prefix}_refresh_claims
        WHERE idempotency_key = ?
      `).get(idempotencyKey) as {
        request_digest: string;
        result_json: string | null;
      } | undefined;

      if (existing) {
        return {
          requestDigest: existing.request_digest,
          ...(existing.result_json !== null
            ? { result: JSON.parse(existing.result_json) as DerivedRefreshResult }
            : {}),
          created: false
        };
      }

      this.db.prepare(`
        INSERT INTO do_${this.prefix}_refresh_claims
          (idempotency_key, request_digest, output_id, result_json,
           created_at, completed_at)
        VALUES (?, ?, ?, NULL, ?, NULL)
      `).run(idempotencyKey, requestDigest, outputId, createdAt);
      return { requestDigest, created: true };
    }).immediate();
  }

  claimDefinitionUpdate(
    outputId: string,
    idempotencyKey: string,
    requestDigest: string,
    createdAt: string
  ): DerivedOutputDefinitionUpdateClaim {
    return this.db.transaction((): DerivedOutputDefinitionUpdateClaim => {
      const existing = this.db.prepare(`
        SELECT request_digest, result_json
        FROM do_${this.prefix}_definition_update_claims
        WHERE idempotency_key = ?
      `).get(idempotencyKey) as {
        request_digest: string;
        result_json: string | null;
      } | undefined;

      if (existing) {
        return {
          requestDigest: existing.request_digest,
          ...(existing.result_json !== null
            ? { result: JSON.parse(existing.result_json) as DerivedOutput }
            : {}),
          created: false
        };
      }

      this.db.prepare(`
        INSERT INTO do_${this.prefix}_definition_update_claims
          (idempotency_key, request_digest, output_id, result_json,
           created_at, completed_at)
        VALUES (?, ?, ?, NULL, ?, NULL)
      `).run(idempotencyKey, requestDigest, outputId, createdAt);
      return { requestDigest, created: true };
    }).immediate();
  }

  updateOutputDefinition(
    input: UpdateOutputDefinitionInput
  ): UpdateOutputDefinitionResult {
    return this.db.transaction((): UpdateOutputDefinitionResult => {
      if (input.idempotencyKey) {
        const replay = this.completedDefinitionUpdate(
          input.idempotencyKey,
          input.outputId
        );
        if (replay) return { state: "updated", output: replay };
      }

      const row = this.db.prepare(`
        SELECT definition_revision
        FROM do_${this.prefix}_outputs
        WHERE id = ?
      `).get(input.outputId) as { definition_revision: number } | undefined;
      if (!row) return { state: "not_found" };
      if (row.definition_revision !== input.expectedDefinitionRevision) {
        return {
          state: "stale",
          actualDefinitionRevision: row.definition_revision
        };
      }

      const result = this.db.prepare(`
        UPDATE do_${this.prefix}_outputs
        SET prompt = ?, context_entries = ?, stabilisation_text = ?,
            definition_revision = definition_revision + 1,
            freshness_state = 'stale',
            freshness_last_checked_at = ?,
            freshness_stale_since = ?,
            freshness_diagnostic_code = NULL,
            freshness_diagnostic_message = NULL,
            updated_at = ?
        WHERE id = ? AND definition_revision = ?
      `).run(
        input.prompt,
        input.contextEntriesJson,
        input.stabilisationText,
        input.updatedAt,
        input.updatedAt,
        input.updatedAt,
        input.outputId,
        input.expectedDefinitionRevision
      );
      if (result.changes !== 1) {
        throw new Error("Derived definition CAS changed an unexpected row count");
      }
      const output = this.getOutput(input.outputId)!;
      return {
        state: "updated",
        output: this.completeDefinitionUpdateClaim(
          input.idempotencyKey,
          output,
          input.updatedAt
        )
      };
    }).immediate();
  }

  deleteOutput(id: string): boolean {
    return this.db.transaction((): boolean => {
      const exists = this.db.prepare(`
        SELECT 1 FROM do_${this.prefix}_outputs WHERE id = ?
      `).get(id);
      if (!exists) return false;

      this.db.prepare(`
        DELETE FROM do_${this.prefix}_declarations WHERE output_id = ?
      `).run(id);
      this.db.prepare(`
        DELETE FROM do_${this.prefix}_refresh_claims WHERE output_id = ?
      `).run(id);
      this.db.prepare(`
        DELETE FROM do_${this.prefix}_definition_update_claims WHERE output_id = ?
      `).run(id);
      this.db.prepare(`
        DELETE FROM do_${this.prefix}_revisions WHERE output_id = ?
      `).run(id);
      this.db.prepare(`
        DELETE FROM do_${this.prefix}_refresh_attempts WHERE output_id = ?
      `).run(id);
      const result = this.db.prepare(`
        DELETE FROM do_${this.prefix}_outputs WHERE id = ?
      `).run(id);
      if (result.changes !== 1) {
        throw new Error("Derived output deletion changed an unexpected row count");
      }
      return true;
    }).immediate();
  }

  // ── Knowledge invalidation ──────────────────────────────────────────────

  getKnowledgeGeneration(): number {
    const row = this.db.prepare(`
      SELECT knowledge_generation
      FROM do_${this.prefix}_runtime_state
      WHERE singleton = 1
    `).get() as { knowledge_generation: number };
    return row.knowledge_generation;
  }

  markAllOutputsStaleForKnowledgeChange(
    changedAt: string
  ): KnowledgeInvalidationResult {
    return this.db.transaction((): KnowledgeInvalidationResult => {
      this.db.prepare(`
        UPDATE do_${this.prefix}_runtime_state
        SET knowledge_generation = knowledge_generation + 1
        WHERE singleton = 1
      `).run();
      const stale = this.db.prepare(`
        UPDATE do_${this.prefix}_outputs
        SET freshness_state = 'stale',
            freshness_stale_since = COALESCE(freshness_stale_since, ?),
            freshness_diagnostic_code = NULL,
            freshness_diagnostic_message = NULL,
            updated_at = ?
      `).run(changedAt, changedAt);
      return {
        generation: this.getKnowledgeGeneration(),
        outputsMarkedStale: stale.changes
      };
    }).immediate();
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

  private insertRevision(revision: DerivedOutputRevision): void {
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

  settleRefresh(input: SettleRefreshInput): SettleRefreshResult {
    if (
      input.revision.outputId !== input.outputId ||
      input.revision.definitionRevision !== input.expectedDefinitionRevision ||
      input.revision.revision !== input.expectedHeadRevision + 1
    ) {
      throw new Error("Refresh candidate does not match its frozen output state");
    }
    return this.db.transaction((): SettleRefreshResult => {
      const row = this.db
        .prepare(`SELECT * FROM do_${this.prefix}_outputs WHERE id = ?`)
        .get(input.outputId) as Record<string, unknown> | undefined;

      if (!row) {
        this.settleAttempt(input, false, "output_deleted");
        return {
          state: "output_deleted",
          output: null,
          result: this.completeRefreshClaim(
            input.idempotencyKey,
            { output: input.fallbackOutput, skipped: true },
            input.completedAt
          )
        };
      }

      const output = rowToOutput(row);
      if (
        output.definition.definitionRevision !==
        input.expectedDefinitionRevision
      ) {
        this.settleAttempt(input, false, "definition_changed");
        return {
          state: "definition_changed",
          output,
          result: this.completeRefreshClaim(
            input.idempotencyKey,
            { output, skipped: true },
            input.completedAt
          )
        };
      }

      if (output.headRevision !== input.expectedHeadRevision) {
        this.settleAttempt(input, false, "head_changed");
        return {
          state: "head_changed",
          output,
          result: this.completeRefreshClaim(
            input.idempotencyKey,
            { output, skipped: true },
            input.completedAt
          )
        };
      }

      if (this.getKnowledgeGeneration() !== input.expectedKnowledgeGeneration) {
        this.settleAttempt(input, false, "knowledge_changed");
        return {
          state: "knowledge_changed",
          output,
          result: this.completeRefreshClaim(
            input.idempotencyKey,
            { output, skipped: true },
            input.completedAt
          )
        };
      }

      this.insertRevision(input.revision);
      const published = this.db.prepare(`
        UPDATE do_${this.prefix}_outputs
        SET head_revision = ?,
            stabilisation_text = CASE
              WHEN stabilisation_text = '' THEN ?
              ELSE stabilisation_text
            END,
            freshness_state = 'current',
            freshness_last_checked_at = ?,
            freshness_stale_since = NULL,
            freshness_diagnostic_code = NULL,
            freshness_diagnostic_message = NULL,
            updated_at = ?
        WHERE id = ?
          AND definition_revision = ?
          AND head_revision = ?
      `).run(
        input.revision.revision,
        input.revision.content,
        input.completedAt,
        input.completedAt,
        input.outputId,
        input.expectedDefinitionRevision,
        input.expectedHeadRevision
      );
      if (published.changes !== 1) {
        throw new Error("Derived refresh publish CAS changed an unexpected row count");
      }
      this.settleAttempt(input, true, null);
      const publishedOutput = this.getOutput(input.outputId);
      if (!publishedOutput) {
        throw new Error("Published Derived output disappeared during settlement");
      }
      return {
        state: "published",
        output: publishedOutput,
        result: this.completeRefreshClaim(
          input.idempotencyKey,
          { output: publishedOutput, revision: input.revision, skipped: false },
          input.completedAt
        )
      };
    }).immediate();
  }

  failRefresh(input: FailRefreshInput): FailRefreshResult {
    return this.db.transaction((): FailRefreshResult => {
      const row = this.db
        .prepare(`SELECT * FROM do_${this.prefix}_outputs WHERE id = ?`)
        .get(input.outputId) as Record<string, unknown> | undefined;

      if (!row) {
        this.failAttempt(input, "output_deleted");
        return {
          state: "output_deleted",
          output: null,
          result: this.completeRefreshClaim(
            input.idempotencyKey,
            { output: input.fallbackOutput, skipped: true },
            input.completedAt
          )
        };
      }

      const output = rowToOutput(row);
      if (
        output.definition.definitionRevision !==
        input.expectedDefinitionRevision
      ) {
        this.failAttempt(input, "definition_changed");
        return {
          state: "definition_changed",
          output,
          result: this.completeRefreshClaim(
            input.idempotencyKey,
            { output, skipped: true },
            input.completedAt
          )
        };
      }

      if (output.headRevision !== input.expectedHeadRevision) {
        this.failAttempt(input, "head_changed");
        return {
          state: "head_changed",
          output,
          result: this.completeRefreshClaim(
            input.idempotencyKey,
            { output, skipped: true },
            input.completedAt
          )
        };
      }

      if (this.getKnowledgeGeneration() !== input.expectedKnowledgeGeneration) {
        this.failAttempt(input, "knowledge_changed");
        return {
          state: "knowledge_changed",
          output,
          result: this.completeRefreshClaim(
            input.idempotencyKey,
            { output, skipped: true },
            input.completedAt
          )
        };
      }

      this.failAttempt(input, input.diagnosticCode);
      const markedFailed = this.db.prepare(`
        UPDATE do_${this.prefix}_outputs
        SET freshness_state = 'failed',
            freshness_last_checked_at = ?,
            freshness_stale_since = NULL,
            freshness_diagnostic_code = ?,
            freshness_diagnostic_message = ?,
            updated_at = ?
        WHERE id = ?
          AND definition_revision = ?
          AND head_revision = ?
      `).run(
        input.completedAt,
        input.diagnosticCode,
        input.diagnosticMessage,
        input.completedAt,
        input.outputId,
        input.expectedDefinitionRevision,
        input.expectedHeadRevision
      );
      if (markedFailed.changes !== 1) {
        throw new Error("Derived refresh failure CAS changed an unexpected row count");
      }
      const failedOutput = this.getOutput(input.outputId);
      if (!failedOutput) {
        throw new Error("Failed Derived output disappeared during settlement");
      }
      return {
        state: "failed",
        output: failedOutput,
        result: this.completeRefreshClaim(
          input.idempotencyKey,
          { output: failedOutput, skipped: false },
          input.completedAt
        )
      };
    }).immediate();
  }

  close(): void {
    this.db.close();
  }

  private settleAttempt(
    input: SettleRefreshInput,
    settled: boolean,
    discardedReason: string | null
  ): void {
    this.updateAttemptResult(
      input.attemptId,
      input.revision.revision,
      input.revision.status,
      settled,
      discardedReason,
      input.usage.promptTokens,
      input.usage.completionTokens,
      input.usage.totalTokens,
      input.usage.reasoningTokens,
      input.completedAt
    );
  }

  private failAttempt(input: FailRefreshInput, reason: string): void {
    this.updateAttemptResult(
      input.attemptId,
      null,
      null,
      false,
      reason,
      input.usage.promptTokens,
      input.usage.completionTokens,
      input.usage.totalTokens,
      input.usage.reasoningTokens,
      input.completedAt
    );
  }

  private completeRefreshClaim(
    idempotencyKey: string | undefined,
    result: DerivedRefreshResult,
    completedAt: string
  ): DerivedRefreshResult {
    if (!idempotencyKey) return result;

    const existing = this.db.prepare(`
      SELECT output_id, result_json
      FROM do_${this.prefix}_refresh_claims
      WHERE idempotency_key = ?
    `).get(idempotencyKey) as {
      output_id: string;
      result_json: string | null;
    } | undefined;

    // A concurrent delete cascades the claim. The refresh remains safely
    // skipped, but there is no longer an output-scoped identity to retain.
    if (!existing) return result;
    if (existing.output_id !== result.output.id) {
      throw new Error("Derived refresh claim changed its output identity");
    }
    if (existing.result_json !== null) {
      return JSON.parse(existing.result_json) as DerivedRefreshResult;
    }

    const encoded = JSON.stringify(result);
    const updated = this.db.prepare(`
      UPDATE do_${this.prefix}_refresh_claims
      SET result_json = ?, completed_at = ?
      WHERE idempotency_key = ? AND result_json IS NULL
    `).run(encoded, completedAt, idempotencyKey);
    if (updated.changes !== 1) {
      throw new Error("Derived refresh claim completion changed an unexpected row count");
    }
    // Return the same canonical JSON shape that every later replay reads.
    return JSON.parse(encoded) as DerivedRefreshResult;
  }

  private completedDefinitionUpdate(
    idempotencyKey: string,
    outputId: string
  ): DerivedOutput | undefined {
    const existing = this.db.prepare(`
      SELECT output_id, result_json
      FROM do_${this.prefix}_definition_update_claims
      WHERE idempotency_key = ?
    `).get(idempotencyKey) as {
      output_id: string;
      result_json: string | null;
    } | undefined;
    if (!existing) {
      throw new Error("Derived definition-update claim is missing");
    }
    if (existing.output_id !== outputId) {
      throw new Error("Derived definition-update claim changed its output identity");
    }
    return existing.result_json === null
      ? undefined
      : JSON.parse(existing.result_json) as DerivedOutput;
  }

  private completeDefinitionUpdateClaim(
    idempotencyKey: string | undefined,
    output: DerivedOutput,
    completedAt: string
  ): DerivedOutput {
    if (!idempotencyKey) return output;

    const replay = this.completedDefinitionUpdate(idempotencyKey, output.id);
    if (replay) return replay;

    const encoded = JSON.stringify(output);
    const updated = this.db.prepare(`
      UPDATE do_${this.prefix}_definition_update_claims
      SET result_json = ?, completed_at = ?
      WHERE idempotency_key = ? AND result_json IS NULL
    `).run(encoded, completedAt, idempotencyKey);
    if (updated.changes !== 1) {
      throw new Error(
        "Derived definition-update claim completion changed an unexpected row count"
      );
    }
    return JSON.parse(encoded) as DerivedOutput;
  }

}
