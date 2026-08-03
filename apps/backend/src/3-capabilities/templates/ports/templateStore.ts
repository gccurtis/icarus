import type {
  TemplateCommandType,
  TemplateCommittedTransaction,
  TemplateListFilter,
  TemplateRecord
} from "../domain/model.js";

export interface TemplateListPage {
  readonly items: TemplateRecord[];
  /** Absent on the last page. */
  readonly nextCursor?: string;
}

/**
 * What a completed command returned. An exact retry replays it; a request ID
 * reused with different content is a mismatch.
 *
 * Nothing is written here ahead of the work. That is the whole difference from
 * the claim this replaced: a claim had to exist *before* the external call so
 * it could carry a frozen identity across it, which meant a pending state, a
 * promote step, and a release step. A receipt records what happened, so it only
 * ever exists after it has.
 */
export interface TemplateCommandReceipt {
  readonly requestId: string;
  readonly requestDigest: string;
  readonly commandType: TemplateCommandType;
  readonly result: unknown;
  readonly createdAt: string;
}

export interface TemplateCreateCommit {
  readonly record: TemplateRecord;
  readonly receipt: TemplateCommandReceipt;
  readonly transaction: TemplateCommittedTransaction;
}

export interface TemplateFinalizeCommit {
  readonly templateId: string;
  readonly at: string;
  readonly receipt: TemplateCommandReceipt;
  readonly transaction: TemplateCommittedTransaction;
}

export interface TemplateUpdateCommit {
  /** The replacement, already carrying its new `revision` and `updatedAt`. */
  readonly record: TemplateRecord;
  /** Compare-and-swap target: the revision the caller believes is current. */
  readonly expectedRevision: number;
  readonly at: string;
  readonly receipt: TemplateCommandReceipt;
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
  /** Live records, ordered by (createdAt, id), filtered and paginated. */
  list(filter?: TemplateListFilter): TemplateListPage;

  getReceipt(requestId: string): TemplateCommandReceipt | undefined;
  /**
   * First write wins. Commands that commit their own receipt inside a
   * transaction call this again through the generic path, and the duplicate is
   * ignored rather than raising.
   */
  recordReceipt(receipt: TemplateCommandReceipt): void;

  /**
   * Writes the catalog row, its receipt, and its Activity transaction in one
   * SQLite transaction. False when the id or the (kind, resourceId) pair is
   * taken; nothing is written.
   *
   * The three are inseparable. A row committed without its receipt would make a
   * retry re-run the whole command and then collide with the name it wrote
   * itself a moment earlier — a conflict reported against the caller for the
   * store's own half-finished write.
   */
  create(commit: TemplateCreateCommit): boolean;
  /** True when a live record of this kind already carries this name. */
  nameTaken(kind: string, name: string, exceptId?: string): boolean;
  /**
   * Compare-and-swap replacement. Archives the record being replaced into
   * history at its current revision, writes the replacement, and appends the
   * receipt and the Activity transaction — all in one SQLite transaction. False
   * when the row is missing or its revision is not `expectedRevision`; nothing
   * is written.
   *
   * The archive is not optional bookkeeping: every other revision transition in
   * this capability leaves a history record, and an update that skipped it
   * would make `latestSnapshot` return pre-update state as though it were
   * current.
   */
  update(commit: TemplateUpdateCommit): boolean;
  /** Archives and removes current state, with the receipt and Activity, atomically. */
  delete(commit: TemplateFinalizeCommit): void;

  latestSnapshot(id: string): TemplateRecord | undefined;
  purge(id: string): void;
  pruneHistory(cutoff: string): number;
  expiredDeleted(cutoff: string): string[];

  listUnpublishedTransactions(limit?: number): TemplateCommittedTransaction[];
  markTransactionPublished(sourceTransactionId: string, publishedAt: string): void;
}
