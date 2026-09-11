import type {
  Runtime,
  PresentationRuntimesState
} from "$model/client/presentation-runtimes/definition.svelte";

/** Read an already-acquired runtime without changing its lifetime. */
export const of = (state: PresentationRuntimesState, id: string): Runtime | undefined =>
  state.open.get(id);
