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

export interface DeckCreationCommit {
  head: DeckHead;
  base: DeckBase;
  identities: SlideIdentity[];
  receipt: DeckSubmissionReceipt;
  /**
   * Written in the same transaction as the receipt above. The two are not
   * redundant: this one makes the create replayable by request id, while the
   * deck-keyed receipt keeps the request-id reuse guard working for later
   * commands on the same Deck.
   */
  createReceipt: DeckCreateReceipt;
  transaction: DeckCommittedTransaction;
}

export interface PromptOwnershipTransition {
  outputId: string;
  deckId: string;
  site: PromptSite;
  creationAttemptId?: string;
  state: PromptOutputOwnership["state"];
  attachedRevision?: number;
  detachedRevision?: number;
  at: string;
}

export interface DeckMutationCommit {
  expectedRevision: number;
  head: DeckHead;
  changeSet: DeckChangeSet;
  receipt: DeckSubmissionReceipt;
  transaction: DeckCommittedTransaction;
  identityTransitions: SlideIdentityTransitions;
  identityReactivation: SlideIdentityReactivation;
  attempts?: SlideAttempt[];
  attemptUpdates?: SlideAttempt[];
  promptOwnershipTransitions?: PromptOwnershipTransition[];
}

export type StageClaimResult = "claimed" | "running" | "completed";

/**
 * Every method is `Promise`-returning even though better-sqlite3 is synchronous.
 * That is deliberate and matches Document: the port is what the service depends
 * on, so it must not encode the fact that today's implementation happens to be
 * an embedded synchronous database. A future store that is not — a networked
 * one, or one behind a worker — drops in without touching a caller.
 */
export interface SlidesStore {
  // ── Reads ──────────────────────────────────────────────────────────────
  listHeads(
    cursor?: string,
    lifecycle?: DeckLifecycle,
    limit?: number
  ): Promise<{ items: DeckHead[]; nextCursor?: string }>;
  getHead(deckId: string): Promise<DeckHead | undefined>;
  getHistoricalHead(deckId: string, revision: number): Promise<DeckHead | undefined>;
  hasResource(deckId: string): Promise<boolean>;

  getBaseAtOrBefore(deckId: string, revision: number): Promise<DeckBase | undefined>;
  getChangeSets(
    deckId: string,
    fromExclusive: number,
    toInclusive: number
  ): Promise<DeckChangeSet[]>;
  listChangeSets(
    deckId: string,
    cursor?: string,
    limit?: number
  ): Promise<{ items: DeckChangeSet[]; nextCursor?: string }>;
  getChangeSet(deckId: string, changeSetId: string): Promise<DeckChangeSet | undefined>;

  getSubmission(deckId: string, requestId: string): Promise<DeckSubmissionReceipt | undefined>;
  /** Replay lookup for deck.create, which has no Deck id at retry time. */
  getCreateSubmission(requestId: string): Promise<DeckCreateReceipt | undefined>;
  getIdentity(deckId: string, identityId: string): Promise<SlideIdentityLedgerEntry | undefined>;

  // ── Writes ─────────────────────────────────────────────────────────────
  recordSubmission(receipt: DeckSubmissionReceipt): Promise<void>;
  commitCreation(commit: DeckCreationCommit): Promise<void>;
  /**
   * Returns false when the compare-and-set on `expectedRevision` loses, which
   * is an ordinary concurrent-writer outcome rather than an error. Every other
   * failure throws.
   */
  commitMutation(commit: DeckMutationCommit): Promise<boolean>;

  appendBaseIfHead(
    deckId: string,
    expectedHeadRevision: number,
    base: DeckBase
  ): Promise<boolean>;
  pruneHistory(
    deckId: string,
    retainedBaseCount: number,
    retainedChangeSetCount: number,
    retainedTerminalAttemptCount: number
  ): Promise<void>;

  /**
   * Archives the current head, records the terminal deletion revision, stages
   * the deletion transaction, and removes only current operational state. The
   * resource root and retained history survive.
   */
  deleteDeck(
    deckId: string,
    deletedAt: string,
    transaction: DeckCommittedTransaction
  ): Promise<number | null>;
  purgeDeck(deckId: string): Promise<void>;

  // ── Attempts and stages ────────────────────────────────────────────────
  getAttempt(deckId: string, attemptId: string): Promise<SlideAttempt | undefined>;
  getAttemptById(attemptId: string): Promise<SlideAttempt | undefined>;
  getAttemptByRequest(
    deckId: string,
    kind: SlideAttempt["kind"],
    requestId: string
  ): Promise<SlideAttempt | undefined>;
  getPromptCreationAttemptBySite(
    deckId: string,
    site: PromptSite
  ): Promise<SlideAttempt | undefined>;
  listRecoverableAttempts(): Promise<SlideAttempt[]>;
  createAttempt(attempt: SlideAttempt): Promise<void>;
  createAttemptWithSubmission(
    attempt: SlideAttempt,
    receipt: DeckSubmissionReceipt
  ): Promise<void>;
  updateAttempt(attempt: SlideAttempt): Promise<void>;

  claimStage(receipt: SlideStageReceipt): Promise<StageClaimResult>;
  completeStage(receipt: SlideStageReceipt): Promise<void>;
  failStage(receipt: SlideStageReceipt): Promise<void>;
  recoverInterruptedStages(recoveredAt: string): Promise<number>;

  // ── Prompt-output ownership ────────────────────────────────────────────
  getPromptOutputOwnership(outputId: string): Promise<PromptOutputOwnership | undefined>;
  getPromptOutputOwnershipBySite(
    deckId: string,
    site: PromptSite
  ): Promise<PromptOutputOwnership | undefined>;
  registerPendingPromptOutput(ownership: PromptOutputOwnership): Promise<void>;
  updatePromptOutputOwnership(transition: PromptOwnershipTransition): Promise<void>;
  /**
   * Outputs that were owned and are no longer attached. Nothing consumes this
   * yet — deletion detaches rather than destroys, because compensation can
   * restore the source — but a reclaimer needs the list to exist.
   */
  listDetachedPromptOutputs(limit?: number): Promise<PromptOutputOwnership[]>;
  listPromptOutputsForDeck(deckId: string): Promise<PromptOutputOwnership[]>;

  // ── Activity outbox ────────────────────────────────────────────────────
  getCommittedTransaction(
    sourceTransactionId: string
  ): Promise<DeckCommittedTransaction | undefined>;
  getCommittedTransactionByRequest(
    deckId: string,
    sourceRequestId: string
  ): Promise<DeckCommittedTransaction | undefined>;
  listUnpublishedTransactions(limit?: number): Promise<DeckCommittedTransaction[]>;
  markTransactionPublished(sourceTransactionId: string, publishedAt: string): Promise<void>;
}
