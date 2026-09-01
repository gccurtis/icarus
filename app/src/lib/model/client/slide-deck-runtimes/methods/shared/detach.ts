import type { Runtime, SlideDeckRuntimesState } from "$model/client/slide-deck-runtimes/definition.svelte";

export const detach = (state: SlideDeckRuntimesState, id: string): Runtime | undefined => {
  const runtime = state.open.get(id);
  if (!runtime) return undefined;

  state.open.delete(id);
  state.settling.set(id, runtime);

  runtime.clearTimer();
  runtime.unsubscribe?.();
  runtime.unsubscribe = undefined;

  return runtime;
};
