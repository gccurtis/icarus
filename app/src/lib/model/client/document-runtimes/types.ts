import type { MarkStyle } from "$representation/data/types/content/content-block";
import type { DocumentBody } from "$representation/data/types/documents/body";
import type { DocumentOp } from "$representation/data/types/documents/op";

export type SyncState =
  | "loading"
  | "saved"
  | "saving"
  | "rebasing"
  | "needs-review"
  | "offline"
  | "error";

export type RuntimeFailure = {
  readonly reason: "stale" | "unresolved";
  readonly detail: string;
  readonly ops: readonly DocumentOp[];
};

export type PendingMarks = {
  readonly style?: readonly MarkStyle[];
  readonly color?: string;
  readonly background?: string;
};

export interface DocumentRuntime {
  readonly body: DocumentBody | undefined;
  readonly revision: number;
  readonly sync: SyncState;
  readonly pending: number;
  readonly failure: RuntimeFailure | undefined;

  pendingMarks: PendingMarks | undefined;
  scrollTo: string | undefined;

  apply(ops: readonly DocumentOp[]): void;
  flush(): Promise<void>;
  retryFailedChanges(): void;
  discardFailedChanges(): Promise<void>;

  undo(): void;
  redo(): void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export interface DocumentRuntimesModel {
  readonly open: readonly string[];
  readonly flushing: readonly string[];

  of(id: string): DocumentRuntime | undefined;
  attach(id: string): DocumentRuntime;
  release(id: string): void;
  releaseAll(): void;
}

export type Thresholds = {
  readonly afterOps: number;
  readonly afterMs: number;
  readonly syncEveryMs: number;
};

export type HistoryEntry = readonly DocumentOp[];
