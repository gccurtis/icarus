import type { SlideDeckOp } from "$representation/data/types/revisions/slide-deck-op";
import type { Runtime } from "$model/client/slide-deck-runtimes/definition.svelte";

/**
 * What a refusal returns: the revision the server is now at, and whether the
 * refusal is one a resubmit could survive.
 */
export type Refusal = {
  readonly revision: number;
  readonly retryable: boolean;
};

/**
 * A refused change set, put back on the front of the buffer at the new revision.
 *
 * **This is small, and it being small is the design working.** Because nothing
 * here resolves a path, there is no operational transform to write: the ops are
 * correct as authored, they were simply stated against a revision that has since
 * moved. Rebasing is therefore re-stating them, not rewriting them.
 *
 * The refused ops go to the **front** of the buffer, ahead of anything typed
 * while the submit was in flight. They happened first.
 *
 * A refusal the ladder cannot resolve — the base revision has fallen out of the
 * rebase window, or two edits genuinely conflict — is not retryable. The buffer
 * is kept and `needs-review` says so, because a person has to decide.
 */
export const rebase = (
  runtime: Runtime,
  refused: readonly SlideDeckOp[],
  refusal: Refusal
): void => {
  runtime.revision = refusal.revision;
  runtime.buffer = [...refused, ...runtime.buffer];

  runtime.sync = refusal.retryable ? "rebasing" : "needs-review";
};
