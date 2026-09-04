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
  readonly stage: StageSettings;

  apply(ops: readonly SlideDeckOp[]): void;
  flush(): Promise<void>;
  /** Send what it holds, or read what it does not. */
  tick(): Promise<void>;

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

/**
 * What turns a ratio into something drawn. Read from configuration at
 * construction and carried here because a view may not reach configuration
 * itself, and the runtime is the deck's model object.
 */
export type StageSettings = {
  readonly unitsHigh: number;
  readonly widthRem: number;
  readonly averageGlyphWidthEm: number;
  readonly minimumZoom: number;
  readonly maximumZoom: number;
  readonly zoomStep: number;
  readonly minimumGutterRem: number;
  readonly maximumGutterRem: number;
};

export type FlushThresholds = {
  readonly afterOps: number;
  readonly afterMs: number;
  /** How often a runtime wakes to send what it holds, or read what it does not. */
  readonly syncEveryMs: number;
};

export type HistoryEntry = readonly SlideDeckOp[];
