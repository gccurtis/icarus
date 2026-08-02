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
import type {
  DocumentAttempt,
  DocumentBase,
  DocumentChangeSet,
  DocumentCommittedTransaction,
  DocumentCreateReceipt,
  DocumentHead,
  DocumentLifecycle,
  DocumentStageReceipt,
  DocumentSubmissionReceipt,
  PromptOutputOwnership
} from "../domain/model.js";
import type {
  DocumentIdentity,
  DocumentIdentityLedgerEntry,
  DocumentIdentityReactivation,
  DocumentIdentityTransitions
} from "../domain/identities.js";
import {
  DocumentIdentityReuseError,
  InvalidDocumentCursorError
} from "../domain/errors.js";
import type {
  DocumentCreationCommit,
  DocumentMutationCommit,
  DocumentRetentionAnchor,
  DocumentStore,
  PromptCreationFailureCommit,
  PromptOwnershipTransition,
  StageClaimResult
} from "../ports/documentStore.js";
import {
  attemptToStorageParts,
  encodeJson,
  rowToAttempt,
  rowToBase,
  rowToChangeSet,
  rowToCommittedTransaction,
  rowToCreateReceipt,
  rowToHead,
  rowToIdentityLedgerEntry,
  rowToPromptOutputOwnership,
  rowToStageReceipt,
  rowToSubmission,
  type SQLiteRow
} from "./sqliteMappers.js";
import {
  createDocumentTableNames,
  initializeDocumentSchema,
  type DocumentTableNames
} from "./sqliteSchema.js";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const DEFAULT_MAINTENANCE_BATCH_SIZE = 100;
const MAX_MAINTENANCE_BATCH_SIZE = 1000;

interface HeadCursor {
  kind: "document-head";
  updatedAt: string;
  id: string;
}

interface ChangeCursor {
  kind: "document-change";
  seq: number;
}

const boundedLimit = (
  value: number | undefined,
  fallback: number,
  maximum: number
): number => {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("Document store limit must be a positive safe integer");
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
    throw new InvalidDocumentCursorError();
  }

  if (!value || typeof value !== "object" || (value as { kind?: unknown }).kind !== kind) {
    throw new InvalidDocumentCursorError();
  }
  if (kind === "document-head") {
    const head = value as Partial<HeadCursor>;
    if (
      typeof head.updatedAt !== "string" ||
      head.updatedAt.length === 0 ||
      typeof head.id !== "string" ||
      head.id.length === 0
    ) {
      throw new InvalidDocumentCursorError();
    }
  } else {
    const change = value as Partial<ChangeCursor>;
    if (
      typeof change.seq !== "number" ||
      !Number.isSafeInteger(change.seq) ||
      change.seq < 1
    ) {
      throw new InvalidDocumentCursorError();
    }
  }
  return value as T;
};

const assertSameDocument = (
  documentId: string,
  values: Array<{ label: string; documentId: string }>
): void => {
  for (const value of values) {
    if (value.documentId !== documentId) {
      throw new Error(
        `${value.label} belongs to '${value.documentId}', expected '${documentId}'`
      );
    }
  }
};

const terminalAttemptStates = ["settled", "unchanged", "stale", "failed"];

export class SQLiteDocumentStore implements DocumentStore {
  private readonly db: DatabaseConnection;
  private readonly tables: DocumentTableNames;

  constructor(projectId: string, dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.tables = createDocumentTableNames(projectId);
    initializeDocumentSchema(this.db, this.tables);
  }

  close(): void {
    this.db.close();
  }

  async listHeads(
    cursor?: string,
    lifecycle?: DocumentLifecycle,
    limit?: number
  ): Promise<{ items: DocumentHead[]; nextCursor?: string }> {
    const pageSize = boundedLimit(limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const decoded = cursor
      ? decodeCursor<HeadCursor>(cursor, "document-head")
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
        SELECT * FROM ${this.tables.documents}
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
              kind: "document-head",
              updatedAt: last.updatedAt,
              id: last.id
            })
          }
        : {})
    };
  }

  async getHead(documentId: string): Promise<DocumentHead | undefined> {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.documents} WHERE id = ?`)
      .get(documentId) as SQLiteRow | undefined;
    return row ? rowToHead(row) : undefined;
  }

  async getBaseAtOrBefore(
    documentId: string,
    revision: number
  ): Promise<DocumentBase | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.bases}
        WHERE document_id = ? AND base_seq <= ?
        ORDER BY base_seq DESC
        LIMIT 1
      `)
      .get(documentId, revision) as SQLiteRow | undefined;
    return row ? rowToBase(row) : undefined;
  }

  async getChangeSets(
    documentId: string,
    fromExclusive: number,
    toInclusive: number
  ): Promise<DocumentChangeSet[]> {
    if (toInclusive <= fromExclusive) return [];
    const rows = this.db
      .prepare(`
        SELECT * FROM ${this.tables.changeSets}
        WHERE document_id = ? AND seq > ? AND seq <= ?
        ORDER BY seq ASC
      `)
      .all(documentId, fromExclusive, toInclusive) as SQLiteRow[];
    return rows.map(rowToChangeSet);
  }

  async listChangeSets(
    documentId: string,
    cursor?: string,
    limit?: number
  ): Promise<{ items: DocumentChangeSet[]; nextCursor?: string }> {
    const pageSize = boundedLimit(limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const decoded = cursor
      ? decodeCursor<ChangeCursor>(cursor, "document-change")
      : undefined;
    const rows = this.db
      .prepare(`
        SELECT * FROM ${this.tables.changeSets}
        WHERE document_id = ? ${decoded ? "AND seq < ?" : ""}
        ORDER BY seq DESC
        LIMIT ?
      `)
      .all(
        ...(decoded
          ? [documentId, decoded.seq, pageSize + 1]
          : [documentId, pageSize + 1])
      ) as SQLiteRow[];
    const hasMore = rows.length > pageSize;
    const items = rows.slice(0, pageSize).map(rowToChangeSet);
    const last = items.at(-1);

    return {
      items,
      ...(hasMore && last
        ? {
            nextCursor: encodeCursor({
              kind: "document-change",
              seq: last.seq
            })
          }
        : {})
    };
  }

  async getChangeSet(
    documentId: string,
    changeSetId: string
  ): Promise<DocumentChangeSet | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.changeSets}
        WHERE document_id = ? AND id = ?
      `)
      .get(documentId, changeSetId) as SQLiteRow | undefined;
    return row ? rowToChangeSet(row) : undefined;
  }

  async getSubmission(
    documentId: string,
    requestId: string
  ): Promise<DocumentSubmissionReceipt | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.receipts}
        WHERE document_id = ? AND request_id = ?
      `)
      .get(documentId, requestId) as SQLiteRow | undefined;
    return row ? rowToSubmission(row) : undefined;
  }

  async getCreateSubmission(
    requestId: string
  ): Promise<DocumentCreateReceipt | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.createReceipts}
        WHERE request_id = ?
      `)
      .get(requestId) as SQLiteRow | undefined;
    return row ? rowToCreateReceipt(row) : undefined;
  }

  async getIdentity(
    documentId: string,
    identityId: string
  ): Promise<DocumentIdentityLedgerEntry | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.identityLedger}
        WHERE document_id = ? AND identity_id = ?
      `)
      .get(documentId, identityId) as SQLiteRow | undefined;
    return row ? rowToIdentityLedgerEntry(row) : undefined;
  }

  async recordSubmission(receipt: DocumentSubmissionReceipt): Promise<void> {
    this.insertSubmission(receipt);
  }

  async commitCreation(commit: DocumentCreationCommit): Promise<void> {
    assertSameDocument(commit.head.id, [
      { label: "Document Base", documentId: commit.base.documentId },
      { label: "Document receipt", documentId: commit.receipt.documentId },
      { label: "Document transaction", documentId: commit.transaction.documentId }
    ]);
    if (commit.head.revision !== 1 || commit.base.baseSeq !== 1) {
      throw new Error("Document creation must commit revision-one head and Base");
    }

    this.db.transaction(() => {
      this.insertResource(commit.head.id, commit.head.createdAt);
      this.insertHead(commit.head);
      this.claimInitialIdentities(commit.head.id, commit.identities);
      this.insertBase(commit.base);
      this.insertSubmission(commit.receipt);
      this.insertCreateReceipt(commit.createReceipt);
      this.insertCommittedTransaction(commit.transaction);
    })();
  }

  async commitMutation(commit: DocumentMutationCommit): Promise<boolean> {
    const documentId = commit.head.id;
    assertSameDocument(documentId, [
      { label: "Document ChangeSet", documentId: commit.changeSet.documentId },
      { label: "Document receipt", documentId: commit.receipt.documentId },
      { label: "Document transaction", documentId: commit.transaction.documentId },
      ...(commit.attempts ?? []).map((attempt) => ({
        label: "Document attempt",
        documentId: attempt.documentId
      })),
      ...(commit.attemptUpdates ?? []).map((attempt) => ({
        label: "Document attempt update",
        documentId: attempt.documentId
      })),
      ...(commit.promptOwnershipTransitions ?? []).map((transition) => ({
        label: "Prompt-output ownership transition",
        documentId: transition.documentId
      }))
    ]);

    if (
      commit.changeSet.priorRevision !== commit.expectedRevision ||
      commit.changeSet.revision !== commit.expectedRevision + 1 ||
      commit.head.revision !== commit.changeSet.revision
    ) {
      throw new Error("Document mutation revisions are inconsistent");
    }
    if (
      commit.identityReactivation === "same-kind-compensation" &&
      !commit.changeSet.compensation
    ) {
      throw new Error(
        "Document identity reactivation requires a compensation ChangeSet"
      );
    }

    return this.db.transaction(() => {
      const previousRow = this.db.prepare(
        `SELECT * FROM ${this.tables.documents} WHERE id = ? AND revision = ?`
      ).get(documentId, commit.expectedRevision) as SQLiteRow | undefined;
      if (!previousRow) return false;
      insertHistorySnapshot(this.db, this.tables.history, {
        resourceKind: "document",
        resourceId: documentId,
        revision: commit.expectedRevision,
        snapshot: rowToHead(previousRow),
        recordedAt: commit.head.updatedAt
      });
      const updated = this.db
        .prepare(`
          UPDATE ${this.tables.documents}
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
          documentId,
          commit.expectedRevision
        );

      if (updated.changes !== 1) return false;

      this.applyIdentityTransitions(
        documentId,
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
      this.insertCommittedTransaction(commit.transaction);
      return true;
    })();
  }

  async appendBaseIfHead(
    documentId: string,
    expectedHeadRevision: number,
    base: DocumentBase
  ): Promise<boolean> {
    if (base.documentId !== documentId) {
      throw new Error("Document Base belongs to another Document");
    }
    if (
      base.baseSeq > expectedHeadRevision ||
      base.snapshot.revision !== base.baseSeq
    ) {
      throw new Error("Document Base revision is inconsistent");
    }

    return this.db.transaction(() => {
      const head = this.db
        .prepare(`SELECT revision, base_seq FROM ${this.tables.documents} WHERE id = ?`)
        .get(documentId) as
        | { revision: number; base_seq: number }
        | undefined;
      if (!head || Number(head.revision) !== expectedHeadRevision) return false;

      this.db
        .prepare(`
          INSERT INTO ${this.tables.bases}
            (document_id, base_seq, representation_version, snapshot_json,
             semantic_digest, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(document_id, base_seq) DO NOTHING
        `)
        .run(
          base.documentId,
          base.baseSeq,
          base.representationVersion,
          encodeJson(base.snapshot),
          base.semanticDigest,
          base.createdAt
        );

      const persisted = this.db
        .prepare(`
          SELECT * FROM ${this.tables.bases}
          WHERE document_id = ? AND base_seq = ?
        `)
        .get(documentId, base.baseSeq) as SQLiteRow;
      const mapped = rowToBase(persisted);
      if (
        mapped.semanticDigest !== base.semanticDigest ||
        encodeJson(mapped.snapshot).compare(encodeJson(base.snapshot)) !== 0
      ) {
        throw new Error("A different Document Base already exists at this revision");
      }

      if (base.baseSeq > Number(head.base_seq)) {
        this.db
          .prepare(`
            UPDATE ${this.tables.documents}
            SET base_seq = ?
            WHERE id = ? AND revision = ?
          `)
          .run(base.baseSeq, documentId, expectedHeadRevision);
      }
      return true;
    })();
  }

  async pruneHistory(
    documentId: string,
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
        throw new Error("Document history retention values must be positive safe integers");
      }
    }

    this.db.transaction(() => {
      const head = this.db
        .prepare(`SELECT revision, base_seq FROM ${this.tables.documents} WHERE id = ?`)
        .get(documentId) as
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
          WHERE document_id = ?
            AND base_seq != ?
            AND base_seq NOT IN (
              SELECT base_seq FROM ${this.tables.bases}
              WHERE document_id = ? AND base_seq != ?
              ORDER BY base_seq DESC
              LIMIT ?
            )
        `)
        .run(
          documentId,
          changeCutoff,
          documentId,
          changeCutoff,
          retainedOtherBaseCount
        );

      if (changeCutoff > 0) {
        this.db
          .prepare(`
            DELETE FROM ${this.tables.changeSets}
            WHERE document_id = ? AND seq <= ?
              AND id NOT IN (
                SELECT compensation_target_change_set_id
                FROM ${this.tables.changeSets}
                WHERE compensation_target_change_set_id IS NOT NULL
              )
          `)
          .run(documentId, changeCutoff);

        // A retained head envelope must always have enough Base/Change Set
        // data to reconstruct it. Count-based compaction makes revisions below
        // the anchor unavailable, so remove those envelopes in the same
        // transaction instead of leaving misleading retained history behind.
        this.db
          .prepare(`
            DELETE FROM ${this.tables.history}
            WHERE resource_kind = 'document' AND resource_id = ?
              AND record_type = 'snapshot' AND revision < ?
          `)
          .run(documentId, changeCutoff);
      }

      this.db
        .prepare(`
          DELETE FROM ${this.tables.attempts}
          WHERE document_id = ?
            AND state IN (${terminalAttemptStates.map(() => "?").join(", ")})
            AND id NOT IN (
              SELECT id FROM ${this.tables.attempts}
              WHERE document_id = ?
                AND state IN (${terminalAttemptStates.map(() => "?").join(", ")})
              ORDER BY updated_at DESC, id DESC
              LIMIT ?
            )
        `)
        .run(
          documentId,
          ...terminalAttemptStates,
          documentId,
          ...terminalAttemptStates,
          retainedTerminalAttemptCount
        );
    })();
  }

  async getAttempt(
    documentId: string,
    attemptId: string
  ): Promise<DocumentAttempt | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.attempts}
        WHERE document_id = ? AND id = ?
      `)
      .get(documentId, attemptId) as SQLiteRow | undefined;
    return row ? rowToAttempt(row) : undefined;
  }

  async getAttemptById(attemptId: string): Promise<DocumentAttempt | undefined> {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.attempts} WHERE id = ?`)
      .get(attemptId) as SQLiteRow | undefined;
    return row ? rowToAttempt(row) : undefined;
  }

  async getAttemptByRequest(
    documentId: string,
    kind: DocumentAttempt["kind"],
    requestId: string
  ): Promise<DocumentAttempt | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.attempts}
        WHERE document_id = ? AND kind = ? AND client_request_id = ?
      `)
      .get(documentId, kind, requestId) as SQLiteRow | undefined;
    return row ? rowToAttempt(row) : undefined;
  }

  async getPromptCreationAttemptByBlock(
    documentId: string,
    blockId: string
  ): Promise<DocumentAttempt | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.attempts}
        WHERE document_id = ? AND block_id = ? AND kind = 'prompt-create'
      `)
      .get(documentId, blockId) as SQLiteRow | undefined;
    return row ? rowToAttempt(row) : undefined;
  }

  async listRecoverableAttempts(): Promise<DocumentAttempt[]> {
    const rows = this.db
      .prepare(`
        SELECT * FROM ${this.tables.attempts}
        WHERE state IN ('requested', 'computing', 'proposed')
        ORDER BY updated_at ASC, id ASC
      `)
      .all() as SQLiteRow[];
    return rows.map(rowToAttempt);
  }

  async createAttempt(attempt: DocumentAttempt): Promise<void> {
    this.insertAttempt(attempt);
  }

  async createAttemptWithSubmission(
    attempt: DocumentAttempt,
    receipt: DocumentSubmissionReceipt
  ): Promise<void> {
    assertSameDocument(attempt.documentId, [
      { label: "Document receipt", documentId: receipt.documentId }
    ]);
    this.db.transaction(() => {
      this.insertAttempt(attempt);
      this.insertSubmission(receipt);
    })();
  }

  async updateAttempt(attempt: DocumentAttempt): Promise<void> {
    this.updateAttemptRow(attempt);
  }

  async claimStage(receipt: DocumentStageReceipt): Promise<StageClaimResult> {
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
          throw new Error("Document stage idempotency key was reused");
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

  async completeStage(receipt: DocumentStageReceipt): Promise<void> {
    this.db.transaction(() => this.finishStageRow(receipt, "completed"))();
  }

  async failStage(receipt: DocumentStageReceipt): Promise<void> {
    this.db.transaction(() => this.finishStageRow(receipt, "failed"))();
  }

  async failPromptCreationStage(
    commit: PromptCreationFailureCommit
  ): Promise<void> {
    if (commit.attempt.kind !== "prompt-create") {
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
          ownership.documentId !== commit.attempt.documentId ||
          ownership.blockId !== commit.attempt.blockId ||
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
            documentId: ownership.documentId,
            blockId: ownership.blockId,
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
  ): Promise<PromptOutputOwnership | undefined> {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.promptOutputs} WHERE output_id = ?`)
      .get(outputId) as SQLiteRow | undefined;
    return row ? rowToPromptOutputOwnership(row) : undefined;
  }

  async getPromptOutputOwnershipByBlock(
    documentId: string,
    blockId: string
  ): Promise<PromptOutputOwnership | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.promptOutputs}
        WHERE document_id = ? AND block_id = ?
      `)
      .get(documentId, blockId) as SQLiteRow | undefined;
    return row ? rowToPromptOutputOwnership(row) : undefined;
  }

  async registerPendingPromptOutput(
    ownership: PromptOutputOwnership
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
          existing.documentId === ownership.documentId &&
          existing.blockId === ownership.blockId &&
          existing.creationAttemptId === ownership.creationAttemptId
        ) {
          return;
        }
        throw new Error(`Prompt-output ownership already exists: ${ownership.outputId}`);
      }

      this.db
        .prepare(`
          INSERT INTO ${this.tables.promptOutputs}
            (output_id, document_id, block_id, creation_attempt_id, state,
             attached_revision, detached_revision, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          ownership.outputId,
          ownership.documentId,
          ownership.blockId,
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
  ): Promise<PromptOutputOwnership[]> {
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

  async listPromptOutputsForDocument(
    documentId: string
  ): Promise<PromptOutputOwnership[]> {
    const rows = this.db
      .prepare(`
        SELECT * FROM ${this.tables.promptOutputs}
        WHERE document_id = ?
        ORDER BY created_at ASC, output_id ASC
      `)
      .all(documentId) as SQLiteRow[];
    return rows.map(rowToPromptOutputOwnership);
  }

  async deleteDocument(
    documentId: string,
    deletedAt: string,
    transaction: DocumentCommittedTransaction
  ): Promise<number | null> {
    return this.db.transaction(() => {
      const row = this.db.prepare(
        `SELECT * FROM ${this.tables.documents} WHERE id = ?`
      ).get(documentId) as SQLiteRow | undefined;
      if (!row) return null;
      const head = rowToHead(row);
      const deletionRevision = head.revision + 1;
      if (transaction.revision !== deletionRevision) {
        throw new Error("Document deletion transaction revision is inconsistent");
      }
      insertHistorySnapshot(this.db, this.tables.history, {
        resourceKind: "document",
        resourceId: documentId,
        revision: head.revision,
        snapshot: head,
        recordedAt: deletedAt
      });
      insertHistoryDeletion(this.db, this.tables.history, {
        resourceKind: "document",
        resourceId: documentId,
        revision: deletionRevision,
        recordedAt: deletedAt
      });
      this.db.prepare(`
        INSERT OR IGNORE INTO ${this.tables.retainedOutputs} (document_id, output_id)
        SELECT document_id, output_id FROM ${this.tables.promptOutputs}
        WHERE document_id = ?
      `).run(documentId);
      this.insertCommittedTransaction(transaction);
      const removed = this.db.prepare(
        `DELETE FROM ${this.tables.documents} WHERE id = ?`
      ).run(documentId);
      return removed.changes === 1 ? deletionRevision : null;
    })();
  }

  async purgeDocument(documentId: string): Promise<void> {
    if (await this.getHead(documentId)) throw new ResourceNotDeletedError("document", documentId);
    this.db.transaction(() => {
      if (!purgeResourceHistory(this.db, this.tables.history, "document", documentId)) {
        throw new ResourceHistoryNotFoundError("document", documentId);
      }
      this.db.prepare(`DELETE FROM ${this.tables.resources} WHERE id = ?`).run(documentId);
    })();
  }

  async hasResource(documentId: string): Promise<boolean> {
    return Boolean(this.db.prepare(
      `SELECT 1 FROM ${this.tables.resources} WHERE id = ?`
    ).get(documentId));
  }

  async getHistoricalHead(
    documentId: string,
    revision: number
  ): Promise<DocumentHead | undefined> {
    return getResourceHistory<DocumentHead>(
      this.db,
      this.tables.history,
      "document",
      documentId
    ).find((record) => record.revision === revision && record.recordType === "snapshot")?.snapshot;
  }

  async listRetainedPromptOutputIds(documentId: string): Promise<string[]> {
    const rows = this.db.prepare(`
      SELECT output_id FROM ${this.tables.retainedOutputs}
      WHERE document_id = ? ORDER BY output_id
    `).all(documentId) as Array<{ output_id: string }>;
    return rows.map((row) => row.output_id);
  }

  async listRetentionAnchors(cutoff: string): Promise<DocumentRetentionAnchor[]> {
    const live = this.db.prepare(`
      SELECT
        current.id AS document_id,
        current.revision AS current_revision,
        COALESCE(MIN(history.revision), current.revision) AS anchor_revision
      FROM ${this.tables.documents} AS current
      LEFT JOIN ${this.tables.history} AS history
        ON history.resource_kind = 'document'
       AND history.resource_id = current.id
       AND history.record_type = 'snapshot'
       AND history.recorded_at >= ?
      GROUP BY current.id, current.revision
    `).all(cutoff) as Array<{
      document_id: string;
      current_revision: number;
      anchor_revision: number;
    }>;
    const deleted = this.db.prepare(`
      SELECT
        resource.id AS document_id,
        MIN(history.revision) AS anchor_revision
      FROM ${this.tables.resources} AS resource
      JOIN ${this.tables.history} AS history
        ON history.resource_kind = 'document'
       AND history.resource_id = resource.id
       AND history.record_type = 'snapshot'
       AND history.recorded_at >= ?
      LEFT JOIN ${this.tables.documents} AS current ON current.id = resource.id
      WHERE current.id IS NULL
      GROUP BY resource.id
    `).all(cutoff) as Array<{
      document_id: string;
      anchor_revision: number;
    }>;
    return [
      ...live.map((row) => ({
        documentId: row.document_id,
        revision: Number(row.anchor_revision),
        currentRevision: Number(row.current_revision)
      })),
      ...deleted.map((row) => ({
        documentId: row.document_id,
        revision: Number(row.anchor_revision)
      }))
    ].sort((left, right) => left.documentId.localeCompare(right.documentId));
  }

  async compactRetentionHistory(
    anchor: DocumentRetentionAnchor,
    base: DocumentBase
  ): Promise<boolean> {
    if (base.documentId !== anchor.documentId || base.baseSeq !== anchor.revision) {
      throw new Error("Document retention Base does not match its anchor");
    }
    return this.db.transaction(() => {
      const current = this.db.prepare(`
        SELECT revision FROM ${this.tables.documents} WHERE id = ?
      `).get(anchor.documentId) as { revision: number } | undefined;
      if (anchor.currentRevision === undefined) {
        if (current || !this.db.prepare(
          `SELECT 1 FROM ${this.tables.resources} WHERE id = ?`
        ).get(anchor.documentId)) return false;
      } else if (!current || Number(current.revision) !== anchor.currentRevision) {
        return false;
      }

      const persisted = this.db.prepare(`
        SELECT * FROM ${this.tables.bases}
        WHERE document_id = ? AND base_seq = ?
      `).get(base.documentId, base.baseSeq) as SQLiteRow | undefined;
      if (persisted) {
        const mapped = rowToBase(persisted);
        if (
          mapped.semanticDigest !== base.semanticDigest ||
          encodeJson(mapped.snapshot).compare(encodeJson(base.snapshot)) !== 0
        ) {
          throw new Error("A different Document Base already exists at this revision");
        }
      } else {
        this.db.prepare(`
          INSERT INTO ${this.tables.bases}
            (document_id, base_seq, representation_version, snapshot_json,
             semantic_digest, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          base.documentId,
          base.baseSeq,
          base.representationVersion,
          encodeJson(base.snapshot),
          base.semanticDigest,
          base.createdAt
        );
      }

      this.db.prepare(`
        DELETE FROM ${this.tables.changeSets}
        WHERE document_id = ? AND seq <= ?
      `).run(anchor.documentId, anchor.revision);
      this.db.prepare(`
        DELETE FROM ${this.tables.bases}
        WHERE document_id = ? AND base_seq < ?
      `).run(anchor.documentId, anchor.revision);
      return true;
    })();
  }

  async pruneRevisionHistory(cutoff: string): Promise<number> {
    return pruneHistoryBefore(
      this.db,
      this.tables.history,
      cutoff,
      (_kind, id) => Boolean(this.db.prepare(
        `SELECT 1 FROM ${this.tables.documents} WHERE id = ?`
      ).get(id))
    );
  }

  async listExpiredDeleted(cutoff: string): Promise<string[]> {
    return listExpiredDeletedResources(this.db, this.tables.history, cutoff)
      .filter(({ resourceKind }) => resourceKind === "document")
      .map(({ resourceId }) => resourceId);
  }

  async getCommittedTransaction(
    sourceTransactionId: string
  ): Promise<DocumentCommittedTransaction | undefined> {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.transactionOutbox} WHERE source_transaction_id = ?`)
      .get(sourceTransactionId) as SQLiteRow | undefined;
    return row ? rowToCommittedTransaction(row) : undefined;
  }

  async getCommittedTransactionByRequest(
    documentId: string,
    sourceRequestId: string
  ): Promise<DocumentCommittedTransaction | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.transactionOutbox}
        WHERE document_id = ? AND source_request_id = ?
        ORDER BY occurred_at ASC, source_transaction_id ASC
        LIMIT 1
      `)
      .get(documentId, sourceRequestId) as SQLiteRow | undefined;
    return row ? rowToCommittedTransaction(row) : undefined;
  }

  async getCommittedTransactionByChangeSet(
    documentId: string,
    sourceChangeSetId: string
  ): Promise<DocumentCommittedTransaction | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.transactionOutbox}
        WHERE document_id = ? AND source_change_set_id = ?
        ORDER BY occurred_at ASC, source_transaction_id ASC
        LIMIT 1
      `)
      .get(documentId, sourceChangeSetId) as SQLiteRow | undefined;
    return row ? rowToCommittedTransaction(row) : undefined;
  }

  async listUnpublishedTransactions(limit?: number): Promise<DocumentCommittedTransaction[]> {
    const size = boundedLimit(
      limit,
      DEFAULT_MAINTENANCE_BATCH_SIZE,
      MAX_MAINTENANCE_BATCH_SIZE
    );
    const rows = this.db
      .prepare(`
        SELECT * FROM ${this.tables.transactionOutbox}
        WHERE published_at IS NULL
        ORDER BY occurred_at ASC, source_transaction_id ASC
        LIMIT ?
      `)
      .all(size) as SQLiteRow[];
    return rows.map(rowToCommittedTransaction);
  }

  async markTransactionPublished(sourceTransactionId: string, publishedAt: string): Promise<void> {
    this.db
      .prepare(`
        UPDATE ${this.tables.transactionOutbox}
        SET published_at = COALESCE(published_at, ?)
        WHERE source_transaction_id = ?
      `)
      .run(publishedAt, sourceTransactionId);
  }

  private insertHead(head: DocumentHead): void {
    this.db
      .prepare(`
        INSERT INTO ${this.tables.documents}
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

  private insertResource(documentId: string, createdAt: string): void {
    this.db.prepare(`
      INSERT INTO ${this.tables.resources} (id, created_at) VALUES (?, ?)
    `).run(documentId, createdAt);
  }

  private claimInitialIdentities(
    documentId: string,
    identities: DocumentIdentity[]
  ): void {
    const claimed = new Map<string, DocumentIdentity["kind"]>();
    const insert = this.db.prepare(`
      INSERT INTO ${this.tables.identityLedger}
        (document_id, identity_id, identity_kind, state, first_revision,
         last_transition_revision, tombstoned_revision)
      VALUES (?, ?, ?, 'active', 1, 1, NULL)
    `);
    for (const identity of identities) {
      const previousKind = claimed.get(identity.id);
      if (previousKind) {
        throw new DocumentIdentityReuseError(
          documentId,
          identity.id,
          previousKind,
          identity.kind
        );
      }
      claimed.set(identity.id, identity.kind);
      insert.run(documentId, identity.id, identity.kind);
    }
  }

  private applyIdentityTransitions(
    documentId: string,
    revision: number,
    transitions: DocumentIdentityTransitions,
    reactivation: DocumentIdentityReactivation
  ): void {
    for (const identity of transitions.removed) {
      const row = this.db
        .prepare(`
          SELECT * FROM ${this.tables.identityLedger}
          WHERE document_id = ? AND identity_id = ?
        `)
        .get(documentId, identity.id) as SQLiteRow | undefined;
      if (!row) {
        throw new Error(
          `Document identity ledger is missing '${identity.id}' during removal`
        );
      }
      const existing = rowToIdentityLedgerEntry(row);
      if (existing.kind !== identity.kind || existing.state !== "active") {
        throw new Error(
          `Document identity '${identity.id}' is not an active ${identity.kind}`
        );
      }
      const updated = this.db
        .prepare(`
          UPDATE ${this.tables.identityLedger}
          SET state = 'tombstoned', last_transition_revision = ?,
              tombstoned_revision = ?
          WHERE document_id = ? AND identity_id = ?
            AND identity_kind = ? AND state = 'active'
        `)
        .run(
          revision,
          revision,
          documentId,
          identity.id,
          identity.kind
        );
      if (updated.changes !== 1) {
        throw new Error(
          `Document identity '${identity.id}' could not be tombstoned`
        );
      }
    }

    for (const identity of transitions.added) {
      const row = this.db
        .prepare(`
          SELECT * FROM ${this.tables.identityLedger}
          WHERE document_id = ? AND identity_id = ?
        `)
        .get(documentId, identity.id) as SQLiteRow | undefined;
      if (!row) {
        this.db
          .prepare(`
            INSERT INTO ${this.tables.identityLedger}
              (document_id, identity_id, identity_kind, state, first_revision,
               last_transition_revision, tombstoned_revision)
            VALUES (?, ?, ?, 'active', ?, ?, NULL)
          `)
          .run(documentId, identity.id, identity.kind, revision, revision);
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
            WHERE document_id = ? AND identity_id = ?
              AND identity_kind = ? AND state = 'tombstoned'
          `)
          .run(revision, documentId, identity.id, identity.kind);
        if (updated.changes !== 1) {
          throw new Error(
            `Document identity '${identity.id}' could not be reactivated`
          );
        }
        continue;
      }

      throw new DocumentIdentityReuseError(
        documentId,
        identity.id,
        existing.kind,
        identity.kind
      );
    }
  }

  private insertBase(base: DocumentBase): void {
    this.db
      .prepare(`
        INSERT INTO ${this.tables.bases}
          (document_id, base_seq, representation_version, snapshot_json,
           semantic_digest, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        base.documentId,
        base.baseSeq,
        base.representationVersion,
        encodeJson(base.snapshot),
        base.semanticDigest,
        base.createdAt
      );
  }

  private insertChangeSet(changeSet: DocumentChangeSet): void {
    this.db
      .prepare(`
        INSERT INTO ${this.tables.changeSets}
          (id, document_id, client_request_id, request_digest,
           authored_revision, prior_revision, revision, seq, origin,
           operations_json, inverse_operations_json, touched_ids_json,
           compensation_intent, compensation_target_change_set_id,
           semantic_digest, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        changeSet.id,
        changeSet.documentId,
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

  private insertSubmission(receipt: DocumentSubmissionReceipt): void {
    this.db
      .prepare(`
        INSERT INTO ${this.tables.receipts}
          (document_id, request_id, request_digest, result_json, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        receipt.documentId,
        receipt.requestId,
        receipt.requestDigest,
        encodeJson(receipt.result),
        receipt.createdAt
      );
  }

  private insertCreateReceipt(receipt: DocumentCreateReceipt): void {
    this.db
      .prepare(`
        INSERT INTO ${this.tables.createReceipts}
          (request_id, document_id, request_digest, result_json, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        receipt.requestId,
        receipt.documentId,
        receipt.requestDigest,
        encodeJson(receipt.result),
        receipt.createdAt
      );
  }

  private insertCommittedTransaction(transaction: DocumentCommittedTransaction): void {
    this.db
      .prepare(`
        INSERT INTO ${this.tables.transactionOutbox}
          (source_transaction_id, source_request_id, transaction_kind, document_id,
           resource_root_id, revision,
           change_set_id, source_change_set_id, actor_id, origin,
           operation_types, semantic_digest,
           compensation_intent, compensation_target_change_set_id, occurred_at,
           published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
      `)
      .run(
        transaction.sourceTransactionId,
        transaction.sourceRequestId,
        transaction.kind,
        transaction.documentId,
        transaction.documentId,
        transaction.revision,
        transaction.sourceChangeSetId ?? null,
        transaction.sourceChangeSetId ?? null,
        transaction.actorId ?? null,
        transaction.origin,
        encodeJson(transaction.operationTypes),
        transaction.sourceSemanticDigest,
        transaction.compensation?.intent ?? null,
        transaction.compensation?.targetChangeSetId ?? null,
        transaction.occurredAt
      );
  }

  private insertAttempt(attempt: DocumentAttempt): void {
    const storage = attemptToStorageParts(attempt);
    this.db
      .prepare(`
        INSERT INTO ${this.tables.attempts}
          (id, document_id, kind, client_request_id, request_digest,
           block_id, frozen_document_revision, state, frozen_json,
           candidate_json, diagnostic_json, settled_change_set_id,
           created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        attempt.id,
        attempt.documentId,
        attempt.kind,
        attempt.clientRequestId,
        attempt.requestDigest,
        attempt.blockId,
        attempt.frozenDocumentRevision,
        attempt.state,
        storage.frozenJson,
        storage.candidateJson,
        storage.diagnosticJson,
        attempt.settledChangeSetId ?? null,
        attempt.createdAt,
        attempt.updatedAt
      );
  }

  private updateAttemptRow(attempt: DocumentAttempt): void {
    const storage = attemptToStorageParts(attempt);
    const result = this.db
      .prepare(`
        UPDATE ${this.tables.attempts}
        SET client_request_id = ?, request_digest = ?, block_id = ?,
            frozen_document_revision = ?, state = ?, frozen_json = ?,
            candidate_json = ?, diagnostic_json = ?, settled_change_set_id = ?,
            updated_at = ?
        WHERE id = ? AND document_id = ? AND kind = ?
      `)
      .run(
        attempt.clientRequestId,
        attempt.requestDigest,
        attempt.blockId,
        attempt.frozenDocumentRevision,
        attempt.state,
        storage.frozenJson,
        storage.candidateJson,
        storage.diagnosticJson,
        attempt.settledChangeSetId ?? null,
        attempt.updatedAt,
        attempt.id,
        attempt.documentId,
        attempt.kind
      );
    if (result.changes !== 1) {
      throw new Error(`Document attempt not found: ${attempt.id}`);
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
      existing.documentId !== transition.documentId ||
      existing.blockId !== transition.blockId
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
        WHERE output_id = ? AND document_id = ? AND block_id = ?
      `)
      .run(
        transition.creationAttemptId ?? existing.creationAttemptId ?? null,
        transition.state,
        attachedRevision ?? null,
        detachedRevision ?? null,
        transition.at,
        transition.outputId,
        transition.documentId,
        transition.blockId
      );
    if (result.changes !== 1) {
      throw new Error(`Prompt-output ownership not found: ${transition.outputId}`);
    }
  }

  private assertSameStage(
    existing: DocumentStageReceipt,
    incoming: DocumentStageReceipt
  ): void {
    if (
      existing.idempotencyKey !== incoming.idempotencyKey ||
      existing.requestDigest !== incoming.requestDigest
    ) {
      throw new Error("Document stage receipt does not match the claimed stage");
    }
  }

  private finishStageRow(
    receipt: DocumentStageReceipt,
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
        `Document stage was not claimed: ${receipt.attemptId}/${receipt.stage}`
      );
    }
    const existing = rowToStageReceipt(row);
    this.assertSameStage(existing, receipt);
    if (existing.state === "completed") {
      if (state === "completed") return;
      throw new Error("A completed Document stage cannot be marked failed");
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
