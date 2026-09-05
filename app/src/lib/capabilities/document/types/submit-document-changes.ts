import type { DocumentOp } from "$representation/data/types/documents/op";

export type DocumentChangeSetInput = {
  readonly resourceId: string;
  readonly baseRevision: number;
  readonly ops: readonly DocumentOp[];
  readonly touched: readonly string[];
};

export type SubmitDocumentChangesInput = {
  readonly changeSet: DocumentChangeSetInput;
};

export type SubmitRefusal = "stale" | "unresolved";

export type SubmitDocumentChangesResult =
  | { readonly accepted: true; readonly revision: number; readonly catchUp?: readonly DocumentOp[] }
  | {
      readonly accepted: false;
      readonly reason: SubmitRefusal;
      readonly revision: number;
      readonly detail: string;
    };
