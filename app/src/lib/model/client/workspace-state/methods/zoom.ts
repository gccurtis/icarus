import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import { perform } from "$model/client/workspace-state/methods/shared/perform";

export const zoom = (state: WorkspaceStateData, now: number): void => {
  const id = state.tabs.activeId;
  const was = state.views.of(id).zoom;
  if (was === now) return;

  perform(state, { op: "zoom", tab: id, was, now });
};
