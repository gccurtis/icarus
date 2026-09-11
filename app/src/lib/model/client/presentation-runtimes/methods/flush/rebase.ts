import type { PresentationOp } from "$representation/data/types/presentations/op";
import type { Runtime } from "$model/client/presentation-runtimes/definition.svelte";

export type Refusal = {
  readonly revision: number;
  readonly retryable: boolean;
};

export const rebase = (
  runtime: Runtime,
  refused: readonly PresentationOp[],
  refusal: Refusal
): void => {
  runtime.revision = refusal.revision;
  runtime.buffer = [...refused, ...runtime.buffer];

  runtime.sync = refusal.retryable ? "rebasing" : "needs-review";
};
