import type { Runtime, PresentationRuntimesState } from "$model/client/presentation-runtimes/definition.svelte";

export const detach = (state: PresentationRuntimesState, id: string): Runtime | undefined => {
  const runtime = state.open.get(id);
  if (!runtime) return undefined;

  state.open.delete(id);
  state.settling.set(id, runtime);

  runtime.clearTimer();
  runtime.unsubscribe?.();
  runtime.unsubscribe = undefined;

  return runtime;
};
