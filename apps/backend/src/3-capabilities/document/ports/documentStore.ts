import type {
  DocumentAttempt,
  DocumentBase,
  DocumentChangeSet,
  DocumentCommittedFact,
  DocumentDelegatedCommandClaim,
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
  fact: DocumentCommittedFact;
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
  fact: DocumentCommittedFact;
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

export type StageClaimResult = "claimed" | "running" | "completed";

export type DelegatedCommandClaimResult =
  | { type: "claim"; claim: DocumentDelegatedCommandClaim }
  | { type: "receipt"; receipt: DocumentSubmissionReceipt };

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
  getIdentity(
    documentId: string,
    identityId: string
  ): Promise<DocumentIdentityLedgerEntry | undefined>;
  recordSubmission(receipt: DocumentSubmissionReceipt): Promise<void>;
  getDelegatedCommandClaim(
    documentId: string,
    requestId: string
  ): Promise<DocumentDelegatedCommandClaim | undefined>;
  claimDelegatedCommand(
    claim: DocumentDelegatedCommandClaim
  ): Promise<DelegatedCommandClaimResult>;
  completeDelegatedCommand(
    claim: DocumentDelegatedCommandClaim,
    receipt: DocumentSubmissionReceipt
  ): Promise<void>;

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

  getCommittedFact(factId: string): Promise<DocumentCommittedFact | undefined>;
  listUnpublishedFacts(limit?: number): Promise<DocumentCommittedFact[]>;
  markFactPublished(factId: string, publishedAt: string): Promise<void>;
}
