import type {
  TemplateCommandType,
  TemplateCommittedFact,
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
  readonly fact: TemplateCommittedFact;
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
  countLive(): number;

  claimCommand(claim: TemplateCommandClaim): TemplateClaimOutcome;
  /** Freezes the allocated identity on the claim before any adapter call. */
  bindClaimTemplateId(requestId: string, templateId: string, at: string): void;
  completeClaim(requestId: string, result: unknown, at: string): void;

  /** False when the id or (kind, resourceId) pair is already taken. */
  reserve(record: TemplateRecord): boolean;
  /** Marks a reservation ready and writes its activity fact in one transaction. */
  markReady(commit: TemplateFinalizeCommit): void;
  /** Soft-deletes a record and writes its activity fact in one transaction. */
  softDelete(commit: TemplateFinalizeCommit): void;
  /** Releases a reservation whose adapter call failed. */
  deleteReservation(id: string): void;

  listUnpublishedFacts(limit?: number): TemplateCommittedFact[];
  markFactPublished(factId: string, publishedAt: string): void;
}
