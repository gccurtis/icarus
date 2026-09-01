import type { Runtime, SpreadsheetRuntimesState } from "$model/client/spreadsheet-runtimes/definition.svelte";
import { detach } from "$model/client/spreadsheet-runtimes/methods/shared/detach";

export const releaseAll = (state: SpreadsheetRuntimesState): Runtime[] => {
  const detached: Runtime[] = [];

  for (const id of [...state.open.keys()]) {
    const runtime = detach(state, id);
    if (runtime) detached.push(runtime);
  }

  return detached;
};
