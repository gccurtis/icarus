import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database, { type Database as DatabaseConnection } from "better-sqlite3";
import type { Logger } from "#platform/observability/logger.js";
import {
  insertHistoryDeletion,
  insertHistorySnapshot,
  purgeResourceHistory
} from "#utils/persistence/resourceHistory.js";
import type {
  DeckBase,
  DeckChangeSet,
  DeckCommittedTransaction,
  DeckCreateReceipt,
  DeckHead,
  DeckLifecycle,
  DeckSubmissionReceipt,
  PromptOutputOwnership,
  PromptSite,
  SlideAttempt,
  SlideStageReceipt
} from "../domain/model.js";
import type {
  SlideIdentity,
  SlideIdentityLedgerEntry,
  SlideIdentityReactivation,
  SlideIdentityTransitions
} from "../domain/identities.js";
import { InvalidDeckCursorError, SlideIdentityReuseError } from "../domain/errors.js";
import type {
  DeckCreationCommit,
  DeckMutationCommit,
  PromptOwnershipTransition,
  SlidesStore,
  StageClaimResult
} from "../ports/slidesStore.js";
import {
  attemptToStorageParts,
  encodeJson,
  promptSiteKey,
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
  createSlideTableNames,
  initializeSlidesSchema,
  type SlideTableNames
} from "./sqliteSchema.js";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;
const RESOURCE_KIND = "deck";

interface HeadCursor {
  kind: "deck-head";
  updatedAt: string;
  id: string;
}

interface ChangeCursor {
  kind: "deck-change";
  seq: number;
}

const boundedLimit = (limit: number | undefined, fallback: number, max: number): number => {
  if (limit === undefined || !Number.isSafeInteger(limit) || limit <= 0) return fallback;
  return Math.min(limit, max);
};

const encodeCursor = (cursor: HeadCursor | ChangeCursor): string =>
  Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");

const decodeCursor = <T extends HeadCursor | ChangeCursor>(
  cursor: string,
  kind: T["kind"]
): T => {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new InvalidDeckCursorError();
  }
  if (!value || typeof value !== "object" || (value as { kind?: unknown }).kind !== kind) {
    throw new InvalidDeckCursorError();
  }
  if (kind === "deck-head") {
    const head = value as Partial<HeadCursor>;
    if (
      typeof head.updatedAt !== "string" ||
      head.updatedAt.length === 0 ||
      typeof head.id !== "string" ||
      head.id.length === 0
    ) {
      throw new InvalidDeckCursorError();
    }
  } else {
    const change = value as Partial<ChangeCursor>;
    if (
      typeof change.seq !== "number" ||
      !Number.isSafeInteger(change.seq) ||
      change.seq < 1
    ) {
      throw new InvalidDeckCursorError();
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
      throw new Error(`${value.label} belongs to '${value.deckId}', expected '${deckId}'`);
    }
  }
};

const TERMINAL_ATTEMPT_STATES = ["settled", "unchanged", "stale", "failed"];

/**
 * **This store logs, and no other store in this backend does.**
 *
 * Every existing persistence layer is silent — logging lives in the application
 * layer. That is a reasonable default, because a service knows *why* it is
 * writing and a store only knows *what* it wrote. It was changed here on
 * purpose: a correct-looking result reached by wrong reasoning is the failure
 * this capability is most exposed to, and several facts are visible only from
 * inside the transaction — which compare-and-set lost, which identity was
 * refused, which statement tripped a constraint.
 *
 * The cost is controlled by level. Statement-level detail is `debug`, so it is
 * off in production and complete in development. `info` is reserved for durable
 * commits, `warn` for outcomes a caller is expected to handle, and `error` for
 * state that should be impossible.
 *
 * **No user content is ever logged.** Deck titles, Rich Content, prompt text
 * and style names stay out of every payload; identifiers, counts, revisions and
 * digests go in instead. That is the same rule Comments, Persona and Derived
 * Outputs state in their capability docs, and it matters more here because a
 * Deck is largely authored prose.
 */
export class SQLiteSlidesStore implements SlidesStore {
  private readonly db: DatabaseConnection;
  private readonly tables: SlideTableNames;
  private readonly logger: Logger;

  constructor(projectId: string, dbPath: string, logger: Logger) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.tables = createSlideTableNames(projectId);
    this.logger = logger;
    initializeSlidesSchema(this.db, this.tables);
    this.logger.info("slides.store.runtime.created", {
      // The prefix, not the project ID: the prefix is already a one-way hash.
      tablePrefix: this.tables.decks,
      dbPath
    });
  }

  close(): void {
    this.db.close();
    this.logger.debug("slides.store.closed", { tablePrefix: this.tables.decks });
  }

  // ── Reads ──────────────────────────────────────────────────────────────

  async listHeads(
    cursor?: string,
    lifecycle?: DeckLifecycle,
    limit?: number
  ): Promise<{ items: DeckHead[]; nextCursor?: string }> {
    const pageSize = boundedLimit(limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const decoded = cursor ? decodeCursor<HeadCursor>(cursor, "deck-head") : undefined;
    const conditions: string[] = [];
    const parameters: unknown[] = [];
    if (lifecycle) {
      conditions.push("lifecycle = ?");
      parameters.push(lifecycle);
    }
    if (decoded) {
      conditions.push("(updated_at < ? OR (updated_at = ? AND id > ?))");
      parameters.push(decoded.updatedAt, decoded.updatedAt, decoded.id);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = this.db
      .prepare(`
        SELECT * FROM ${this.tables.decks}
        ${where}
        ORDER BY updated_at DESC, id ASC
        LIMIT ?
      `)
      .all(...parameters, pageSize + 1) as SQLiteRow[];

    const page = rows.slice(0, pageSize).map(rowToHead);
    const last = page[page.length - 1];
    const result = {
      items: page,
      ...(rows.length > pageSize && last
        ? {
            nextCursor: encodeCursor({
              kind: "deck-head",
              updatedAt: last.updatedAt,
              id: last.id
            })
          }
        : {})
    };
    this.logger.debug("slides.store.heads.listed", {
      count: page.length,
      pageSize,
      lifecycle,
      hasCursor: cursor !== undefined,
      hasMore: result.nextCursor !== undefined
    });
    return result;
  }

  async getHead(deckId: string): Promise<DeckHead | undefined> {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.decks} WHERE id = ?`)
      .get(deckId) as SQLiteRow | undefined;
    this.logger.debug("slides.store.head.read", { deckId, found: row !== undefined });
    return row ? rowToHead(row) : undefined;
  }

  async getHistoricalHead(deckId: string, revision: number): Promise<DeckHead | undefined> {
    const row = this.db
      .prepare(`
        SELECT snapshot_json FROM ${this.tables.history}
        WHERE resource_kind = ? AND resource_id = ? AND revision = ?
          AND record_type = 'snapshot'
      `)
      .get(RESOURCE_KIND, deckId, revision) as { snapshot_json: string } | undefined;
    this.logger.debug("slides.store.historical-head.read", {
      deckId,
      revision,
      found: row !== undefined
    });
    return row ? (JSON.parse(row.snapshot_json) as DeckHead) : undefined;
  }

  async hasResource(deckId: string): Promise<boolean> {
    const row = this.db
      .prepare(`SELECT 1 FROM ${this.tables.resources} WHERE id = ?`)
      .get(deckId);
    return row !== undefined;
  }

  async getBaseAtOrBefore(deckId: string, revision: number): Promise<DeckBase | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.bases}
        WHERE deck_id = ? AND base_seq <= ?
        ORDER BY base_seq DESC
        LIMIT 1
      `)
      .get(deckId, revision) as SQLiteRow | undefined;
    this.logger.debug("slides.store.base.read", {
      deckId,
      atOrBefore: revision,
      found: row !== undefined,
      ...(row ? { baseSeq: Number(row.base_seq) } : {})
    });
    return row ? rowToBase(row) : undefined;
  }

  async getChangeSets(
    deckId: string,
    fromExclusive: number,
    toInclusive: number
  ): Promise<DeckChangeSet[]> {
    const rows = this.db
      .prepare(`
        SELECT * FROM ${this.tables.changeSets}
        WHERE deck_id = ? AND seq > ? AND seq <= ?
        ORDER BY seq ASC
      `)
      .all(deckId, fromExclusive, toInclusive) as SQLiteRow[];
    this.logger.debug("slides.store.change-sets.read", {
      deckId,
      fromExclusive,
      toInclusive,
      count: rows.length
    });
    return rows.map(rowToChangeSet);
  }

  async listChangeSets(
    deckId: string,
    cursor?: string,
    limit?: number
  ): Promise<{ items: DeckChangeSet[]; nextCursor?: string }> {
    const pageSize = boundedLimit(limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const decoded = cursor ? decodeCursor<ChangeCursor>(cursor, "deck-change") : undefined;
    const rows = this.db
      .prepare(`
        SELECT * FROM ${this.tables.changeSets}
        WHERE deck_id = ? ${decoded ? "AND seq < ?" : ""}
        ORDER BY seq DESC
        LIMIT ?
      `)
      .all(
        ...(decoded ? [deckId, decoded.seq, pageSize + 1] : [deckId, pageSize + 1])
      ) as SQLiteRow[];

    const page = rows.slice(0, pageSize).map(rowToChangeSet);
    const last = page[page.length - 1];
    this.logger.debug("slides.store.change-sets.listed", {
      deckId,
      count: page.length,
      hasMore: rows.length > pageSize
    });
    return {
      items: page,
      ...(rows.length > pageSize && last
        ? { nextCursor: encodeCursor({ kind: "deck-change", seq: last.seq }) }
        : {})
    };
  }

  async getChangeSet(deckId: string, changeSetId: string): Promise<DeckChangeSet | undefined> {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.changeSets} WHERE deck_id = ? AND id = ?`)
      .get(deckId, changeSetId) as SQLiteRow | undefined;
    return row ? rowToChangeSet(row) : undefined;
  }

  async getSubmission(
    deckId: string,
    requestId: string
  ): Promise<DeckSubmissionReceipt | undefined> {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.receipts} WHERE deck_id = ? AND request_id = ?`)
      .get(deckId, requestId) as SQLiteRow | undefined;
    this.logger.debug("slides.store.receipt.read", {
      deckId,
      requestId,
      found: row !== undefined
    });
    return row ? rowToSubmission(row) : undefined;
  }

  async getCreateSubmission(requestId: string): Promise<DeckCreateReceipt | undefined> {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.createReceipts} WHERE request_id = ?`)
      .get(requestId) as SQLiteRow | undefined;
    this.logger.debug("slides.store.create-receipt.read", {
      requestId,
      found: row !== undefined
    });
    return row ? rowToCreateReceipt(row) : undefined;
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

  // ── Writes ─────────────────────────────────────────────────────────────

  async recordSubmission(receipt: DeckSubmissionReceipt): Promise<void> {
    this.insertSubmission(receipt);
  }

  async commitCreation(commit: DeckCreationCommit): Promise<void> {
    assertSameDeck(commit.head.id, [
      { label: "Deck Base", deckId: commit.base.deckId },
      { label: "Deck receipt", deckId: commit.receipt.deckId },
      { label: "Deck transaction", deckId: commit.transaction.deckId }
    ]);
    if (commit.head.revision !== 1 || commit.base.baseSeq !== 1) {
      throw new Error("Deck creation must commit revision-one head and Base");
    }

    this.db.transaction(() => {
      this.db
        .prepare(`INSERT INTO ${this.tables.resources} (id, created_at) VALUES (?, ?)`)
        .run(commit.head.id, commit.head.createdAt);
      this.insertHead(commit.head);
      this.claimInitialIdentities(commit.head.id, commit.identities);
      this.insertBase(commit.base);
      this.insertSubmission(commit.receipt);
      this.insertCreateReceipt(commit.createReceipt);
      this.insertCommittedTransaction(commit.transaction);
    })();

    this.logger.info("slides.store.deck.created", {
      deckId: commit.head.id,
      requestId: commit.receipt.requestId,
      revision: commit.head.revision,
      identityCount: commit.identities.length,
      semanticDigest: commit.head.semanticDigest,
      sourceTransactionId: commit.transaction.sourceTransactionId
    });
  }

  async commitMutation(commit: DeckMutationCommit): Promise<boolean> {
    const deckId = commit.head.id;
    assertSameDeck(deckId, [
      { label: "Deck ChangeSet", deckId: commit.changeSet.deckId },
      { label: "Deck receipt", deckId: commit.receipt.deckId },
      { label: "Deck transaction", deckId: commit.transaction.deckId },
      ...(commit.attempts ?? []).map((attempt) => ({
        label: "Deck attempt",
        deckId: attempt.deckId
      })),
      ...(commit.attemptUpdates ?? []).map((attempt) => ({
        label: "Deck attempt update",
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
      throw new Error("Deck mutation revisions are inconsistent");
    }
    if (
      commit.identityReactivation === "same-kind-compensation" &&
      !commit.changeSet.compensation
    ) {
      throw new Error("Deck identity reactivation requires a compensation ChangeSet");
    }

    const committed = this.db.transaction(() => {
      const previousRow = this.db
        .prepare(`SELECT * FROM ${this.tables.decks} WHERE id = ? AND revision = ?`)
        .get(deckId, commit.expectedRevision) as SQLiteRow | undefined;
      if (!previousRow) return false;

      insertHistorySnapshot(this.db, this.tables.history, {
        resourceKind: RESOURCE_KIND,
        resourceId: deckId,
        revision: commit.expectedRevision,
        snapshot: rowToHead(previousRow),
        recordedAt: commit.head.updatedAt
      });

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
      for (const attempt of commit.attempts ?? []) this.insertAttempt(attempt);
      for (const attempt of commit.attemptUpdates ?? []) this.updateAttemptRow(attempt);
      for (const transition of commit.promptOwnershipTransitions ?? []) {
        this.updatePromptOutputOwnershipRow(transition);
      }
      this.insertSubmission(commit.receipt);
      this.insertCommittedTransaction(commit.transaction);
      return true;
    })();

    if (!committed) {
      // Losing the compare-and-set is an ordinary concurrent-writer outcome, so
      // it is a caller's problem to report, not a fault. It is logged because
      // "why did my write vanish" is otherwise invisible from outside.
      this.logger.warn("slides.store.mutation.rejected", {
        deckId,
        requestId: commit.receipt.requestId,
        expectedRevision: commit.expectedRevision,
        reason: "revision-conflict"
      });
      return false;
    }

    this.logger.info("slides.store.mutation.committed", {
      deckId,
      requestId: commit.receipt.requestId,
      changeSetId: commit.changeSet.id,
      priorRevision: commit.changeSet.priorRevision,
      revision: commit.changeSet.revision,
      // Operation *types* only — the operations themselves carry authored text.
      operationTypes: commit.changeSet.operations.map((operation) => operation.type),
      operationCount: commit.changeSet.operations.length,
      inverseCount: commit.changeSet.inverseOperations.length,
      touchedIdCount: commit.changeSet.touchedIds.length,
      identitiesAdded: commit.identityTransitions.added.length,
      identitiesRemoved: commit.identityTransitions.removed.length,
      identityReactivation: commit.identityReactivation,
      attemptsCreated: commit.attempts?.length ?? 0,
      attemptsUpdated: commit.attemptUpdates?.length ?? 0,
      promptTransitions: commit.promptOwnershipTransitions?.length ?? 0,
      compensationIntent: commit.changeSet.compensation?.intent,
      semanticDigest: commit.changeSet.semanticDigest
    });
    return true;
  }

  async appendBaseIfHead(
    deckId: string,
    expectedHeadRevision: number,
    base: DeckBase
  ): Promise<boolean> {
    if (base.deckId !== deckId) {
      throw new Error(`Deck Base belongs to '${base.deckId}', expected '${deckId}'`);
    }
    const appended = this.db.transaction(() => {
      const head = this.db
        .prepare(`SELECT revision FROM ${this.tables.decks} WHERE id = ? AND revision = ?`)
        .get(deckId, expectedHeadRevision) as { revision: number } | undefined;
      if (!head) return false;
      this.insertBase(base);
      this.db
        .prepare(`UPDATE ${this.tables.decks} SET base_seq = ? WHERE id = ? AND revision = ?`)
        .run(base.baseSeq, deckId, expectedHeadRevision);
      return true;
    })();

    if (appended) {
      this.logger.info("slides.store.base.appended", {
        deckId,
        baseSeq: base.baseSeq,
        headRevision: expectedHeadRevision,
        semanticDigest: base.semanticDigest
      });
    } else {
      this.logger.debug("slides.store.base.skipped", {
        deckId,
        baseSeq: base.baseSeq,
        expectedHeadRevision,
        reason: "head-moved"
      });
    }
    return appended;
  }

  async pruneHistory(
    deckId: string,
    retainedBaseCount: number,
    retainedChangeSetCount: number,
    retainedTerminalAttemptCount: number
  ): Promise<void> {
    const removed = this.db.transaction(() => {
      const bases = this.db
        .prepare(`
          DELETE FROM ${this.tables.bases}
          WHERE deck_id = ? AND base_seq NOT IN (
            SELECT base_seq FROM ${this.tables.bases}
            WHERE deck_id = ? ORDER BY base_seq DESC LIMIT ?
          )
        `)
        .run(deckId, deckId, Math.max(1, retainedBaseCount)).changes;

      const changeSets = this.db
        .prepare(`
          DELETE FROM ${this.tables.changeSets}
          WHERE deck_id = ? AND seq NOT IN (
            SELECT seq FROM ${this.tables.changeSets}
            WHERE deck_id = ? ORDER BY seq DESC LIMIT ?
          )
        `)
        .run(deckId, deckId, Math.max(0, retainedChangeSetCount)).changes;

      const placeholders = TERMINAL_ATTEMPT_STATES.map(() => "?").join(", ");
      const attempts = this.db
        .prepare(`
          DELETE FROM ${this.tables.attempts}
          WHERE deck_id = ? AND state IN (${placeholders})
            AND id NOT IN (
              SELECT id FROM ${this.tables.attempts}
              WHERE deck_id = ? AND state IN (${placeholders})
              ORDER BY updated_at DESC, id DESC LIMIT ?
            )
        `)
        .run(
          deckId,
          ...TERMINAL_ATTEMPT_STATES,
          deckId,
          ...TERMINAL_ATTEMPT_STATES,
          Math.max(0, retainedTerminalAttemptCount)
        ).changes;

      return { bases, changeSets, attempts };
    })();

    this.logger.info("slides.store.history.pruned", {
      deckId,
      basesRemoved: removed.bases,
      changeSetsRemoved: removed.changeSets,
      attemptsRemoved: removed.attempts,
      retainedBaseCount,
      retainedChangeSetCount,
      retainedTerminalAttemptCount
    });
  }

  async deleteDeck(
    deckId: string,
    deletedAt: string,
    transaction: DeckCommittedTransaction
  ): Promise<number | null> {
    const revision = this.db.transaction(() => {
      const row = this.db
        .prepare(`SELECT * FROM ${this.tables.decks} WHERE id = ?`)
        .get(deckId) as SQLiteRow | undefined;
      if (!row) return null;

      const head = rowToHead(row);
      const terminalRevision = head.revision + 1;
      insertHistorySnapshot(this.db, this.tables.history, {
        resourceKind: RESOURCE_KIND,
        resourceId: deckId,
        revision: head.revision,
        snapshot: head,
        recordedAt: deletedAt
      });
      insertHistoryDeletion(this.db, this.tables.history, {
        resourceKind: RESOURCE_KIND,
        resourceId: deckId,
        revision: terminalRevision,
        recordedAt: deletedAt
      });
      // Retained prompt outputs move to the stable root before the operational
      // rows cascade away, so a reclaimer can still find what this Deck owned.
      const retain = this.db.prepare(`
        INSERT OR IGNORE INTO ${this.tables.retainedOutputs} (deck_id, output_id)
        VALUES (?, ?)
      `);
      const owned = this.db
        .prepare(`SELECT output_id FROM ${this.tables.promptOutputs} WHERE deck_id = ?`)
        .all(deckId) as Array<{ output_id: string }>;
      for (const output of owned) retain.run(deckId, output.output_id);

      this.insertCommittedTransaction({ ...transaction, revision: terminalRevision });
      this.db.prepare(`DELETE FROM ${this.tables.decks} WHERE id = ?`).run(deckId);
      return terminalRevision;
    })();

    if (revision === null) {
      this.logger.debug("slides.store.deck.delete-skipped", { deckId, reason: "not-found" });
      return null;
    }
    this.logger.info("slides.store.deck.deleted", {
      deckId,
      revision,
      sourceTransactionId: transaction.sourceTransactionId
    });
    return revision;
  }

  async purgeDeck(deckId: string): Promise<void> {
    const purged = this.db.transaction(() => {
      const removedHistory = purgeResourceHistory(
        this.db,
        this.tables.history,
        RESOURCE_KIND,
        deckId
      );
      this.db.prepare(`DELETE FROM ${this.tables.resources} WHERE id = ?`).run(deckId);
      return removedHistory;
    })();
    this.logger.info("slides.store.deck.purged", { deckId, historyRemoved: purged });
  }

  // ── Attempts ───────────────────────────────────────────────────────────

  async getAttempt(deckId: string, attemptId: string): Promise<SlideAttempt | undefined> {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.attempts} WHERE deck_id = ? AND id = ?`)
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

  async getPromptCreationAttemptBySite(
    deckId: string,
    site: PromptSite
  ): Promise<SlideAttempt | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.attempts}
        WHERE deck_id = ? AND site_key = ? AND kind = 'prompt-create'
      `)
      .get(deckId, promptSiteKey(site)) as SQLiteRow | undefined;
    return row ? rowToAttempt(row) : undefined;
  }

  async listRecoverableAttempts(): Promise<SlideAttempt[]> {
    const placeholders = TERMINAL_ATTEMPT_STATES.map(() => "?").join(", ");
    const rows = this.db
      .prepare(`
        SELECT * FROM ${this.tables.attempts}
        WHERE state NOT IN (${placeholders})
        ORDER BY updated_at ASC, id ASC
      `)
      .all(...TERMINAL_ATTEMPT_STATES) as SQLiteRow[];
    this.logger.info("slides.store.attempts.recoverable-listed", { count: rows.length });
    return rows.map(rowToAttempt);
  }

  async createAttempt(attempt: SlideAttempt): Promise<void> {
    this.insertAttempt(attempt);
    this.logger.info("slides.store.attempt.created", {
      attemptId: attempt.id,
      deckId: attempt.deckId,
      kind: attempt.kind,
      state: attempt.state,
      frozenDeckRevision: attempt.frozenDeckRevision
    });
  }

  async createAttemptWithSubmission(
    attempt: SlideAttempt,
    receipt: DeckSubmissionReceipt
  ): Promise<void> {
    this.db.transaction(() => {
      this.insertAttempt(attempt);
      this.insertSubmission(receipt);
    })();
    this.logger.info("slides.store.attempt.created", {
      attemptId: attempt.id,
      deckId: attempt.deckId,
      kind: attempt.kind,
      state: attempt.state,
      requestId: receipt.requestId,
      withReceipt: true
    });
  }

  async updateAttempt(attempt: SlideAttempt): Promise<void> {
    this.updateAttemptRow(attempt);
    this.logger.info("slides.store.attempt.updated", {
      attemptId: attempt.id,
      deckId: attempt.deckId,
      kind: attempt.kind,
      state: attempt.state,
      diagnosticCode: attempt.diagnostic?.code
    });
  }

  // ── Stage receipts ─────────────────────────────────────────────────────

  async claimStage(receipt: SlideStageReceipt): Promise<StageClaimResult> {
    const outcome = this.db.transaction((): StageClaimResult => {
      const existing = this.db
        .prepare(`
          SELECT * FROM ${this.tables.stageReceipts}
          WHERE attempt_id = ? AND stage = ?
        `)
        .get(receipt.attemptId, receipt.stage) as SQLiteRow | undefined;
      if (existing) {
        const current = rowToStageReceipt(existing);
        if (current.state === "completed") return "completed";
        if (current.state === "running") return "running";
        this.db
          .prepare(`
            UPDATE ${this.tables.stageReceipts}
            SET state = 'running', idempotency_key = ?, request_digest = ?,
                result_json = NULL, diagnostic_json = NULL, updated_at = ?
            WHERE attempt_id = ? AND stage = ?
          `)
          .run(
            receipt.idempotencyKey,
            receipt.requestDigest,
            receipt.updatedAt,
            receipt.attemptId,
            receipt.stage
          );
        return "claimed";
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
    })();

    this.logger.debug("slides.store.stage.claimed", {
      attemptId: receipt.attemptId,
      stage: receipt.stage,
      outcome
    });
    return outcome;
  }

  async completeStage(receipt: SlideStageReceipt): Promise<void> {
    this.db.transaction(() => this.finishStageRow(receipt, "completed"))();
    this.logger.debug("slides.store.stage.completed", {
      attemptId: receipt.attemptId,
      stage: receipt.stage
    });
  }

  async failStage(receipt: SlideStageReceipt): Promise<void> {
    this.db.transaction(() => this.finishStageRow(receipt, "failed"))();
    this.logger.warn("slides.store.stage.failed", {
      attemptId: receipt.attemptId,
      stage: receipt.stage,
      diagnosticCode: receipt.diagnostic?.code
    });
  }

  async recoverInterruptedStages(recoveredAt: string): Promise<number> {
    const recovered = this.db
      .prepare(`
        UPDATE ${this.tables.stageReceipts}
        SET state = 'failed',
            diagnostic_json = ?,
            updated_at = ?
        WHERE state = 'running'
      `)
      .run(
        encodeJson({
          code: "interrupted",
          message: "The stage was running when the process stopped"
        }),
        recoveredAt
      ).changes;
    if (recovered > 0) {
      this.logger.warn("slides.store.stages.recovered", { count: recovered, recoveredAt });
    }
    return recovered;
  }

  // ── Prompt-output ownership ────────────────────────────────────────────

  async getPromptOutputOwnership(outputId: string): Promise<PromptOutputOwnership | undefined> {
    const row = this.db
      .prepare(`SELECT * FROM ${this.tables.promptOutputs} WHERE output_id = ?`)
      .get(outputId) as SQLiteRow | undefined;
    return row ? rowToPromptOutputOwnership(row) : undefined;
  }

  async getPromptOutputOwnershipBySite(
    deckId: string,
    site: PromptSite
  ): Promise<PromptOutputOwnership | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.promptOutputs}
        WHERE deck_id = ? AND site_key = ?
      `)
      .get(deckId, promptSiteKey(site)) as SQLiteRow | undefined;
    return row ? rowToPromptOutputOwnership(row) : undefined;
  }

  async registerPendingPromptOutput(ownership: PromptOutputOwnership): Promise<void> {
    this.db
      .prepare(`
        INSERT INTO ${this.tables.promptOutputs}
          (output_id, deck_id, site_key, site_json, creation_attempt_id, state,
           attached_revision, detached_revision, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'pending', NULL, NULL, ?, ?)
        ON CONFLICT(output_id) DO NOTHING
      `)
      .run(
        ownership.outputId,
        ownership.deckId,
        promptSiteKey(ownership.site),
        encodeJson(ownership.site),
        ownership.creationAttemptId ?? null,
        ownership.createdAt,
        ownership.updatedAt
      );
    this.logger.info("slides.store.prompt-output.registered", {
      outputId: ownership.outputId,
      deckId: ownership.deckId,
      siteKey: promptSiteKey(ownership.site),
      creationAttemptId: ownership.creationAttemptId
    });
  }

  async updatePromptOutputOwnership(transition: PromptOwnershipTransition): Promise<void> {
    this.db.transaction(() => this.updatePromptOutputOwnershipRow(transition))();
    this.logger.info("slides.store.prompt-output.transitioned", {
      outputId: transition.outputId,
      deckId: transition.deckId,
      siteKey: promptSiteKey(transition.site),
      state: transition.state,
      attachedRevision: transition.attachedRevision,
      detachedRevision: transition.detachedRevision
    });
  }

  async listDetachedPromptOutputs(limit?: number): Promise<PromptOutputOwnership[]> {
    const pageSize = boundedLimit(limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const rows = this.db
      .prepare(`
        SELECT * FROM ${this.tables.promptOutputs}
        WHERE state = 'detached'
        ORDER BY updated_at ASC, output_id ASC
        LIMIT ?
      `)
      .all(pageSize) as SQLiteRow[];
    this.logger.debug("slides.store.prompt-outputs.detached-listed", { count: rows.length });
    return rows.map(rowToPromptOutputOwnership);
  }

  async listPromptOutputsForDeck(deckId: string): Promise<PromptOutputOwnership[]> {
    const rows = this.db
      .prepare(`
        SELECT * FROM ${this.tables.promptOutputs}
        WHERE deck_id = ?
        ORDER BY output_id ASC
      `)
      .all(deckId) as SQLiteRow[];
    return rows.map(rowToPromptOutputOwnership);
  }

  // ── Activity outbox ────────────────────────────────────────────────────

  async getCommittedTransaction(
    sourceTransactionId: string
  ): Promise<DeckCommittedTransaction | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.transactionOutbox}
        WHERE source_transaction_id = ?
      `)
      .get(sourceTransactionId) as SQLiteRow | undefined;
    return row ? rowToCommittedTransaction(row) : undefined;
  }

  async getCommittedTransactionByRequest(
    deckId: string,
    sourceRequestId: string
  ): Promise<DeckCommittedTransaction | undefined> {
    const row = this.db
      .prepare(`
        SELECT * FROM ${this.tables.transactionOutbox}
        WHERE deck_id = ? AND source_request_id = ?
        ORDER BY revision DESC
        LIMIT 1
      `)
      .get(deckId, sourceRequestId) as SQLiteRow | undefined;
    return row ? rowToCommittedTransaction(row) : undefined;
  }

  async listUnpublishedTransactions(limit?: number): Promise<DeckCommittedTransaction[]> {
    const pageSize = boundedLimit(limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const rows = this.db
      .prepare(`
        SELECT * FROM ${this.tables.transactionOutbox}
        WHERE published_at IS NULL
        ORDER BY occurred_at ASC, source_transaction_id ASC
        LIMIT ?
      `)
      .all(pageSize) as SQLiteRow[];
    this.logger.debug("slides.store.outbox.unpublished-listed", { count: rows.length });
    return rows.map(rowToCommittedTransaction);
  }

  async markTransactionPublished(
    sourceTransactionId: string,
    publishedAt: string
  ): Promise<void> {
    const changes = this.db
      .prepare(`
        UPDATE ${this.tables.transactionOutbox}
        SET published_at = ?
        WHERE source_transaction_id = ? AND published_at IS NULL
      `)
      .run(publishedAt, sourceTransactionId).changes;
    this.logger.debug("slides.store.outbox.published", {
      sourceTransactionId,
      alreadyPublished: changes === 0
    });
  }

  // ── Private ────────────────────────────────────────────────────────────

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

  private insertBase(base: DeckBase): void {
    this.db
      .prepare(`
        INSERT INTO ${this.tables.bases}
          (deck_id, base_seq, representation_version, snapshot_json,
           semantic_digest, created_at)
        VALUES (?, ?, 1, ?, ?, ?)
      `)
      .run(
        base.deckId,
        base.baseSeq,
        encodeJson(base.snapshot),
        base.semanticDigest,
        base.createdAt
      );
  }

  private insertChangeSet(changeSet: DeckChangeSet): void {
    this.db
      .prepare(`
        INSERT INTO ${this.tables.changeSets}
          (id, deck_id, client_request_id, request_digest, authored_revision,
           prior_revision, revision, seq, origin, operations_json,
           inverse_operations_json, touched_ids_json, compensation_intent,
           compensation_target_change_set_id, semantic_digest, created_at)
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

  private insertSubmission(receipt: DeckSubmissionReceipt): void {
    this.db
      .prepare(`
        INSERT INTO ${this.tables.receipts}
          (deck_id, request_id, request_digest, result_json, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(deck_id, request_id) DO NOTHING
      `)
      .run(
        receipt.deckId,
        receipt.requestId,
        receipt.requestDigest,
        encodeJson(receipt.result),
        receipt.createdAt
      );
  }

  private insertCreateReceipt(receipt: DeckCreateReceipt): void {
    this.db
      .prepare(`
        INSERT INTO ${this.tables.createReceipts}
          (request_id, deck_id, request_digest, result_json, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(request_id) DO NOTHING
      `)
      .run(
        receipt.requestId,
        receipt.deckId,
        receipt.requestDigest,
        encodeJson(receipt.result),
        receipt.createdAt
      );
  }

  private insertCommittedTransaction(transaction: DeckCommittedTransaction): void {
    this.db
      .prepare(`
        INSERT INTO ${this.tables.transactionOutbox}
          (source_transaction_id, source_request_id, transaction_kind, deck_id,
           resource_root_id, revision, change_set_id, source_change_set_id,
           actor_id, origin, operation_types, semantic_digest,
           compensation_intent, compensation_target_change_set_id,
           occurred_at, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        ON CONFLICT(source_transaction_id) DO NOTHING
      `)
      .run(
        transaction.sourceTransactionId,
        transaction.sourceRequestId,
        transaction.kind,
        transaction.deckId,
        transaction.deckId,
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

  private insertAttempt(attempt: SlideAttempt): void {
    const parts = attemptToStorageParts(attempt);
    this.db
      .prepare(`
        INSERT INTO ${this.tables.attempts}
          (id, deck_id, kind, client_request_id, request_digest, site_key,
           frozen_deck_revision, state, frozen_json, candidate_json,
           diagnostic_json, settled_change_set_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        attempt.id,
        attempt.deckId,
        attempt.kind,
        attempt.clientRequestId,
        attempt.requestDigest,
        parts.siteKey,
        attempt.frozenDeckRevision,
        attempt.state,
        parts.frozenJson,
        parts.candidateJson,
        parts.diagnosticJson,
        attempt.settledChangeSetId ?? null,
        attempt.createdAt,
        attempt.updatedAt
      );
  }

  private updateAttemptRow(attempt: SlideAttempt): void {
    const parts = attemptToStorageParts(attempt);
    const changes = this.db
      .prepare(`
        UPDATE ${this.tables.attempts}
        SET state = ?, frozen_json = ?, candidate_json = ?, diagnostic_json = ?,
            settled_change_set_id = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(
        attempt.state,
        parts.frozenJson,
        parts.candidateJson,
        parts.diagnosticJson,
        attempt.settledChangeSetId ?? null,
        attempt.updatedAt,
        attempt.id
      ).changes;
    if (changes !== 1) {
      throw new Error(`Deck attempt could not be updated: ${attempt.id}`);
    }
  }

  private finishStageRow(
    receipt: SlideStageReceipt,
    state: "completed" | "failed"
  ): void {
    const changes = this.db
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
      ).changes;
    if (changes !== 1) {
      throw new Error(
        `Deck stage receipt could not be finished: ${receipt.attemptId}/${receipt.stage}`
      );
    }
  }

  private updatePromptOutputOwnershipRow(transition: PromptOwnershipTransition): void {
    const existing = this.db
      .prepare(`SELECT * FROM ${this.tables.promptOutputs} WHERE output_id = ?`)
      .get(transition.outputId) as SQLiteRow | undefined;

    const siteKey = promptSiteKey(transition.site);
    if (!existing) {
      this.db
        .prepare(`
          INSERT INTO ${this.tables.promptOutputs}
            (output_id, deck_id, site_key, site_json, creation_attempt_id, state,
             attached_revision, detached_revision, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          transition.outputId,
          transition.deckId,
          siteKey,
          encodeJson(transition.site),
          transition.creationAttemptId ?? null,
          transition.state,
          transition.attachedRevision ?? null,
          transition.detachedRevision ?? null,
          transition.at,
          transition.at
        );
      return;
    }

    const current = rowToPromptOutputOwnership(existing);
    const attachedRevision =
      transition.state === "attached"
        ? transition.attachedRevision ?? current.attachedRevision
        : current.attachedRevision;
    const detachedRevision =
      transition.state === "detached"
        ? transition.detachedRevision ?? current.detachedRevision
        : current.detachedRevision;

    this.db
      .prepare(`
        UPDATE ${this.tables.promptOutputs}
        SET site_key = ?, site_json = ?, state = ?, attached_revision = ?,
            detached_revision = ?, updated_at = ?
        WHERE output_id = ?
      `)
      .run(
        siteKey,
        encodeJson(transition.site),
        transition.state,
        attachedRevision ?? null,
        detachedRevision ?? null,
        transition.at,
        transition.outputId
      );
  }

  private claimInitialIdentities(deckId: string, identities: SlideIdentity[]): void {
    const claimed = new Map<string, SlideIdentity["kind"]>();
    const insert = this.db.prepare(`
      INSERT INTO ${this.tables.identityLedger}
        (deck_id, identity_id, identity_kind, state, first_revision,
         last_transition_revision, tombstoned_revision)
      VALUES (?, ?, ?, 'active', 1, 1, NULL)
    `);
    for (const identity of identities) {
      const previousKind = claimed.get(identity.id);
      if (previousKind) {
        this.logger.error("slides.store.identity.reused", {
          deckId,
          identityId: identity.id,
          previousKind,
          requestedKind: identity.kind,
          at: "creation"
        });
        throw new SlideIdentityReuseError(deckId, identity.id, previousKind, identity.kind);
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
        throw new Error(`Deck identity ledger is missing '${identity.id}' during removal`);
      }
      const existing = rowToIdentityLedgerEntry(row);
      if (existing.kind !== identity.kind || existing.state !== "active") {
        throw new Error(`Deck identity '${identity.id}' is not an active ${identity.kind}`);
      }
      const updated = this.db
        .prepare(`
          UPDATE ${this.tables.identityLedger}
          SET state = 'tombstoned', last_transition_revision = ?, tombstoned_revision = ?
          WHERE deck_id = ? AND identity_id = ? AND identity_kind = ? AND state = 'active'
        `)
        .run(revision, revision, deckId, identity.id, identity.kind);
      if (updated.changes !== 1) {
        throw new Error(`Deck identity '${identity.id}' could not be tombstoned`);
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
            SET state = 'active', last_transition_revision = ?, tombstoned_revision = NULL
            WHERE deck_id = ? AND identity_id = ? AND identity_kind = ? AND state = 'tombstoned'
          `)
          .run(revision, deckId, identity.id, identity.kind);
        if (updated.changes !== 1) {
          throw new Error(`Deck identity '${identity.id}' could not be reactivated`);
        }
        this.logger.info("slides.store.identity.reactivated", {
          deckId,
          identityId: identity.id,
          kind: identity.kind,
          revision
        });
        continue;
      }

      this.logger.warn("slides.store.identity.reused", {
        deckId,
        identityId: identity.id,
        previousKind: existing.kind,
        requestedKind: identity.kind,
        previousState: existing.state,
        reactivation,
        revision
      });
      throw new SlideIdentityReuseError(deckId, identity.id, existing.kind, identity.kind);
    }
  }
}
