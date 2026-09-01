import type { Screen, Subscreen } from "$representation/data/types/views/screens";
import type { ViewStateData } from "$model/client/view-state/definition.svelte";

export const showing = (state: ViewStateData, screen: Screen, subscreen?: Subscreen): boolean => {
  const record = state.tabs.active;
  return (
    record.screen === screen &&
    (subscreen === undefined || state.views.of(record.id).subscreen === subscreen)
  );
};
