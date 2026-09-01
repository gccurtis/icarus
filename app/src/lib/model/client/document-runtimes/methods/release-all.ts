import type { DocumentRuntimesState, Runtime } from "$model/client/document-runtimes/definition.svelte";
import { detach } from "$model/client/document-runtimes/methods/shared/detach";

export const releaseAll = (state: DocumentRuntimesState): Runtime[] => {
  const detached: Runtime[] = [];

  for (const id of [...state.open.keys()]) {
    const runtime = detach(state, id);
    if (runtime) detached.push(runtime);
  }

  return detached;
};
