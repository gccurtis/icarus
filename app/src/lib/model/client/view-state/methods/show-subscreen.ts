import type { ViewStateData } from "$model/client/view-state/definition.svelte";
import { landOn } from "$model/client/view-state/methods/shared/land-on";
import type { Subscreen } from "$model/client/view-state/methods/shared/keys";

/**
 * Switch which centre this screen is showing.
 *
 * A subscreen is view state and never a second tab: the Agents screen on a
 * persona and the Agents screen on its library are one tab in two states, and a
 * tab per persona would make the strip the navigation for a screen that already
 * has its own.
 *
 * What follows from the switch — the rail, the inspection, the focus — is
 * [`landOn`](shared/land-on.ts), because `open` needs exactly the same three
 * consequences when a target names a centre.
 */
export const showSubscreen = (
  state: ViewStateData,
  subscreen: Subscreen,
  focus?: string
): void => {
  landOn(state.active, subscreen, focus);
};
