// Durable project-local storage owned by Structured Analytic.
//
// Synchronous, because SQLite is synchronous and an analytic definition is a
// small local record with no non-SQLite future to keep open — the same argument
// Templates makes. (Persona, Comments, Slides, and Document went the other way,
// keeping their ports Promise-returning so a networked store could drop in.
// Those hold data that plausibly outgrows an embedded database; a few kilobytes
// of pills does not.) Reversing this later is mechanical in either direction.
//
// Every operation is already scoped to one project: the implementation derives
// its table names from the projectId and exposes no projectId argument here.

import type { AnalyticDefinition, StructuredAnalytic } from "../domain/model.js";

export interface StructuredAnalyticStore {
  /** Current state only. Undefined for a missing or deleted analytic. */
  get(id: string): StructuredAnalytic | undefined;

  /**
   * Every live analytic, ordered by (updated_at DESC, id ASC).
   *
   * Unpaginated, unlike Templates and Comments. A project holds tens of
   * analytics, not thousands — and with no catalog cap that is a expectation
   * rather than a guarantee, so a keyset cursor may be needed one day. The
   * schema's mixed-direction index is already in exactly that cursor's tuple
   * order, so adding one is new code, not a migration.
   */
  list(): StructuredAnalytic[];

  /**
   * Writes revision 1. No history row: the current row *is* revision 1, and
   * archiving it would put two records at the same revision.
   *
   * Throws on a duplicate id rather than returning a result. The service
   * allocates identifiers, so a collision is a fault, not a caller outcome.
   */
  insert(analytic: StructuredAnalytic): void;

  /**
   * Compare-and-swap replacement. Archives the record being replaced at the
   * revision it held, then writes the replacement — one transaction.
   *
   * False when the row is missing *or* its revision is not `expectedRevision`;
   * nothing is written either way. The boolean does not distinguish them, so a
   * caller that needs to raise `AnalyticNotFoundError` rather than
   * `StaleAnalyticRevisionError` re-reads with `get`.
   */
  update(analytic: StructuredAnalytic, expectedRevision: number): boolean;

  /**
   * Archives the final snapshot at N, appends a tombstone at N+1, and removes
   * current state — one transaction. False when missing or stale.
   *
   * `deletedAt` is the `recordedAt` of both history rows, so the pair shares a
   * timestamp and retention treats them as one event.
   */
  delete(id: string, expectedRevision: number, deletedAt: string): boolean;

  /**
   * Rename self-healing: an input's recorded `entryId` still resolves, but
   * under a different name, so the stored name is corrected to match.
   *
   * One revision-conditioned UPDATE of the definition that deliberately does
   * **not** advance `revision`, write history, or touch `updated_at`. Healing a
   * name is not an authored edit: bumping the revision would invalidate every
   * open editor's `expectedRevision` because somebody else merely *viewed* a
   * chart, and touching `updated_at` would reorder `list()` as a side effect of
   * a read.
   *
   * False when the CAS misses. That is an ordinary outcome, not an error — a
   * concurrent authored edit wins, and the repair reapplies on the next read.
   */
  repairInputNames(
    id: string,
    expectedRevision: number,
    definition: AnalyticDefinition
  ): boolean;

  /**
   * The most recent archived snapshot, which after a delete is the final state.
   * Undefined for a live analytic that has never been updated.
   */
  latestSnapshot(id: string): StructuredAnalytic | undefined;

  /**
   * Permanently drops one analytic's history. Legal only after deletion.
   *
   * Throws `ResourceNotDeletedError` while current state exists and
   * `ResourceHistoryNotFoundError` when there is nothing purgeable. Both are the
   * shared classes, which every mapper fronting a history-owning store already
   * turns into 409 `not_deleted` and 404 `not_found` — ten of them today. This
   * capability's own mapper still has to be written; using the shared classes
   * is what will make that mapper a copy rather than a design.
   */
  purge(id: string): void;

  /**
   * Drops history rows older than `cutoff` — for live and deleted analytics
   * alike. History is a bounded window, not an archive.
   *
   * Exactly one thing is protected: a deleted analytic's terminal tombstone,
   * so it stays discoverable as deleted and therefore stays purgeable. And one
   * thing is swept *extra*: the stale tombstone of an id that is live again.
   *
   * ("Keeping every live resource" is what an earlier version of this comment
   * said. It is the inverse of what happens, and of what the liveness callback
   * is for.)
   */
  pruneHistory(cutoff: string): number;

  /** Ids whose tombstone predates `cutoff`, for the retention sweep to purge. */
  expiredDeleted(cutoff: string): string[];
}
