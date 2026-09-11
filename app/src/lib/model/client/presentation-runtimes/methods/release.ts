import type { Runtime, PresentationRuntimesState } from "$model/client/presentation-runtimes/definition.svelte";
import { detach } from "$model/client/presentation-runtimes/methods/shared/detach";

export const release = (state: PresentationRuntimesState, id: string): Runtime | undefined =>
  detach(state, id);
