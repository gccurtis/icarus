import type { DocumentRuntime } from "$model/client/document-runtimes";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";

export const documentRuntime = (
  state: WorkspaceStateData,
  resourceId: string
): DocumentRuntime => {
  if (state.documents === undefined) {
    throw new Error(
      "This workspace state holds no document runtime register, so it cannot hand one out. " +
        "See src/lib/runtime/client/start.ts."
    );
  }

  const runtime = state.documents.of(resourceId);
  if (runtime === undefined) {
    throw new Error(`Document runtime '${resourceId}' is not owned by an open workspace tab.`);
  }
  return runtime;
};
