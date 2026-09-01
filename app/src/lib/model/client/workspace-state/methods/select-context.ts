import type { ContextId } from "$representation/data/types/workspace/panels";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import { perform } from "$model/client/workspace-state/methods/shared/perform";
import { offersContext } from "$model/client/workspace-state/methods/shared/rails";

export const selectContext = (state: WorkspaceStateData, id: ContextId): void => {
  const record = state.tabs.active;
  const view = state.views.of(record.id);

  if (!offersContext(record.category, view.subscreen, id)) {
    throw new Error(`'${record.category}/${view.subscreen}' does not offer '${id}'`);
  }

  perform(state, { op: "context", tab: record.id, was: view.contextId, now: id });
};
