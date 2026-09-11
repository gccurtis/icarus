import type { Runtime, PresentationRuntimesState } from "$model/client/presentation-runtimes/definition.svelte";
import { detach } from "$model/client/presentation-runtimes/methods/shared/detach";

export const releaseAll = (state: PresentationRuntimesState): Runtime[] => {
  const detached: Runtime[] = [];

  for (const id of [...state.open.keys()]) {
    const runtime = detach(state, id);
    if (runtime) detached.push(runtime);
  }

  return detached;
};
