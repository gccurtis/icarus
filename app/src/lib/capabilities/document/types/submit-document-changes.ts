import type { DocumentOp } from "$representation/data/types/documents/op";

/**
 * A change set, as the client can state one: the coalesced ops, the revision they
 * were authored against, and the paths they reached. Everything else on a
 * `documentChangeSets` row is the server's — the revision it becomes, who asked,
 * when, and which tier it lands in.
 */
export type DocumentChangeSetInput = {
  readonly resourceId: string;
  readonly baseRevision: number;
  readonly ops: readonly DocumentOp[];
  readonly touched: readonly string[];
};

export type SubmitDocumentChangesInput = {
  readonly changeSet: DocumentChangeSetInput;
};

/**
 * `stale` — authored against a revision the leader has moved past.
 * `unresolved` — an op named something the body at that revision does not hold.
 */
export type SubmitRefusal = "stale" | "unresolved";

export type SubmitDocumentChangesResult =
  | { readonly accepted: true; readonly revision: number }
  | {
      readonly accepted: false;
      readonly reason: SubmitRefusal;
      readonly revision: number;
      readonly detail: string;
    };
