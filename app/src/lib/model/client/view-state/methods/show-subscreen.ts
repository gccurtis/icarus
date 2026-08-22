import type { ViewStateData } from "$model/client/view-state/definition.svelte";
import {
  SUBSCREENS,
  type Subscreen
} from "$model/client/view-state/methods/shared/keys";
import { defaultContext, offersContext } from "$model/client/view-state/methods/shared/rails";

/**
 * Switch which centre this screen is showing.
 *
 * A subscreen is view state and never a second tab: Research on one question and
 * Research on every thread are one tab in two states, and a tab per
 * investigation would make the strip the navigation for a screen that already
 * has its own.
 *
 * **The rail follows.** Two subscreens of one screen frequently offer disjoint
 * rails — a template library and a template being authored share nothing — so a
 * remembered context is checked against the new rail and reset when it is not
 * there. Leaving it would point the panel at a view the screen no longer offers.
 *
 * **The inspection is cleared.** What was selected belonged to the centre that
 * is no longer showing; carrying it across would open a lens about something the
 * person can no longer see.
 */
export const showSubscreen = (state: ViewStateData, subscreen: Subscreen): void => {
  const tab = state.active;

  // Widened deliberately: each screen's entry is a literal tuple, so `includes`
  // narrows its argument to that screen's own members and refuses the union this
  // takes — which is the question being asked, not an error.
  const offered: readonly string[] = SUBSCREENS[tab.screen];
  if (!offered.includes(subscreen)) {
    throw new Error(`'${tab.screen}' has no subscreen '${subscreen}'`);
  }

  tab.subscreen = subscreen;
  if (tab.contextId === undefined || !offersContext(tab.screen, subscreen, tab.contextId)) {
    tab.contextId = defaultContext(tab.screen, subscreen);
  }
  tab.inspected = "empty";
  tab.selection = undefined;
};
