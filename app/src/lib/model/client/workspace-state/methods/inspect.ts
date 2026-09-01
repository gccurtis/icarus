import type { Inspected, Selection } from "$representation/data/types/workspace/tab";
import { isInspectionKey } from "$representation/data/behavior/workspace/panels";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import { perform } from "$model/client/workspace-state/methods/shared/perform";

export const inspect = (state: WorkspaceStateData, key: Inspected, selection?: Selection): void => {
  if (key !== "empty" && !isInspectionKey(key)) {
    throw new Error(`'${key}' is not a lens`);
  }

  const id = state.tabs.activeId;
  const view = state.views.of(id);

  perform(state, {
    op: "inspect",
    tab: id,
    was: view.inspected,
    now: key,
    wasSelection: view.selection,
    selection: selection ?? view.selection
  });
};
