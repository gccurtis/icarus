import type { Runtime, SpreadsheetRuntimesState } from "$model/client/spreadsheet-runtimes/definition.svelte";
import { detach } from "$model/client/spreadsheet-runtimes/methods/shared/detach";

/**
 * Close every open sheet. What the client instance runs on its way out.
 *
 * The ids are copied before iterating, because `detach` deletes from the map
 * being walked.
 *
 * Everything detaches first and submits afterwards, rather than each one
 * submitting before the next detaches. Teardown has a browser's unload budget to
 * work in, and serialising submits inside it is how the last one does not
 * happen.
 */
export const releaseAll = (state: SpreadsheetRuntimesState): Runtime[] => {
  const detached: Runtime[] = [];

  for (const id of [...state.open.keys()]) {
    const runtime = detach(state, id);
    if (runtime) detached.push(runtime);
  }

  return detached;
};
