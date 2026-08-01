import type {
  DeckHead,
  PromptContentCreationAttempt,
  PromptContentOutputOwnership,
  SlideAttempt,
  SlideBase,
  SlideChangeSet,
  SlideCommittedFact,
  SlideDelegatedCommandClaim,
  SlideLifecycle,
  SlideStageReceipt,
  SlideSubmissionReceipt
} from "../domain/model.js";
import type {
  SlideIdentity,
  SlideIdentityLedgerEntry,
  SlideIdentityReactivation,
  SlideIdentityTransitions
} from "../domain/identities.js";

export interface SlideCreationCommit {
  head: DeckHead;
  base: SlideBase;
  identities: SlideIdentity[];
  receipt: SlideSubmissionReceipt;
  fact: SlideCommittedFact;
}

export interface PromptOwnershipTransition {
  outputId: string;
  deckId: string;
  slideId: string;
  shapeId: string;
  creationAttemptId?: string;
  state: PromptContentOutputOwnership["state"];
  attachedRevision?: number;
  detachedRevision?: number;
  at: string;
}

export interface SlideMutationCommit {
  expectedRevision: number;
  head: DeckHead;
  changeSet: SlideChangeSet;
  receipt: SlideSubmissionReceipt;
  fact: SlideCommittedFact;
  identityTransitions: SlideIdentityTransitions;
  identityReactivation: SlideIdentityReactivation;
  attempts?: SlideAttempt[];
  attemptUpdates?: SlideAttempt[];
  promptOwnershipTransitions?: PromptOwnershipTransition[];
}

export interface PromptCreationFailureCommit {
  attempt: PromptContentCreationAttempt;
  receipt: SlideStageReceipt;
}

export type StageClaimResult = "claimed" | "running" | "completed";

export type DelegatedCommandClaimResult =
  | { type: "claim"; claim: SlideDelegatedCommandClaim }
  | { type: "receipt"; receipt: SlideSubmissionReceipt };

export interface SlideStore {
  listHeads(
    cursor?: string,
    lifecycle?: SlideLifecycle,
    limit?: number
  ): Promise<{ items: DeckHead[]; nextCursor?: string }>;
  getHead(deckId: string): Promise<DeckHead | undefined>;
  getBaseAtOrBefore(deckId: string, revision: number): Promise<SlideBase | undefined>;
  getChangeSets(
    deckId: string,
    fromExclusive: number,
    toInclusive: number
  ): Promise<SlideChangeSet[]>;
  listChangeSets(
    deckId: string,
    cursor?: string,
    limit?: number
  ): Promise<{ items: SlideChangeSet[]; nextCursor?: string }>;
  getChangeSet(deckId: string, changeSetId: string): Promise<SlideChangeSet | undefined>;
  getSubmission(
    deckId: string,
    requestId: string
  ): Promise<SlideSubmissionReceipt | undefined>;
  getIdentity(
    deckId: string,
    identityId: string
  ): Promise<SlideIdentityLedgerEntry | undefined>;
  recordSubmission(receipt: SlideSubmissionReceipt): Promise<void>;
  getDelegatedCommandClaim(
    deckId: string,
    requestId: string
  ): Promise<SlideDelegatedCommandClaim | undefined>;
  claimDelegatedCommand(
    claim: SlideDelegatedCommandClaim
  ): Promise<DelegatedCommandClaimResult>;
  completeDelegatedCommand(
    claim: SlideDelegatedCommandClaim,
    receipt: SlideSubmissionReceipt
  ): Promise<void>;

  commitCreation(commit: SlideCreationCommit): Promise<void>;
  commitMutation(commit: SlideMutationCommit): Promise<boolean>;

  appendBaseIfHead(
    deckId: string,
    expectedHeadRevision: number,
    base: SlideBase
  ): Promise<boolean>;
  pruneHistory(
    deckId: string,
    retainedBaseCount: number,
    retainedChangeSetCount: number,
    retainedTerminalAttemptCount: number
  ): Promise<void>;

  getAttempt(deckId: string, attemptId: string): Promise<SlideAttempt | undefined>;
  getAttemptById(attemptId: string): Promise<SlideAttempt | undefined>;
  getAttemptByRequest(
    deckId: string,
    kind: SlideAttempt["kind"],
    requestId: string
  ): Promise<SlideAttempt | undefined>;
  getPromptCreationAttemptByShape(
    deckId: string,
    shapeId: string
  ): Promise<SlideAttempt | undefined>;
  listRecoverableAttempts(): Promise<SlideAttempt[]>;
  createAttempt(attempt: SlideAttempt): Promise<void>;
  createAttemptWithSubmission(
    attempt: SlideAttempt,
    receipt: SlideSubmissionReceipt
  ): Promise<void>;
  updateAttempt(attempt: SlideAttempt): Promise<void>;

  claimStage(receipt: SlideStageReceipt): Promise<StageClaimResult>;
  completeStage(receipt: SlideStageReceipt): Promise<void>;
  failStage(receipt: SlideStageReceipt): Promise<void>;
  failPromptCreationStage(commit: PromptCreationFailureCommit): Promise<void>;
  recoverInterruptedStages(recoveredAt: string): Promise<number>;

  getPromptOutputOwnership(
    outputId: string
  ): Promise<PromptContentOutputOwnership | undefined>;
  getPromptOutputOwnershipByShape(
    deckId: string,
    shapeId: string
  ): Promise<PromptContentOutputOwnership | undefined>;
  registerPendingPromptOutput(ownership: PromptContentOutputOwnership): Promise<void>;
  updatePromptOutputOwnership(transition: PromptOwnershipTransition): Promise<void>;
  listDetachedPromptOutputs(limit?: number): Promise<PromptContentOutputOwnership[]>;

  getCommittedFact(factId: string): Promise<SlideCommittedFact | undefined>;
  listUnpublishedFacts(limit?: number): Promise<SlideCommittedFact[]>;
  markFactPublished(factId: string, publishedAt: string): Promise<void>;
}
