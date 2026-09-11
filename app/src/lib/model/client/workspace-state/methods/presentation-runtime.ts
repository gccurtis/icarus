import type { PresentationRuntime } from "$model/client/presentation-runtimes";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";

export const presentationRuntime = (
  state: WorkspaceStateData,
  resourceId: string
): PresentationRuntime => {
  if (state.presentations === undefined) {
    throw new Error(
      "This workspace state holds no presentation runtime register, so it cannot hand one out. " +
        "See src/lib/runtime/client/start.ts."
    );
  }

  const runtime = state.presentations.of(resourceId);
  if (runtime === undefined) {
    throw new Error(`Slide-presentation runtime '${resourceId}' is not owned by an open workspace tab.`);
  }
  return runtime;
};
