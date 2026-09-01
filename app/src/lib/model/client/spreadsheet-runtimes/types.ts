import type { SpreadsheetBody } from "$representation/data/types/resources/spreadsheet-body";
import type { SpreadsheetOp } from "$representation/data/types/revisions/spreadsheet-op";

export type SyncState =
  | "loading"
  | "saved"
  | "saving"
  | "rebasing"
  | "needs-review"
  | "offline"
  | "error";

export interface SpreadsheetRuntime {
  readonly body: SpreadsheetBody | undefined;
  readonly revision: number;
  readonly sync: SyncState;
  readonly pending: number;

  apply(ops: readonly SpreadsheetOp[]): void;
  flush(): Promise<void>;

  undo(): void;
  redo(): void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export interface SpreadsheetRuntimesModel {
  readonly open: readonly string[];
  readonly flushing: readonly string[];

  attach(id: string): SpreadsheetRuntime;
  release(id: string): void;
  releaseAll(): void;
}

export type FlushThresholds = {
  readonly afterOps: number;
  readonly afterMs: number;
};

export type HistoryEntry = readonly SpreadsheetOp[];
