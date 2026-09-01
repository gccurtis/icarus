import type { Runtime, SlideDeckRuntimesState } from "$model/client/slide-deck-runtimes/definition.svelte";

export const attach = (state: SlideDeckRuntimesState, id: string): Runtime => {
  const open = state.open.get(id);
  if (open) return open;

  const settling = state.settling.get(id);
  if (settling) {
    state.settling.delete(id);
    state.open.set(id, settling);
    subscribe(settling);
    return settling;
  }

  const runtime = state.createRuntime(id);
  state.open.set(id, runtime);
  subscribe(runtime);

  return runtime;
};

const subscribe = (runtime: Runtime): void => {
  // Not built: nothing serves a deck body yet.
  void runtime;
};
