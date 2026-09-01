import type { DocumentOp } from "$representation/data/types/revisions/document-op";
import type { Runtime } from "$model/client/document-runtimes/definition.svelte";

export type Refusal = {
  readonly revision: number;
  readonly retryable: boolean;
};

export const rebase = (
  runtime: Runtime,
  refused: readonly DocumentOp[],
  refusal: Refusal
): void => {
  runtime.revision = refusal.revision;
  runtime.buffer = [...refused, ...runtime.buffer];

  runtime.sync = refusal.retryable ? "rebasing" : "needs-review";
};
