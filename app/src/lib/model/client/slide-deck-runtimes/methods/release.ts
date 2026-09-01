import type { Runtime, SlideDeckRuntimesState } from "$model/client/slide-deck-runtimes/definition.svelte";
import { detach } from "$model/client/slide-deck-runtimes/methods/shared/detach";

export const release = (state: SlideDeckRuntimesState, id: string): Runtime | undefined =>
  detach(state, id);
