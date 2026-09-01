import type { TabId } from "$representation/data/types/workspace/tab";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import { perform } from "$model/client/workspace-state/methods/shared/perform";

export const activate = (state: WorkspaceStateData, id: TabId): void => {
  if (id === state.tabs.activeId) return;
  if (state.tabs.find(id) === undefined) return;

  perform(state, { op: "activate", was: state.tabs.activeId, now: id });
};
