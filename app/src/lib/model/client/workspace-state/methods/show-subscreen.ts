import type { Subscreen } from "$representation/data/types/workspace/screens";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";
import { landOn } from "$model/client/workspace-state/methods/shared/land-on";

export const showSubscreen = (
  state: WorkspaceStateData,
  subscreen: Subscreen,
  focus?: string
): void => {
  landOn(state, state.tabs.active, subscreen, focus);
};
