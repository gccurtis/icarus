import type { Subscreen } from "$representation/data/types/views/screens";
import type { ViewStateData } from "$model/client/view-state/definition.svelte";
import { landOn } from "$model/client/view-state/methods/shared/land-on";

export const showSubscreen = (
  state: ViewStateData,
  subscreen: Subscreen,
  focus?: string
): void => {
  landOn(state, state.tabs.active, subscreen, focus);
};
