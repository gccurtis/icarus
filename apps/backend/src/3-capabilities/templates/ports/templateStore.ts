import type {
  TemplateCommandType,
  TemplateCommittedTransaction,
  TemplateRecord
} from "../domain/model.js";

/**
 * `pending` is returned when a prior attempt on this request never completed —
 * for example a crash between the adapter call and the catalog finalisation.
 * The caller resumes it rather than starting over, which is safe because the
 * allocated identity and the adapter idempotency key both derive from the
 * request.
 */
export type TemplateClaimState = "claimed" | "pending" | "completed";

export interface TemplateCommandClaim {
  readonly requestId: string;
  readonly requestDigest: string;
  readonly commandType: TemplateCommandType;
  readonly createdAt: string;
}

export interface TemplateClaimOutcome {
  readonly state: TemplateClaimState;
  readonly requestDigest: string;
  readonly commandType: TemplateCommandType;
  /** The identity frozen by a prior attempt, when one got that far. */
  readonly templateId?: string;
  readonly result?: unknown;
}

export interface TemplateFinalizeCommit {
  readonly templateId: string;
  readonly at: string;
  readonly transaction: TemplateCommittedTransaction;
}

export interface TemplateUpdateCommit {
  /** The replacement, already carrying its new `revision` and `updatedAt`. */
  readonly record: TemplateRecord;
  /** Compare-and-swap target: the revision the caller believes is current. */
  readonly expectedRevision: number;
  readonly at: string;
  readonly transaction: TemplateCommittedTransaction;
}

/**
 * Durable project-local storage owned by Templates. Synchronous because SQLite
 * is synchronous and Templates has no non-SQLite future to keep open.
 *
 * All operations are already scoped to one project: the implementation derives
 * its table names from the projectId and exposes no projectId argument here.
 */
export interface TemplateStore {
  get(id: string): TemplateRecord | undefined;
  /** Ready, live records only, ordered by (createdAt, id). */
  list(kind?: string): TemplateRecord[];

  claimCommand(claim: TemplateCommandClaim): TemplateClaimOutcome;
  /** Freezes the allocated identity on the claim before any adapter call. */
  bindClaimTemplateId(requestId: string, templateId: string, at: string): void;
  completeClaim(requestId: string, result: unknown, at: string): void;

  /** False when the id, the (kind, resourceId) pair, or the (kind, name) pair is taken. */
  reserve(record: TemplateRecord): boolean;
  /** True when a live record of this kind already carries this name. */
  nameTaken(kind: string, name: string, exceptId?: string): boolean;
  /** Marks a reservation ready and writes its Activity transaction atomically. */
  markReady(commit: TemplateFinalizeCommit): void;
  /**
   * Compare-and-swap replacement. Archives the record being replaced into
   * history at its current revision, writes the replacement, and appends the
   * Activity transaction — all in one SQLite transaction. False when the row is
   * missing or its revision is not `expectedRevision`; nothing is written.
   *
   * The archive is not optional bookkeeping: every other revision transition in
   * this capability leaves a history record, and an update that skipped it
   * would make `latestSnapshot` return pre-update state as though it were
   * current.
   */
  update(commit: TemplateUpdateCommit): boolean;
  /** Archives and removes current state while writing Activity atomically. */
  delete(commit: TemplateFinalizeCommit): void;
  /** Releases a reservation whose adapter call failed. */
  deleteReservation(id: string): void;

  latestSnapshot(id: string): TemplateRecord | undefined;
  purge(id: string): void;
  pruneHistory(cutoff: string): number;
  expiredDeleted(cutoff: string): string[];

  listUnpublishedTransactions(limit?: number): TemplateCommittedTransaction[];
  markTransactionPublished(sourceTransactionId: string, publishedAt: string): void;
}
