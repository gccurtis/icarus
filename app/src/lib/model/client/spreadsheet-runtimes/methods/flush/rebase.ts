import type { SpreadsheetOp } from "$representation/data/types/revisions/spreadsheet-op";
import type { Runtime } from "$model/client/spreadsheet-runtimes/definition.svelte";

export type Refusal = {
  readonly revision: number;
  readonly retryable: boolean;
};

export const rebase = (
  runtime: Runtime,
  refused: readonly SpreadsheetOp[],
  refusal: Refusal
): void => {
  runtime.revision = refusal.revision;
  runtime.buffer = [...refused, ...runtime.buffer];

  runtime.sync = refusal.retryable ? "rebasing" : "needs-review";
};
