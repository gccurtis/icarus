import type { SlideDeckOp } from "$representation/data/types/revisions/slide-deck-op";
import type { Runtime } from "$model/client/slide-deck-runtimes/definition.svelte";

export type Refusal = {
  readonly revision: number;
  readonly retryable: boolean;
};

export const rebase = (
  runtime: Runtime,
  refused: readonly SlideDeckOp[],
  refusal: Refusal
): void => {
  runtime.revision = refusal.revision;
  runtime.buffer = [...refused, ...runtime.buffer];

  runtime.sync = refusal.retryable ? "rebasing" : "needs-review";
};
