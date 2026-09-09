import type {
  Runtime,
  SlideDeckRuntimesState
} from "$model/client/slide-deck-runtimes/definition.svelte";

/** Read an already-acquired runtime without changing its lifetime. */
export const of = (state: SlideDeckRuntimesState, id: string): Runtime | undefined =>
  state.open.get(id);
