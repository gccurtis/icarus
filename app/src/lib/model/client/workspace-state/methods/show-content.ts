import type { ContentView } from "$representation/data/types/workspace/categories";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import { landOn } from "$model/client/workspace-state/methods/shared/land-on";

export const showContent = (
  state: WorkspaceStateData,
  content: ContentView,
  focus?: string
): void => {
  landOn(state, state.tabs.active, content, focus);
};
