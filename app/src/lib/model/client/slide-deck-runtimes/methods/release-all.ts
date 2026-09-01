import type { Runtime, SlideDeckRuntimesState } from "$model/client/slide-deck-runtimes/definition.svelte";
import { detach } from "$model/client/slide-deck-runtimes/methods/shared/detach";

/**
 * Close every open deck. What the client instance runs on its way out.
 *
 * The ids are copied before iterating, because `detach` deletes from the map
 * being walked.
 *
 * Everything detaches first and submits afterwards, rather than each one
 * submitting before the next detaches. Teardown has a browser's unload budget to
 * work in, and serialising submits inside it is how the last one does not
 * happen.
 */
export const releaseAll = (state: SlideDeckRuntimesState): Runtime[] => {
  const detached: Runtime[] = [];

  for (const id of [...state.open.keys()]) {
    const runtime = detach(state, id);
    if (runtime) detached.push(runtime);
  }

  return detached;
};
