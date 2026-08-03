import type {
  DocumentAttempt,
  DocumentBase,
  DocumentChangeSet,
  DocumentCommittedTransaction,
  DocumentCreateReceipt,
  DocumentHead,
  DocumentLifecycle,
  PromptCreationAttempt,
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

export interface DocumentCreationCommit {
  head: DocumentHead;
  base: DocumentBase;
  identities: DocumentIdentity[];
  receipt: DocumentSubmissionReceipt;
  /**
   * Written in the same transaction as the receipt above. The two are not
   * redundant: this one makes the create replayable by request id, while the
   * document-keyed receipt keeps the request-id reuse guard working for later
   * commands on the same document.
   */
  createReceipt: DocumentCreateReceipt;
  /**
   * Ownership rows for outputs declared during a copy. `document.create` has
   * none; `duplicate` declares one per Prompt Block and must record ownership in
   * the same transaction, or a crash would leave outputs no Document claims.
   */
  promptOutputs?: PromptOutputOwnership[];
  transaction: DocumentCommittedTransaction;
}

export interface PromptOwnershipTransition {
  outputId: string;
  documentId: string;
  blockId: string;
  creationAttemptId?: string;
  state: PromptOutputOwnership["state"];
  attachedRevision?: number;
  detachedRevision?: number;
  at: string;
}

export interface DocumentMutationCommit {
  expectedRevision: number;
  head: DocumentHead;
  changeSet: DocumentChangeSet;
  receipt: DocumentSubmissionReceipt;
  transaction: DocumentCommittedTransaction;
  identityTransitions: DocumentIdentityTransitions;
  identityReactivation: DocumentIdentityReactivation;
  attempts?: DocumentAttempt[];
  attemptUpdates?: DocumentAttempt[];
  promptOwnershipTransitions?: PromptOwnershipTransition[];
}

export interface PromptCreationFailureCommit {
  attempt: PromptCreationAttempt;
  receipt: DocumentStageReceipt;
}

export interface DocumentRetentionAnchor {
  documentId: string;
  revision: number;
  /** Present for a live Document and used as the compaction CAS guard. */
  currentRevision?: number;
}

export type StageClaimResult = "claimed" | "running" | "completed";

export interface DocumentStore {
  listHeads(
    cursor?: string,
    lifecycle?: DocumentLifecycle,
    limit?: number
  ): Promise<{ items: DocumentHead[]; nextCursor?: string }>;
  getHead(documentId: string): Promise<DocumentHead | undefined>;
  getBaseAtOrBefore(documentId: string, revision: number): Promise<DocumentBase | undefined>;
  getChangeSets(
    documentId: string,
    fromExclusive: number,
    toInclusive: number
  ): Promise<DocumentChangeSet[]>;
  listChangeSets(
    documentId: string,
    cursor?: string,
    limit?: number
  ): Promise<{ items: DocumentChangeSet[]; nextCursor?: string }>;
  getChangeSet(documentId: string, changeSetId: string): Promise<DocumentChangeSet | undefined>;
  getSubmission(
    documentId: string,
    requestId: string
  ): Promise<DocumentSubmissionReceipt | undefined>;
  /** Replay lookup for document.create, which has no document id at retry time. */
  getCreateSubmission(requestId: string): Promise<DocumentCreateReceipt | undefined>;
  getIdentity(
    documentId: string,
    identityId: string
  ): Promise<DocumentIdentityLedgerEntry | undefined>;
  recordSubmission(receipt: DocumentSubmissionReceipt): Promise<void>;

  /**
   * Seals a Document. One-way: there is no method that clears the flag, and the
   * absence is the point rather than an oversight.
   */
  markAsTemplate(documentId: string): Promise<void>;

  commitCreation(commit: DocumentCreationCommit): Promise<void>;
  commitMutation(commit: DocumentMutationCommit): Promise<boolean>;

  appendBaseIfHead(
    documentId: string,
    expectedHeadRevision: number,
    base: DocumentBase
  ): Promise<boolean>;
  pruneHistory(
    documentId: string,
    retainedBaseCount: number,
    retainedChangeSetCount: number,
    retainedTerminalAttemptCount: number
  ): Promise<void>;

  getAttempt(documentId: string, attemptId: string): Promise<DocumentAttempt | undefined>;
  getAttemptById(attemptId: string): Promise<DocumentAttempt | undefined>;
  getAttemptByRequest(
    documentId: string,
    kind: DocumentAttempt["kind"],
    requestId: string
  ): Promise<DocumentAttempt | undefined>;
  getPromptCreationAttemptByBlock(
    documentId: string,
    blockId: string
  ): Promise<DocumentAttempt | undefined>;
  listRecoverableAttempts(): Promise<DocumentAttempt[]>;
  createAttempt(attempt: DocumentAttempt): Promise<void>;
  createAttemptWithSubmission(
    attempt: DocumentAttempt,
    receipt: DocumentSubmissionReceipt
  ): Promise<void>;
  updateAttempt(attempt: DocumentAttempt): Promise<void>;

  claimStage(receipt: DocumentStageReceipt): Promise<StageClaimResult>;
  completeStage(receipt: DocumentStageReceipt): Promise<void>;
  failStage(receipt: DocumentStageReceipt): Promise<void>;
  failPromptCreationStage(commit: PromptCreationFailureCommit): Promise<void>;
  recoverInterruptedStages(recoveredAt: string): Promise<number>;

  getPromptOutputOwnership(outputId: string): Promise<PromptOutputOwnership | undefined>;
  getPromptOutputOwnershipByBlock(
    documentId: string,
    blockId: string
  ): Promise<PromptOutputOwnership | undefined>;
  registerPendingPromptOutput(ownership: PromptOutputOwnership): Promise<void>;
  updatePromptOutputOwnership(transition: PromptOwnershipTransition): Promise<void>;
  listDetachedPromptOutputs(limit?: number): Promise<PromptOutputOwnership[]>;
  /** Every ownership row for one document, in any state. Logical deletion
   *  records these outputs on the stable root before current operational rows
   *  cascade away. */
  listPromptOutputsForDocument(documentId: string): Promise<PromptOutputOwnership[]>;
  /**
   * Archives the current head, appends the terminal deletion revision, stages
   * the deletion transaction, and removes only current operational state.
   */
  deleteDocument(
    documentId: string,
    deletedAt: string,
    transaction: DocumentCommittedTransaction
  ): Promise<number | null>;
  purgeDocument(documentId: string): Promise<void>;
  hasResource(documentId: string): Promise<boolean>;
  getHistoricalHead(documentId: string, revision: number): Promise<DocumentHead | undefined>;
  listRetainedPromptOutputIds(documentId: string): Promise<string[]>;
  listRetentionAnchors(cutoff: string): Promise<DocumentRetentionAnchor[]>;
  compactRetentionHistory(
    anchor: DocumentRetentionAnchor,
    base: DocumentBase
  ): Promise<boolean>;
  pruneRevisionHistory(cutoff: string): Promise<number>;
  listExpiredDeleted(cutoff: string): Promise<string[]>;

  getCommittedTransaction(sourceTransactionId: string): Promise<DocumentCommittedTransaction | undefined>;
  getCommittedTransactionByRequest(
    documentId: string,
    sourceRequestId: string
  ): Promise<DocumentCommittedTransaction | undefined>;
  getCommittedTransactionByChangeSet(
    documentId: string,
    sourceChangeSetId: string
  ): Promise<DocumentCommittedTransaction | undefined>;
  listUnpublishedTransactions(limit?: number): Promise<DocumentCommittedTransaction[]>;
  markTransactionPublished(sourceTransactionId: string, publishedAt: string): Promise<void>;
}
