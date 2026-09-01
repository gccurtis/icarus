import type { Frame } from "$representation/data/types/views/tab";
import type { ViewStateData } from "$model/client/view-state/definition.svelte";
import { perform } from "$model/client/view-state/methods/shared/perform";

export const resize = (state: ViewStateData, patch: Partial<Frame>): void => {
  const id = state.tabs.activeId;
  const was = state.views.of(id).frame;

  perform(state, { op: "resize", tab: id, was, now: { ...was, ...patch } });
};
