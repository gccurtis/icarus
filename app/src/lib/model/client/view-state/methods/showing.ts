import type { ViewStateData } from "$model/client/view-state/definition.svelte";
import type { Screen, Subscreen } from "$model/client/view-state/methods/shared/keys";

/**
 * Whether the active tab is on a given centre right now.
 *
 * The question a surface asks when it renders differently depending on where it
 * is — a rail entry marking itself current, a command deciding whether it
 * applies. Omitting the subscreen asks only about the screen, because most
 * callers do not care which of a screen's two centres is showing.
 */
export const showing = (state: ViewStateData, screen: Screen, subscreen?: Subscreen): boolean => {
  const tab = state.active;
  return tab.screen === screen && (subscreen === undefined || tab.subscreen === subscreen);
};
