import type { Frame } from "$representation/data/types/workspace/tab";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import { perform } from "$model/client/workspace-state/methods/shared/perform";

export const resize = (state: WorkspaceStateData, patch: Partial<Frame>): void => {
  const id = state.tabs.activeId;
  const was = state.views.of(id).frame;

  perform(state, { op: "resize", tab: id, was, now: { ...was, ...patch } });
};
