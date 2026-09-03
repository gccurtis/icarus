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

export interface DocumentRuntime {
  readonly body: DocumentBody | undefined;
  readonly revision: number;
  readonly sync: SyncState;
  readonly pending: number;

  apply(ops: readonly DocumentOp[]): void;
  flush(): Promise<void>;

  undo(): void;
  redo(): void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export interface DocumentRuntimesModel {
  readonly open: readonly string[];
  readonly flushing: readonly string[];

  attach(id: string): DocumentRuntime;
  release(id: string): void;
  releaseAll(): void;
}

export type Thresholds = {
  readonly afterOps: number;
  readonly afterMs: number;
  /** How often a settled runtime re-reads the leader. Zero switches it off. */
  readonly syncEveryMs: number;
};

export type HistoryEntry = readonly DocumentOp[];
