import type { Screen, Subscreen } from "$representation/data/types/workspace/screens";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";

export const showing = (state: WorkspaceStateData, screen: Screen, subscreen?: Subscreen): boolean => {
  const record = state.tabs.active;
  return (
    record.screen === screen &&
    (subscreen === undefined || state.views.of(record.id).subscreen === subscreen)
  );
};
