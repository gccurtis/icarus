import type { ResourceRuntimesState, Runtime } from "$model/client/resource-runtimes/definition.svelte";
import { detach } from "$model/client/resource-runtimes/methods/shared/detach";

/**
 * Close every open resource. What the client instance runs on its way out.
 *
 * The keys are copied before iterating, because `detach` deletes from the map
 * being walked.
 *
 * Everything detaches first and submits afterwards, rather than each one
 * submitting before the next detaches. Teardown has a browser's unload budget to
 * work in, and serialising three submits inside it is how the third one does not
 * happen.
 */
export const releaseAll = (state: ResourceRuntimesState): Runtime[] => {
  const detached: Runtime[] = [];

  for (const key of [...state.open.keys()]) {
    const runtime = detach(state, key);
    if (runtime) detached.push(runtime);
  }

  return detached;
};
