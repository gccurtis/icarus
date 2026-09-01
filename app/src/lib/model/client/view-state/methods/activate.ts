import type { TabId } from "$representation/data/types/views/tab";
import type { ViewStateData } from "$model/client/view-state/definition.svelte";
import { perform } from "$model/client/view-state/methods/shared/perform";

export const activate = (state: ViewStateData, id: TabId): void => {
  if (id === state.tabs.activeId) return;
  if (state.tabs.find(id) === undefined) return;

  perform(state, { op: "activate", was: state.tabs.activeId, now: id });
};
