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

  return state.decks.attach(resourceId);
};
