import type { CellRef } from "$representation/data/types/content/formula-value";
import type { LiveSheet } from "$representation/data/types/spreadsheets/live";
import type { SpreadsheetOp } from "$representation/data/types/spreadsheets/op";

export type SyncState =
  | "loading"
  | "saved"
  | "saving"
  | "rebasing"
  | "needs-review"
  | "offline"
  | "error";

export interface SpreadsheetRuntime {
  readonly sheet: LiveSheet | undefined;
  readonly revision: number;
  readonly sync: SyncState;
  readonly pending: number;

  scrollTo: CellRef | undefined;

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

  of(id: string): SpreadsheetRuntime | undefined;
  attach(id: string): SpreadsheetRuntime;
  release(id: string): void;
  releaseAll(): void;
}

export type Thresholds = {
  readonly afterOps: number;
  readonly afterMs: number;
  readonly syncEveryMs: number;
};

export type HistoryEntry = readonly SpreadsheetOp[];
