import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database, { type Database as DatabaseConnection } from "better-sqlite3";
import type {
  SlideAttempt,
  SlideBase,
  SlideChangeSet,
  SlideCommittedFact,
  SlideDelegatedCommandClaim,
  DeckHead,
  SlideLifecycle,
  SlideStageReceipt,
  SlideSubmissionReceipt,
  PromptContentOutputOwnership
} from "../domain/model.js";
import type {
  SlideIdentity,
  SlideIdentityLedgerEntry,
  SlideIdentityReactivation,
  SlideIdentityTransitions
} from "../domain/identities.js";
import {
  SlideIdentityReuseError,
  SlideIdempotencyMismatchError,
  InvalidSlideCursorError
} from "../domain/errors.js";
import type {
  DelegatedCommandClaimResult,
  SlideCreationCommit,
  SlideMutationCommit,
  SlideStore,
  PromptCreationFailureCommit,
  PromptOwnershipTransition,
  StageClaimResult
} from "../ports/slideStore.js";
import {
  attemptToStorageParts,
  encodeJson,
  rowToAttempt,
  rowToBase,
  rowToChangeSet,
  rowToCommittedFact,
  rowToDelegatedCommandClaim,
  rowToHead,
  rowToIdentityLedgerEntry,
  rowToPromptOutputOwnership,
  rowToStageReceipt,
  rowToSubmission,
  type SQLiteRow
} from "./sqliteMappers.js";
import {
  createSlideTableNames,
  initializeSlideSchema,
  type SlideTableNames
} from "./sqliteSchema.js";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const DEFAULT_MAINTENANCE_BATCH_SIZE = 100;
const MAX_MAINTENANCE_BATCH_SIZE = 1000;

interface HeadCursor {
  kind: "deck-head";
  updatedAt: string;
  id: string;
}

interface ChangeCursor {
  kind: "deck-change";
  seq: number;
}

const boundedLimit = (
  value: number | undefined,
  fallback: number,
  maximum: number
): number => {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("Slide store limit must be a positive safe integer");
  }
  return Math.min(value, maximum);
};

const encodeCursor = (value: HeadCursor | ChangeCursor): string =>
  Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

const decodeCursor = <T extends HeadCursor | ChangeCursor>(
  cursor: string,
  kind: T["kind"]
): T => {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new InvalidSlideCursorError();
  }

  if (!value || typeof value !== "object" || (value as { kind?: unknown }).kind !== kind) {
    throw new InvalidSlideCursorError();
  }
  if (kind === "deck-head") {
    const head = value as Partial<HeadCursor>;
    if (
      typeof head.updatedAt !== "string" ||
      head.updatedAt.length === 0 ||
      typeof head.id !== "string" ||
      head.id.length === 0
    ) {
      throw new InvalidSlideCursorError();
    }
  } else {
    const change = value as Partial<ChangeCursor>;
    if (
      typeof change.seq !== "number" ||
      !Number.isSafeInteger(change.seq) ||
      change.seq < 1
    ) {
      throw new InvalidSlideCursorError();
    }
  }
  return value as T;
};

const assertSameDeck = (
  deckId: string,
  values: Array<{ label: string; deckId: string }>
): void => {
  for (const value of values) {
    if (value.deckId !== deckId) {
      throw new Error(
        `${value.label} belongs to '${value.deckId}', expected '${deckId}'`
      );
    }
  }
};

const terminalAttemptStates = ["settled", "unchanged", "stale", "failed"];

export class SQLiteSlideStore implements SlideStore {
  private readonly db: DatabaseConnection;
  private readonly tables: SlideTableNames;

  constructor(projectId: string, dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.tables = createSlideTableNames(projectId);
    initializeSlideSchema(this.db, this.tables);
  }

  close(): void {
    this.db.close();
  }

  async listHeads(
    cursor?: string,
    lifecycle?: SlideLifecycle,
    limit?: number
  ): Promise<{ items: DeckHead[]; nextCursor?: string }> {
    const pageSize = boundedLimit(limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const decoded = cursor
      ? decodeCursor<HeadCursor>(cursor, "deck-head")
      : undefined;
    const clauses: string[] = [];
    const parameters: unknown[] = [];

    if (lifecycle) {
      clauses.push("lifecycle = ?");
      parameters.push(lifecycle);
    }
    if (decoded) {
      clauses.push("(updated_at < ? OR (updated_at = ? AND id > ?))");
      parameters.push(decoded.updatedAt, decoded.updatedAt, decoded.id);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .prepare(`
        SELECT * FROM ${this.tables.decks}
        ${where}
        ORDER BY updated_at DESC, id ASC
        LIMIT ?
      `)
      .all(...parameters, pageSize + 1) as SQLiteRow[];
    const hasMore = rows.length > pageSize;
    const items = rows.slice(0, pageSize).map(rowToHead);
    const last = items.at(-1);

    return {
      items,
      ...(hasMore && last
        ? {
            nextCursor: encodeCursor({
              kind: "deck-head",
              updatedAt: last.updatedAt,
              id: last.id
            })
          }
        : {})
    };
  }

  async getHead(deckId: string): Promise<DeckHead | undefined> {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.decks} WHERE id = ?`)
      .get(deckId) as SQLiteRow | undefined;
    return row ? rowToHead(row) : undefined;
  }

  async getBaseAtOrBefore(
    deckId: string,
    revision: number
  ): Promise<SlideBase | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.bases}
        WHERE deck_id = ? AND base_seq <= ?
        ORDER BY base_seq DESC
        LIMIT 1
      `)
      .get(deckId, revision) as SQLiteRow | undefined;
    return row ? rowToBase(row) : undefined;
  }

  async getChangeSets(
    deckId: string,
    fromExclusive: number,
    toInclusive: number
  ): Promise<SlideChangeSet[]> {
    if (toInclusive <= fromExclusive) return [];
    const rows = this.db
      .prepare(`
        SELECT * FROM ${this.tables.changeSets}
        WHERE deck_id = ? AND seq > ? AND seq <= ?
        ORDER BY seq ASC
      `)
      .all(deckId, fromExclusive, toInclusive) as SQLiteRow[];
    return rows.map(rowToChangeSet);
  }

  async listChangeSets(
    deckId: string,
    cursor?: string,
    limit?: number
  ): Promise<{ items: SlideChangeSet[]; nextCursor?: string }> {
    const pageSize = boundedLimit(limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const decoded = cursor
      ? decodeCursor<ChangeCursor>(cursor, "deck-change")
      : undefined;
    const rows = this.db
      .prepare(`
        SELECT * FROM ${this.tables.changeSets}
        WHERE deck_id = ? ${decoded ? "AND seq < ?" : ""}
        ORDER BY seq DESC
        LIMIT ?
      `)
      .all(
        ...(decoded
          ? [deckId, decoded.seq, pageSize + 1]
          : [deckId, pageSize + 1])
      ) as SQLiteRow[];
    const hasMore = rows.length > pageSize;
    const items = rows.slice(0, pageSize).map(rowToChangeSet);
    const last = items.at(-1);

    return {
      items,
      ...(hasMore && last
        ? {
            nextCursor: encodeCursor({
              kind: "deck-change",
              seq: last.seq
            })
          }
        : {})
    };
  }

  async getChangeSet(
    deckId: string,
    changeSetId: string
  ): Promise<SlideChangeSet | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.changeSets}
        WHERE deck_id = ? AND id = ?
      `)
      .get(deckId, changeSetId) as SQLiteRow | undefined;
    return row ? rowToChangeSet(row) : undefined;
  }

  async getSubmission(
    deckId: string,
    requestId: string
  ): Promise<SlideSubmissionReceipt | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.receipts}
        WHERE deck_id = ? AND request_id = ?
      `)
      .get(deckId, requestId) as SQLiteRow | undefined;
    return row ? rowToSubmission(row) : undefined;
  }

  async getIdentity(
    deckId: string,
    identityId: string
  ): Promise<SlideIdentityLedgerEntry | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.identityLedger}
        WHERE deck_id = ? AND identity_id = ?
      `)
      .get(deckId, identityId) as SQLiteRow | undefined;
    return row ? rowToIdentityLedgerEntry(row) : undefined;
  }

  async recordSubmission(receipt: SlideSubmissionReceipt): Promise<void> {
    this.insertSubmission(receipt);
  }

  async getDelegatedCommandClaim(
    deckId: string,
    requestId: string
  ): Promise<SlideDelegatedCommandClaim | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.delegatedCommandClaims}
        WHERE deck_id = ? AND request_id = ?
      `)
      .get(deckId, requestId) as SQLiteRow | undefined;
    return row ? rowToDelegatedCommandClaim(row) : undefined;
  }

  async claimDelegatedCommand(
    claim: SlideDelegatedCommandClaim
  ): Promise<DelegatedCommandClaimResult> {
    if (claim.state !== "pending") {
      throw new Error("A new delegated Slide command claim must be pending");
    }
    return this.db.transaction(() => {
      const receiptRow = this.db
        .prepare(`
          SELECT * FROM ${this.tables.receipts}
          WHERE deck_id = ? AND request_id = ?
        `)
        .get(claim.deckId, claim.requestId) as SQLiteRow | undefined;
      if (receiptRow) {
        return {
          type: "receipt" as const,
          receipt: rowToSubmission(receiptRow)
        };
      }

      const existingRow = this.db
        .prepare(`
          SELECT * FROM ${this.tables.delegatedCommandClaims}
          WHERE deck_id = ? AND request_id = ?
        `)
        .get(claim.deckId, claim.requestId) as SQLiteRow | undefined;
      if (existingRow) {
        const existing = rowToDelegatedCommandClaim(existingRow);
        this.assertSameDelegatedRequest(existing, claim);
        return { type: "claim" as const, claim: existing };
      }

      this.db
        .prepare(`
          INSERT INTO ${this.tables.delegatedCommandClaims}
            (deck_id, request_id, request_digest, command_kind,
             target_output_id, state, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
        `)
        .run(
          claim.deckId,
          claim.requestId,
          claim.requestDigest,
          claim.kind,
          claim.targetOutputId,
          claim.createdAt,
          claim.updatedAt
        );
      return { type: "claim" as const, claim };
    })();
  }

  async completeDelegatedCommand(
    claim: SlideDelegatedCommandClaim,
    receipt: SlideSubmissionReceipt
  ): Promise<void> {
    if (
      receipt.deckId !== claim.deckId ||
      receipt.requestId !== claim.requestId ||
      receipt.requestDigest !== claim.requestDigest
    ) {
      throw new SlideIdempotencyMismatchError(claim.requestId);
    }

    this.db.transaction(() => {
      const claimRow = this.db
        .prepare(`
          SELECT * FROM ${this.tables.delegatedCommandClaims}
          WHERE deck_id = ? AND request_id = ?
        `)
        .get(claim.deckId, claim.requestId) as SQLiteRow | undefined;
      if (!claimRow) {
        throw new Error(
          `Delegated Slide command was not claimed: ${claim.requestId}`
        );
      }
      const persistedClaim = rowToDelegatedCommandClaim(claimRow);
      this.assertSameDelegatedClaim(persistedClaim, claim);

      const receiptRow = this.db
        .prepare(`
          SELECT * FROM ${this.tables.receipts}
          WHERE deck_id = ? AND request_id = ?
        `)
        .get(claim.deckId, claim.requestId) as SQLiteRow | undefined;
      if (receiptRow) {
        const persistedReceipt = rowToSubmission(receiptRow);
        if (
          persistedReceipt.requestDigest !== receipt.requestDigest ||
          encodeJson(persistedReceipt.result).compare(encodeJson(receipt.result)) !== 0
        ) {
          throw new SlideIdempotencyMismatchError(receipt.requestId);
        }
        if (persistedClaim.state !== "completed") {
          throw new Error(
            "Delegated Slide command receipt exists before claim completion"
          );
        }
        return;
      }
      if (persistedClaim.state === "completed") {
        throw new Error(
          "Completed delegated Slide command is missing its receipt"
        );
      }

      this.insertSubmission(receipt, true);
      const updated = this.db
        .prepare(`
          UPDATE ${this.tables.delegatedCommandClaims}
          SET state = 'completed', updated_at = ?
          WHERE deck_id = ? AND request_id = ? AND state = 'pending'
        `)
        .run(receipt.createdAt, claim.deckId, claim.requestId);
      if (updated.changes !== 1) {
        throw new Error(
          `Delegated Slide command could not complete: ${claim.requestId}`
        );
      }
    })();
  }

  async commitCreation(commit: SlideCreationCommit): Promise<void> {
    assertSameDeck(commit.head.id, [
      { label: "Slide Base", deckId: commit.base.deckId },
      { label: "Slide receipt", deckId: commit.receipt.deckId },
      { label: "Slide fact", deckId: commit.fact.deckId }
    ]);
    if (commit.head.revision !== 0 || commit.base.baseSeq !== 0) {
      throw new Error("Slide creation must commit revision-zero head and Base");
    }

    this.db.transaction(() => {
      this.insertHead(commit.head);
      this.claimInitialIdentities(commit.head.id, commit.identities);
      this.insertBase(commit.base);
      this.insertSubmission(commit.receipt);
      this.insertCommittedFact(commit.fact);
    })();
  }

  async commitMutation(commit: SlideMutationCommit): Promise<boolean> {
    const deckId = commit.head.id;
    assertSameDeck(deckId, [
      { label: "Slide ChangeSet", deckId: commit.changeSet.deckId },
      { label: "Slide receipt", deckId: commit.receipt.deckId },
      { label: "Slide fact", deckId: commit.fact.deckId },
      ...(commit.attempts ?? []).map((attempt) => ({
        label: "Slide attempt",
        deckId: attempt.deckId
      })),
      ...(commit.attemptUpdates ?? []).map((attempt) => ({
        label: "Slide attempt update",
        deckId: attempt.deckId
      })),
      ...(commit.promptOwnershipTransitions ?? []).map((transition) => ({
        label: "Prompt-output ownership transition",
        deckId: transition.deckId
      }))
    ]);

    if (
      commit.changeSet.priorRevision !== commit.expectedRevision ||
      commit.changeSet.revision !== commit.expectedRevision + 1 ||
      commit.head.revision !== commit.changeSet.revision
    ) {
      throw new Error("Slide mutation revisions are inconsistent");
    }
    if (
      commit.identityReactivation === "same-kind-compensation" &&
      !commit.changeSet.compensation
    ) {
      throw new Error(
        "Slide identity reactivation requires a compensation ChangeSet"
      );
    }

    return this.db.transaction(() => {
      const updated = this.db
        .prepare(`
          UPDATE ${this.tables.decks}
          SET title = ?, lifecycle = ?, revision = ?, base_seq = ?,
              semantic_digest = ?, updated_at = ?
          WHERE id = ? AND revision = ?
        `)
        .run(
          commit.head.title,
          commit.head.lifecycle,
          commit.head.revision,
          commit.head.baseSeq,
          commit.head.semanticDigest,
          commit.head.updatedAt,
          deckId,
          commit.expectedRevision
        );

      if (updated.changes !== 1) return false;

      this.applyIdentityTransitions(
        deckId,
        commit.head.revision,
        commit.identityTransitions,
        commit.identityReactivation
      );
      this.insertChangeSet(commit.changeSet);
      for (const attempt of commit.attempts ?? []) {
        this.insertAttempt(attempt);
      }
      for (const attempt of commit.attemptUpdates ?? []) {
        this.updateAttemptRow(attempt);
      }
      for (const transition of commit.promptOwnershipTransitions ?? []) {
        this.updatePromptOutputOwnershipRow(transition);
      }
      this.insertSubmission(commit.receipt);
      this.insertCommittedFact(commit.fact);
      return true;
    })();
  }

  async appendBaseIfHead(
    deckId: string,
    expectedHeadRevision: number,
    base: SlideBase
  ): Promise<boolean> {
    if (base.deckId !== deckId) {
      throw new Error("Slide Base belongs to another Slide");
    }
    if (
      base.baseSeq > expectedHeadRevision ||
      base.snapshot.revision !== base.baseSeq
    ) {
      throw new Error("Slide Base revision is inconsistent");
    }

    return this.db.transaction(() => {
      const head = this.db
        .prepare(`SELECT revision, base_seq FROM ${this.tables.decks} WHERE id = ?`)
        .get(deckId) as
        | { revision: number; base_seq: number }
        | undefined;
      if (!head || Number(head.revision) !== expectedHeadRevision) return false;

      this.db
        .prepare(`
          INSERT INTO ${this.tables.bases}
            (deck_id, base_seq, representation_version, snapshot_json,
             semantic_digest, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(deck_id, base_seq) DO NOTHING
        `)
        .run(
          base.deckId,
          base.baseSeq,
          base.representationVersion,
          encodeJson(base.snapshot),
          base.semanticDigest,
          base.createdAt
        );

      const persisted = this.db
        .prepare(`
          SELECT * FROM ${this.tables.bases}
          WHERE deck_id = ? AND base_seq = ?
        `)
        .get(deckId, base.baseSeq) as SQLiteRow;
      const mapped = rowToBase(persisted);
      if (
        mapped.semanticDigest !== base.semanticDigest ||
        encodeJson(mapped.snapshot).compare(encodeJson(base.snapshot)) !== 0
      ) {
        throw new Error("A different Slide Base already exists at this revision");
      }

      if (base.baseSeq > Number(head.base_seq)) {
        this.db
          .prepare(`
            UPDATE ${this.tables.decks}
            SET base_seq = ?
            WHERE id = ? AND revision = ?
          `)
          .run(base.baseSeq, deckId, expectedHeadRevision);
      }
      return true;
    })();
  }

  async pruneHistory(
    deckId: string,
    retainedBaseCount: number,
    retainedChangeSetCount: number,
    retainedTerminalAttemptCount: number
  ): Promise<void> {
    for (const value of [
      retainedBaseCount,
      retainedChangeSetCount,
      retainedTerminalAttemptCount
    ]) {
      if (!Number.isSafeInteger(value) || value < 1) {
        throw new Error("Slide history retention values must be positive safe integers");
      }
    }

    this.db.transaction(() => {
      const head = this.db
        .prepare(`SELECT revision, base_seq FROM ${this.tables.decks} WHERE id = ?`)
        .get(deckId) as
        | { revision: number; base_seq: number }
        | undefined;
      if (!head) return;

      const revision = Number(head.revision);
      const baseSeq = Number(head.base_seq);
      const changeCutoff = Math.min(
        baseSeq,
        Math.max(0, revision - retainedChangeSetCount)
      );
      const retainedOtherBaseCount = Math.max(
        changeCutoff === baseSeq ? 0 : 1,
        retainedBaseCount - 1
      );

      this.db
        .prepare(`
          DELETE FROM ${this.tables.bases}
          WHERE deck_id = ?
            AND base_seq != ?
            AND base_seq NOT IN (
              SELECT base_seq FROM ${this.tables.bases}
              WHERE deck_id = ? AND base_seq != ?
              ORDER BY base_seq DESC
              LIMIT ?
            )
        `)
        .run(
          deckId,
          changeCutoff,
          deckId,
          changeCutoff,
          retainedOtherBaseCount
        );

      if (changeCutoff > 0) {
        this.db
          .prepare(`
            DELETE FROM ${this.tables.changeSets}
            WHERE deck_id = ? AND seq <= ?
              AND id NOT IN (
                SELECT compensation_target_change_set_id
                FROM ${this.tables.changeSets}
                WHERE compensation_target_change_set_id IS NOT NULL
              )
          `)
          .run(deckId, changeCutoff);
      }

      this.db
        .prepare(`
          DELETE FROM ${this.tables.attempts}
          WHERE deck_id = ?
            AND state IN (${terminalAttemptStates.map(() => "?").join(", ")})
            AND id NOT IN (
              SELECT id FROM ${this.tables.attempts}
              WHERE deck_id = ?
                AND state IN (${terminalAttemptStates.map(() => "?").join(", ")})
              ORDER BY updated_at DESC, id DESC
              LIMIT ?
            )
        `)
        .run(
          deckId,
          ...terminalAttemptStates,
          deckId,
          ...terminalAttemptStates,
          retainedTerminalAttemptCount
        );
    })();
  }

  async getAttempt(
    deckId: string,
    attemptId: string
  ): Promise<SlideAttempt | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.attempts}
        WHERE deck_id = ? AND id = ?
      `)
      .get(deckId, attemptId) as SQLiteRow | undefined;
    return row ? rowToAttempt(row) : undefined;
  }

  async getAttemptById(attemptId: string): Promise<SlideAttempt | undefined> {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.attempts} WHERE id = ?`)
      .get(attemptId) as SQLiteRow | undefined;
    return row ? rowToAttempt(row) : undefined;
  }

  async getAttemptByRequest(
    deckId: string,
    kind: SlideAttempt["kind"],
    requestId: string
  ): Promise<SlideAttempt | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.attempts}
        WHERE deck_id = ? AND kind = ? AND client_request_id = ?
      `)
      .get(deckId, kind, requestId) as SQLiteRow | undefined;
    return row ? rowToAttempt(row) : undefined;
  }

  async getPromptCreationAttemptByShape(
    deckId: string,
    shapeId: string
  ): Promise<SlideAttempt | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.attempts}
        WHERE deck_id = ? AND shape_id = ? AND kind = 'prompt-content-create'
      `)
      .get(deckId, shapeId) as SQLiteRow | undefined;
    return row ? rowToAttempt(row) : undefined;
  }

  async listRecoverableAttempts(): Promise<SlideAttempt[]> {
    const rows = this.db
      .prepare(`
        SELECT * FROM ${this.tables.attempts}
        WHERE state IN ('requested', 'computing', 'proposed')
        ORDER BY updated_at ASC, id ASC
      `)
      .all() as SQLiteRow[];
    return rows.map(rowToAttempt);
  }

  async createAttempt(attempt: SlideAttempt): Promise<void> {
    this.insertAttempt(attempt);
  }

  async createAttemptWithSubmission(
    attempt: SlideAttempt,
    receipt: SlideSubmissionReceipt
  ): Promise<void> {
    assertSameDeck(attempt.deckId, [
      { label: "Slide receipt", deckId: receipt.deckId }
    ]);
    this.db.transaction(() => {
      this.insertAttempt(attempt);
      this.insertSubmission(receipt);
    })();
  }

  async updateAttempt(attempt: SlideAttempt): Promise<void> {
    this.updateAttemptRow(attempt);
  }

  async claimStage(receipt: SlideStageReceipt): Promise<StageClaimResult> {
    return this.db.transaction(() => {
      const existing = this.db
        .prepare(`
          SELECT * FROM ${this.tables.stageReceipts}
          WHERE attempt_id = ? AND stage = ?
        `)
        .get(receipt.attemptId, receipt.stage) as SQLiteRow | undefined;

      if (!existing) {
        const reusedKey = this.db
          .prepare(`
            SELECT attempt_id, stage FROM ${this.tables.stageReceipts}
            WHERE idempotency_key = ?
          `)
          .get(receipt.idempotencyKey) as
          | { attempt_id: string; stage: string }
          | undefined;
        if (reusedKey) {
          throw new Error("Slide stage idempotency key was reused");
        }

        this.db
          .prepare(`
            INSERT INTO ${this.tables.stageReceipts}
              (attempt_id, stage, idempotency_key, request_digest, state,
               result_json, diagnostic_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'running', NULL, NULL, ?, ?)
          `)
          .run(
            receipt.attemptId,
            receipt.stage,
            receipt.idempotencyKey,
            receipt.requestDigest,
            receipt.createdAt,
            receipt.updatedAt
          );
        return "claimed";
      }

      const mapped = rowToStageReceipt(existing);
      this.assertSameStage(mapped, receipt);
      if (mapped.state === "completed") return "completed";
      if (mapped.state === "running") return "running";

      this.db
        .prepare(`
          UPDATE ${this.tables.stageReceipts}
          SET state = 'running', result_json = NULL, diagnostic_json = NULL,
              updated_at = ?
          WHERE attempt_id = ? AND stage = ?
        `)
        .run(receipt.updatedAt, receipt.attemptId, receipt.stage);
      return "claimed";
    })();
  }

  async completeStage(receipt: SlideStageReceipt): Promise<void> {
    this.db.transaction(() => this.finishStageRow(receipt, "completed"))();
  }

  async failStage(receipt: SlideStageReceipt): Promise<void> {
    this.db.transaction(() => this.finishStageRow(receipt, "failed"))();
  }

  async failPromptCreationStage(
    commit: PromptCreationFailureCommit
  ): Promise<void> {
    if (commit.attempt.kind !== "prompt-content-create") {
      throw new Error("Prompt creation failure requires a Prompt creation attempt");
    }
    if (commit.attempt.state !== "failed" || commit.receipt.state !== "failed") {
      throw new Error("Prompt creation failure must be terminal");
    }
    if (commit.receipt.attemptId !== commit.attempt.id) {
      throw new Error("Prompt creation failure stage belongs to another attempt");
    }

    this.db.transaction(() => {
      const ownershipRow = this.db
        .prepare(`
          SELECT * FROM ${this.tables.promptOutputs}
          WHERE creation_attempt_id = ?
        `)
        .get(commit.attempt.id) as SQLiteRow | undefined;
      if (ownershipRow) {
        const ownership = rowToPromptOutputOwnership(ownershipRow);
        if (
          ownership.deckId !== commit.attempt.deckId ||
          ownership.slideId !== commit.attempt.slideId ||
          ownership.shapeId !== commit.attempt.shapeId ||
          (commit.attempt.candidateOutputId !== undefined &&
            ownership.outputId !== commit.attempt.candidateOutputId)
        ) {
          throw new Error("Prompt creation failure ownership does not match its attempt");
        }
        if (ownership.state === "attached") {
          throw new Error("An attached Prompt output cannot be failed as pending creation");
        }
        if (ownership.state === "pending") {
          this.updatePromptOutputOwnershipRow({
            outputId: ownership.outputId,
            deckId: ownership.deckId,
            slideId: ownership.slideId,
            shapeId: ownership.shapeId,
            creationAttemptId: ownership.creationAttemptId,
            state: "detached",
            at: commit.attempt.updatedAt
          });
        }
      }

      this.updateAttemptRow(commit.attempt);
      this.finishStageRow(commit.receipt, "failed");
    })();
  }

  async recoverInterruptedStages(recoveredAt: string): Promise<number> {
    const diagnostic = encodeJson({
      code: "process_interrupted",
      message: "The prior process stopped before this stage completed"
    });
    const result = this.db
      .prepare(`
        UPDATE ${this.tables.stageReceipts}
        SET state = 'failed', diagnostic_json = ?, updated_at = ?
        WHERE state = 'running'
      `)
      .run(diagnostic, recoveredAt);
    return result.changes;
  }

  async getPromptOutputOwnership(
    outputId: string
  ): Promise<PromptContentOutputOwnership | undefined> {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.promptOutputs} WHERE output_id = ?`)
      .get(outputId) as SQLiteRow | undefined;
    return row ? rowToPromptOutputOwnership(row) : undefined;
  }

  async getPromptOutputOwnershipByShape(
    deckId: string,
    shapeId: string
  ): Promise<PromptContentOutputOwnership | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.promptOutputs}
        WHERE deck_id = ? AND shape_id = ?
      `)
      .get(deckId, shapeId) as SQLiteRow | undefined;
    return row ? rowToPromptOutputOwnership(row) : undefined;
  }

  async registerPendingPromptOutput(
    ownership: PromptContentOutputOwnership
  ): Promise<void> {
    if (ownership.state !== "pending") {
      throw new Error("New Prompt-output ownership must be pending");
    }
    this.db.transaction(() => {
      const row = this.db
        .prepare(`SELECT * FROM ${this.tables.promptOutputs} WHERE output_id = ?`)
        .get(ownership.outputId) as SQLiteRow | undefined;
      if (row) {
        const existing = rowToPromptOutputOwnership(row);
        if (
          existing.state === "pending" &&
          existing.deckId === ownership.deckId &&
          existing.slideId === ownership.slideId &&
          existing.shapeId === ownership.shapeId &&
          existing.creationAttemptId === ownership.creationAttemptId
        ) {
          return;
        }
        throw new Error(`Prompt-output ownership already exists: ${ownership.outputId}`);
      }

      this.db
        .prepare(`
          INSERT INTO ${this.tables.promptOutputs}
            (output_id, deck_id, slide_id, shape_id, creation_attempt_id, state,
             attached_revision, detached_revision, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          ownership.outputId,
          ownership.deckId,
          ownership.slideId,
          ownership.shapeId,
          ownership.creationAttemptId ?? null,
          ownership.state,
          ownership.attachedRevision ?? null,
          ownership.detachedRevision ?? null,
          ownership.createdAt,
          ownership.updatedAt
        );
    })();
  }

  async updatePromptOutputOwnership(
    transition: PromptOwnershipTransition
  ): Promise<void> {
    this.db.transaction(() => this.updatePromptOutputOwnershipRow(transition))();
  }

  async listDetachedPromptOutputs(
    limit?: number
  ): Promise<PromptContentOutputOwnership[]> {
    const size = boundedLimit(
      limit,
      DEFAULT_MAINTENANCE_BATCH_SIZE,
      MAX_MAINTENANCE_BATCH_SIZE
    );
    const rows = this.db
      .prepare(`
        SELECT * FROM ${this.tables.promptOutputs}
        WHERE state = 'detached'
        ORDER BY updated_at ASC, output_id ASC
        LIMIT ?
      `)
      .all(size) as SQLiteRow[];
    return rows.map(rowToPromptOutputOwnership);
  }

  async getCommittedFact(
    factId: string
  ): Promise<SlideCommittedFact | undefined> {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.activityOutbox} WHERE fact_id = ?`)
      .get(factId) as SQLiteRow | undefined;
    return row ? rowToCommittedFact(row) : undefined;
  }

  async listUnpublishedFacts(limit?: number): Promise<SlideCommittedFact[]> {
    const size = boundedLimit(
      limit,
      DEFAULT_MAINTENANCE_BATCH_SIZE,
      MAX_MAINTENANCE_BATCH_SIZE
    );
    const rows = this.db
      .prepare(`
        SELECT * FROM ${this.tables.activityOutbox}
        WHERE published_at IS NULL
        ORDER BY occurred_at ASC, fact_id ASC
        LIMIT ?
      `)
      .all(size) as SQLiteRow[];
    return rows.map(rowToCommittedFact);
  }

  async markFactPublished(factId: string, publishedAt: string): Promise<void> {
    this.db
      .prepare(`
        UPDATE ${this.tables.activityOutbox}
        SET published_at = COALESCE(published_at, ?)
        WHERE fact_id = ?
      `)
      .run(publishedAt, factId);
  }

  private insertHead(head: DeckHead): void {
    this.db
      .prepare(`
        INSERT INTO ${this.tables.decks}
          (id, title, lifecycle, revision, base_seq, semantic_digest,
           created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        head.id,
        head.title,
        head.lifecycle,
        head.revision,
        head.baseSeq,
        head.semanticDigest,
        head.createdAt,
        head.updatedAt
      );
  }

  private claimInitialIdentities(
    deckId: string,
    identities: SlideIdentity[]
  ): void {
    const claimed = new Map<string, SlideIdentity["kind"]>();
    const insert = this.db.prepare(`
      INSERT INTO ${this.tables.identityLedger}
        (deck_id, identity_id, identity_kind, state, first_revision,
         last_transition_revision, tombstoned_revision)
      VALUES (?, ?, ?, 'active', 0, 0, NULL)
    `);
    for (const identity of identities) {
      const previousKind = claimed.get(identity.id);
      if (previousKind) {
        throw new SlideIdentityReuseError(
          deckId,
          identity.id,
          previousKind,
          identity.kind
        );
      }
      claimed.set(identity.id, identity.kind);
      insert.run(deckId, identity.id, identity.kind);
    }
  }

  private applyIdentityTransitions(
    deckId: string,
    revision: number,
    transitions: SlideIdentityTransitions,
    reactivation: SlideIdentityReactivation
  ): void {
    for (const identity of transitions.removed) {
      const row = this.db
        .prepare(`
          SELECT * FROM ${this.tables.identityLedger}
          WHERE deck_id = ? AND identity_id = ?
        `)
        .get(deckId, identity.id) as SQLiteRow | undefined;
      if (!row) {
        throw new Error(
          `Slide identity ledger is missing '${identity.id}' during removal`
        );
      }
      const existing = rowToIdentityLedgerEntry(row);
      if (existing.kind !== identity.kind || existing.state !== "active") {
        throw new Error(
          `Slide identity '${identity.id}' is not an active ${identity.kind}`
        );
      }
      const updated = this.db
        .prepare(`
          UPDATE ${this.tables.identityLedger}
          SET state = 'tombstoned', last_transition_revision = ?,
              tombstoned_revision = ?
          WHERE deck_id = ? AND identity_id = ?
            AND identity_kind = ? AND state = 'active'
        `)
        .run(
          revision,
          revision,
          deckId,
          identity.id,
          identity.kind
        );
      if (updated.changes !== 1) {
        throw new Error(
          `Slide identity '${identity.id}' could not be tombstoned`
        );
      }
    }

    for (const identity of transitions.added) {
      const row = this.db
        .prepare(`
          SELECT * FROM ${this.tables.identityLedger}
          WHERE deck_id = ? AND identity_id = ?
        `)
        .get(deckId, identity.id) as SQLiteRow | undefined;
      if (!row) {
        this.db
          .prepare(`
            INSERT INTO ${this.tables.identityLedger}
              (deck_id, identity_id, identity_kind, state, first_revision,
               last_transition_revision, tombstoned_revision)
            VALUES (?, ?, ?, 'active', ?, ?, NULL)
          `)
          .run(deckId, identity.id, identity.kind, revision, revision);
        continue;
      }

      const existing = rowToIdentityLedgerEntry(row);
      if (
        reactivation === "same-kind-compensation" &&
        existing.state === "tombstoned" &&
        existing.kind === identity.kind
      ) {
        const updated = this.db
          .prepare(`
            UPDATE ${this.tables.identityLedger}
            SET state = 'active', last_transition_revision = ?,
                tombstoned_revision = NULL
            WHERE deck_id = ? AND identity_id = ?
              AND identity_kind = ? AND state = 'tombstoned'
          `)
          .run(revision, deckId, identity.id, identity.kind);
        if (updated.changes !== 1) {
          throw new Error(
            `Slide identity '${identity.id}' could not be reactivated`
          );
        }
        continue;
      }

      throw new SlideIdentityReuseError(
        deckId,
        identity.id,
        existing.kind,
        identity.kind
      );
    }
  }

  private insertBase(base: SlideBase): void {
    this.db
      .prepare(`
        INSERT INTO ${this.tables.bases}
          (deck_id, base_seq, representation_version, snapshot_json,
           semantic_digest, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        base.deckId,
        base.baseSeq,
        base.representationVersion,
        encodeJson(base.snapshot),
        base.semanticDigest,
        base.createdAt
      );
  }

  private insertChangeSet(changeSet: SlideChangeSet): void {
    this.db
      .prepare(`
        INSERT INTO ${this.tables.changeSets}
          (id, deck_id, client_request_id, request_digest,
           authored_revision, prior_revision, revision, seq, origin,
           operations_json, inverse_operations_json, touched_ids_json,
           compensation_intent, compensation_target_change_set_id,
           semantic_digest, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        changeSet.id,
        changeSet.deckId,
        changeSet.clientRequestId,
        changeSet.requestDigest,
        changeSet.authoredRevision,
        changeSet.priorRevision,
        changeSet.revision,
        changeSet.seq,
        changeSet.origin,
        encodeJson(changeSet.operations),
        encodeJson(changeSet.inverseOperations),
        encodeJson(changeSet.touchedIds),
        changeSet.compensation?.intent ?? null,
        changeSet.compensation?.targetChangeSetId ?? null,
        changeSet.semanticDigest,
        changeSet.createdAt
      );
  }

  private insertSubmission(
    receipt: SlideSubmissionReceipt,
    completingDelegatedCommand = false
  ): void {
    const delegatedRow = this.db
      .prepare(`
        SELECT * FROM ${this.tables.delegatedCommandClaims}
        WHERE deck_id = ? AND request_id = ?
      `)
      .get(receipt.deckId, receipt.requestId) as SQLiteRow | undefined;
    if (delegatedRow && !completingDelegatedCommand) {
      throw new SlideIdempotencyMismatchError(receipt.requestId);
    }
    this.db
      .prepare(`
        INSERT INTO ${this.tables.receipts}
          (deck_id, request_id, request_digest, result_json, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        receipt.deckId,
        receipt.requestId,
        receipt.requestDigest,
        encodeJson(receipt.result),
        receipt.createdAt
      );
  }

  private assertSameDelegatedRequest(
    existing: SlideDelegatedCommandClaim,
    incoming: SlideDelegatedCommandClaim
  ): void {
    if (
      existing.kind !== incoming.kind ||
      existing.requestDigest !== incoming.requestDigest
    ) {
      throw new SlideIdempotencyMismatchError(incoming.requestId);
    }
  }

  private assertSameDelegatedClaim(
    existing: SlideDelegatedCommandClaim,
    incoming: SlideDelegatedCommandClaim
  ): void {
    this.assertSameDelegatedRequest(existing, incoming);
    if (existing.targetOutputId !== incoming.targetOutputId) {
      throw new SlideIdempotencyMismatchError(incoming.requestId);
    }
  }

  private insertCommittedFact(fact: SlideCommittedFact): void {
    this.db
      .prepare(`
        INSERT INTO ${this.tables.activityOutbox}
          (fact_id, fact_kind, deck_id, revision, change_set_id,
           actor_id, origin, operation_types, semantic_digest, occurred_at,
           published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `)
      .run(
        fact.factId,
        fact.kind,
        fact.deckId,
        fact.revision,
        fact.changeSetId ?? null,
        fact.actorId ?? null,
        fact.origin,
        encodeJson(fact.operationTypes),
        fact.semanticDigest,
        fact.occurredAt
      );
  }

  private insertAttempt(attempt: SlideAttempt): void {
    const storage = attemptToStorageParts(attempt);
    this.db
      .prepare(`
        INSERT INTO ${this.tables.attempts}
          (id, deck_id, kind, client_request_id, request_digest,
           slide_id, shape_id, frozen_deck_revision, state, frozen_json,
           candidate_json, diagnostic_json, settled_change_set_id,
           created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        attempt.id,
        attempt.deckId,
        attempt.kind,
        attempt.clientRequestId,
        attempt.requestDigest,
        attempt.slideId,
        attempt.shapeId,
        attempt.frozenDeckRevision,
        attempt.state,
        storage.frozenJson,
        storage.candidateJson,
        storage.diagnosticJson,
        attempt.settledChangeSetId ?? null,
        attempt.createdAt,
        attempt.updatedAt
      );
  }

  private updateAttemptRow(attempt: SlideAttempt): void {
    const storage = attemptToStorageParts(attempt);
    const result = this.db
      .prepare(`
        UPDATE ${this.tables.attempts}
        SET client_request_id = ?, request_digest = ?, slide_id = ?, shape_id = ?,
            frozen_deck_revision = ?, state = ?, frozen_json = ?,
            candidate_json = ?, diagnostic_json = ?, settled_change_set_id = ?,
            updated_at = ?
        WHERE id = ? AND deck_id = ? AND kind = ?
      `)
      .run(
        attempt.clientRequestId,
        attempt.requestDigest,
        attempt.slideId,
        attempt.shapeId,
        attempt.frozenDeckRevision,
        attempt.state,
        storage.frozenJson,
        storage.candidateJson,
        storage.diagnosticJson,
        attempt.settledChangeSetId ?? null,
        attempt.updatedAt,
        attempt.id,
        attempt.deckId,
        attempt.kind
      );
    if (result.changes !== 1) {
      throw new Error(`Slide attempt not found: ${attempt.id}`);
    }
  }

  private updatePromptOutputOwnershipRow(
    transition: PromptOwnershipTransition
  ): void {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.promptOutputs} WHERE output_id = ?`)
      .get(transition.outputId) as SQLiteRow | undefined;
    if (!row) {
      throw new Error(`Prompt-output ownership not found: ${transition.outputId}`);
    }
    const existing = rowToPromptOutputOwnership(row);
    if (
      existing.deckId !== transition.deckId ||
      existing.slideId !== transition.slideId ||
      existing.shapeId !== transition.shapeId
    ) {
      throw new Error("Prompt-output ownership transition changed its owner");
    }

    const attachedRevision =
      transition.state === "pending"
        ? undefined
        : transition.attachedRevision ?? existing.attachedRevision;
    const detachedRevision =
      transition.state === "attached"
        ? undefined
        : transition.detachedRevision ?? existing.detachedRevision;

    const result = this.db
      .prepare(`
        UPDATE ${this.tables.promptOutputs}
        SET creation_attempt_id = ?, state = ?, attached_revision = ?,
            detached_revision = ?, updated_at = ?
        WHERE output_id = ? AND deck_id = ? AND slide_id = ? AND shape_id = ?
      `)
      .run(
        transition.creationAttemptId ?? existing.creationAttemptId ?? null,
        transition.state,
        attachedRevision ?? null,
        detachedRevision ?? null,
        transition.at,
        transition.outputId,
        transition.deckId,
        transition.slideId,
        transition.shapeId
      );
    if (result.changes !== 1) {
      throw new Error(`Prompt-output ownership not found: ${transition.outputId}`);
    }
  }

  private assertSameStage(
    existing: SlideStageReceipt,
    incoming: SlideStageReceipt
  ): void {
    if (
      existing.idempotencyKey !== incoming.idempotencyKey ||
      existing.requestDigest !== incoming.requestDigest
    ) {
      throw new Error("Slide stage receipt does not match the claimed stage");
    }
  }

  private finishStageRow(
    receipt: SlideStageReceipt,
    state: "completed" | "failed"
  ): void {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.stageReceipts}
        WHERE attempt_id = ? AND stage = ?
      `)
      .get(receipt.attemptId, receipt.stage) as SQLiteRow | undefined;
    if (!row) {
      throw new Error(
        `Slide stage was not claimed: ${receipt.attemptId}/${receipt.stage}`
      );
    }
    const existing = rowToStageReceipt(row);
    this.assertSameStage(existing, receipt);
    if (existing.state === "completed") {
      if (state === "completed") return;
      throw new Error("A completed Slide stage cannot be marked failed");
    }

    this.db
      .prepare(`
        UPDATE ${this.tables.stageReceipts}
        SET state = ?, result_json = ?, diagnostic_json = ?, updated_at = ?
        WHERE attempt_id = ? AND stage = ?
      `)
      .run(
        state,
        receipt.result === undefined ? null : encodeJson(receipt.result),
        receipt.diagnostic ? encodeJson(receipt.diagnostic) : null,
        receipt.updatedAt,
        receipt.attemptId,
        receipt.stage
      );
  }
}
