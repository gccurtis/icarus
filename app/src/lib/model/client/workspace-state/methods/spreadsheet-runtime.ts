import type { SpreadsheetRuntime } from "$model/client/spreadsheet-runtimes";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";

export const spreadsheetRuntime = (
  state: WorkspaceStateData,
  resourceId: string
): SpreadsheetRuntime => {
  if (state.sheets === undefined) {
    throw new Error(
      "This workspace state holds no spreadsheet runtime register, so it cannot hand one out. " +
        "See src/lib/runtime/client/start.ts."
    );
  }

  const runtime = state.sheets.of(resourceId);
  if (runtime === undefined) {
    throw new Error(`Spreadsheet runtime '${resourceId}' is not owned by an open workspace tab.`);
  }
  return runtime;
};
