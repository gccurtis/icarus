import type { Runtime, SlideDeckRuntimesState } from "$model/client/slide-deck-runtimes/definition.svelte";
import { detach } from "$model/client/slide-deck-runtimes/methods/shared/detach";

export const releaseAll = (state: SlideDeckRuntimesState): Runtime[] => {
  const detached: Runtime[] = [];

  for (const id of [...state.open.keys()]) {
    const runtime = detach(state, id);
    if (runtime) detached.push(runtime);
  }

  return detached;
};
