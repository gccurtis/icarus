import type { DocumentRuntimesState, Runtime } from "$model/client/document-runtimes/definition.svelte";

export const detach = (state: DocumentRuntimesState, id: string): Runtime | undefined => {
  const runtime = state.open.get(id);
  if (!runtime) return undefined;

  state.open.delete(id);
  state.settling.set(id, runtime);

  runtime.clearTimer();
  runtime.unsubscribe?.();
  runtime.unsubscribe = undefined;

  return runtime;
};
