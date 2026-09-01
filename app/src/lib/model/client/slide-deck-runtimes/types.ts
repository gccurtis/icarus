import type { SlideDeckBody } from "$representation/data/types/resources/slide-deck-body";
import type { SlideDeckOp } from "$representation/data/types/revisions/slide-deck-op";

/**
 * What the status strip reports. Not something an editor reads.
 *
 * `loading` is the only state in which `body` is undefined, and it is entered
 * once — a runtime that has read successfully never returns to it, because a
 * later failure still leaves the last accepted body renderable.
 *
 * `needs-review` and `error` are different refusals. `needs-review` is a
 * conflict a person has to resolve; `error` is a submit that failed for a reason
 * retrying will not fix. Both keep the buffer, because dropping unsent edits
 * silently is the one outcome with no recovery.
 */
export type SyncState =
  | "loading"
  | "saved"
  | "saving"
  | "rebasing"
  | "needs-review"
  | "offline"
  | "error";

/**
 * One open deck: what to render, and how to change it.
 *
 * **`body` is a property, not a method.** There is nothing to call and nothing
 * to await — it is `$state`, so when the server accepts a change, from this tab
 * or another person's, it changes and whatever read it re-renders.
 *
 * **`apply` is the only writer.** The editor translates its own library's
 * transaction into `SlideDeckOp[]` and hands them over. Buffering, coalescing,
 * submitting and refusal are this object's, and none of them is the editor's
 * problem.
 *
 * `sync` is neither: it is a status for the strip at the bottom of the frame,
 * kept separate from `body` so a save completing does not re-render a deck.
 */
export interface SlideDeckRuntime {
  readonly body: SlideDeckBody | undefined;
  readonly revision: number;

  readonly sync: SyncState;
  /** How many ops are buffered. The ops themselves stay inside. */
  readonly pending: number;

  apply(ops: readonly SlideDeckOp[]): void;
  flush(): Promise<void>;

  undo(): void;
  redo(): void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

/**
 * The register: one runtime per open deck, keyed by **deck** and never by tab.
 * Two tabs split across one deck must write into one buffer, or each holds half
 * the edits and whichever flushes second submits against a stale revision.
 *
 * Both fields are read-only projections. The maps behind them are private,
 * because a caller that could reach into one could hold a runtime past its
 * release.
 *
 * **The workbench owns lifetime.** It calls `attach` when a deck tab opens and
 * `release` when the last tab on that deck closes.
 */
export interface SlideDeckRuntimesModel {
  /** Every deck with a live runtime. */
  readonly open: readonly string[];
  /** Those whose last submit has not settled — what the status bar reports. */
  readonly flushing: readonly string[];

  attach(id: string): SlideDeckRuntime;
  release(id: string): void;
  releaseAll(): void;
}

/** How long a runtime waits before submitting. Read from configuration at construction. */
export type FlushThresholds = {
  readonly afterOps: number;
  readonly afterMs: number;
};

/** One gesture's worth of ops, as the history stacks hold it. */
export type HistoryEntry = readonly SlideDeckOp[];
