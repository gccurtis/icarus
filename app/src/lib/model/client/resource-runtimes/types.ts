import type { Op } from "$revisions/types/op";
import type { GeneralResourceType } from "$revisions/types/resource";

/**
 * A runtime's identity in the register.
 *
 * Keyed by **resource**, never by tab. Two tabs split across one document must
 * write into one buffer, or each holds half the edits and whichever flushes
 * second submits against a stale revision.
 *
 * Internal to this object. `attach` and `release` take a type and an id, so no
 * consumer ever builds one — a caller holding a key could hold it past the
 * runtime's release.
 */
export type RuntimeKey = `${GeneralResourceType}:${string}`;

/**
 * **Forward declarations.** The three body types belong to `documents`,
 * `slideDecks` and `spreadsheets`, none of which exists yet.
 *
 * `unknown` rather than `any` on purpose: nothing in this object reads a body —
 * it is received from a subscription, held, and handed to whoever renders it —
 * so `unknown` is the honest description of what the register knows, and it
 * makes the editors that will consume it narrow explicitly.
 *
 * When those capabilities land, these three aliases point at the real bodies and
 * nothing else in this object changes.
 */
export type DocumentBody = unknown;
export type SlideDeckBody = unknown;
export type SpreadsheetBody = unknown;

/** Which body a resource type carries. */
export type BodyFor<T extends GeneralResourceType> = T extends "document"
  ? DocumentBody
  : T extends "slides"
    ? SlideDeckBody
    : SpreadsheetBody;

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
 * One open resource: what to render, and how to change it.
 *
 * Two members carry the whole design.
 *
 * **`body` is a property, not a method.** There is nothing to call and nothing
 * to await — it is `$state`, so when the server accepts a change, from this tab
 * or another person's, it changes and whatever read it re-renders.
 *
 * **`apply` is the only writer.** The editor translates its own library's
 * transaction into `Op[]` and hands them over. Buffering, coalescing, submitting
 * and refusal are this object's, and none of them is the editor's problem.
 *
 * `sync` is neither: it is a status for the strip at the bottom of the frame,
 * kept separate from `body` so a save completing does not re-render a document.
 */
export interface ResourceRuntime<Body> {
  readonly body: Body | undefined;
  readonly revision: number;

  readonly sync: SyncState;
  /** Ops buffered and not yet submitted. */
  readonly pending: number;

  apply(ops: readonly Op[]): void;
  flush(): Promise<void>;

  undo(): void;
  redo(): void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

/**
 * The register: one runtime per open resource.
 *
 * Both fields are read-only projections. The map behind them is private, because
 * a caller that could reach into it could hold a runtime past its release.
 *
 * **The workbench owns lifetime.** It calls `attach` when a resource tab opens
 * and `release` when the last tab on that resource closes, because it is the
 * thing that knows when a tab begins and ends. A view reaches a runtime through
 * `workbench.runtimeFor(tab.id)` and never touches this object — a view calling
 * `attach` itself would tie a runtime's life to a component's mount, and the
 * work surface remounts on every tab switch.
 */
export interface ResourceRuntimesModel {
  /** Every resource with a live runtime. */
  readonly open: readonly RuntimeKey[];
  /** Those whose last submit has not settled — what the status bar reports. */
  readonly flushing: readonly RuntimeKey[];

  attach<T extends GeneralResourceType>(type: T, id: string): ResourceRuntime<BodyFor<T>>;
  release(type: GeneralResourceType, id: string): void;
  releaseAll(): void;
}

/** How long a runtime waits before submitting. Read from configuration at construction. */
export type FlushThresholds = {
  readonly afterOps: number;
  readonly afterMs: number;
};

/** One gesture's worth of ops, as the history stacks hold it. */
export type HistoryEntry = readonly Op[];
