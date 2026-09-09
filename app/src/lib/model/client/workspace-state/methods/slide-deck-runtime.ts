import type { SlideDeckRuntime } from "$model/client/slide-deck-runtimes";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";

export const slideDeckRuntime = (
  state: WorkspaceStateData,
  resourceId: string
): SlideDeckRuntime => {
  if (state.decks === undefined) {
    throw new Error(
      "This workspace state holds no slide deck runtime register, so it cannot hand one out. " +
        "See src/lib/runtime/client/start.ts."
    );
  }

  const runtime = state.decks.of(resourceId);
  if (runtime === undefined) {
    throw new Error(`Slide-deck runtime '${resourceId}' is not owned by an open workspace tab.`);
  }
  return runtime;
};
