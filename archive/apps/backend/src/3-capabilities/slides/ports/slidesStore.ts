import type {
  DeckBase,
  DeckChangeSet,
  DeckCommittedTransaction,
  DeckHead,
  DeckLifecycle,
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
  transaction: DeckCommittedTransaction;
  identityTransitions: SlideIdentityTransitions;
  identityReactivation: SlideIdentityReactivation;
  attempts?: SlideAttempt[];
  attemptUpdates?: SlideAttempt[];
  promptOwnershipTransitions?: PromptOwnershipTransition[];
}

/**
 * A prompt-create stage that failed has two rows to flip, and flipping only one
 * strands the attempt: a `failed` receipt beside a `computing` attempt is
 * recovered forever, and the reverse hides the failure from the stage ledger.
 */
export interface PromptCreationFailureCommit {
  attempt: SlideAttempt;
  receipt: SlideStageReceipt;
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

  getIdentity(deckId: string, identityId: string): Promise<SlideIdentityLedgerEntry | undefined>;

  // ── Writes ─────────────────────────────────────────────────────────────
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
  /**
   * The dedupe key for prompt creation is the site, not a request id: two
   * requests to put a prompt in the same place are the same request however
   * they were labelled.
   */
  getPromptCreationAttemptBySite(
    deckId: string,
    site: PromptSite
  ): Promise<SlideAttempt | undefined>;
  /**
   * The newest attempt of `kind` at `site` that has not reached a terminal
   * state. This is what deduplicates a repeated request now that there is no
   * request id: a second "refresh this site" while one is in flight is the same
   * request, whatever the caller called it.
   */
  getLivePromptAttemptBySite(
    deckId: string,
    kind: SlideAttempt["kind"],
    site: PromptSite
  ): Promise<SlideAttempt | undefined>;
  listRecoverableAttempts(): Promise<SlideAttempt[]>;
  createAttempt(attempt: SlideAttempt): Promise<void>;
  updateAttempt(attempt: SlideAttempt): Promise<void>;

  claimStage(receipt: SlideStageReceipt): Promise<StageClaimResult>;
  completeStage(receipt: SlideStageReceipt): Promise<void>;
  failStage(receipt: SlideStageReceipt): Promise<void>;
  failPromptCreationStage(commit: PromptCreationFailureCommit): Promise<void>;
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
  getCommittedTransactionByRevision(
    deckId: string,
    revision: number
  ): Promise<DeckCommittedTransaction | undefined>;
  listUnpublishedTransactions(limit?: number): Promise<DeckCommittedTransaction[]>;
  markTransactionPublished(sourceTransactionId: string, publishedAt: string): Promise<void>;
}
