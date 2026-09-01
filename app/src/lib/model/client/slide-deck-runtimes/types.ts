import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";
import type { SlideDeckOp } from "$representation/data/types/slide-decks/op";

export type SyncState =
  | "loading"
  | "saved"
  | "saving"
  | "rebasing"
  | "needs-review"
  | "offline"
  | "error";

export interface SlideDeckRuntime {
  readonly body: SlideDeckBody | undefined;
  readonly revision: number;
  readonly sync: SyncState;
  readonly pending: number;

  apply(ops: readonly SlideDeckOp[]): void;
  flush(): Promise<void>;

  undo(): void;
  redo(): void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export interface SlideDeckRuntimesModel {
  readonly open: readonly string[];
  readonly flushing: readonly string[];

  attach(id: string): SlideDeckRuntime;
  release(id: string): void;
  releaseAll(): void;
}

export type FlushThresholds = {
  readonly afterOps: number;
  readonly afterMs: number;
};

export type HistoryEntry = readonly SlideDeckOp[];
