import type { ContextView } from "$representation/data/types/workspace/views";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import { perform } from "$model/client/workspace-state/methods/shared/perform";
import { offersContext } from "$model/client/workspace-state/methods/shared/rails";

export const selectContext = (state: WorkspaceStateData, id: ContextView): void => {
  const record = state.tabs.active;
  const view = state.views.of(record.id);

  if (!offersContext(record.category, id)) {
    throw new Error(`'${record.category}' does not offer '${id}'`);
  }

  perform(state, { op: "context", tab: record.id, was: view.contextId, now: id });
};
