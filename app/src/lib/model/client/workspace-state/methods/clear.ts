import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import { perform } from "$model/client/workspace-state/methods/shared/perform";

export const clear = (state: WorkspaceStateData): void => {
  const id = state.tabs.activeId;
  const view = state.views.of(id);

  perform(state, {
    op: "inspect",
    tab: id,
    was: view.inspected,
    now: "empty",
    wasSelection: view.selection,
    selection: null
  });
};
