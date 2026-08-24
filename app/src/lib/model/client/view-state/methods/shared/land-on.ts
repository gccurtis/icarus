import {
  SUBSCREENS,
  type Subscreen
} from "$model/client/view-state/methods/shared/keys";
import { defaultContext, offersContext } from "$model/client/view-state/methods/shared/rails";
import type { Tab } from "$model/client/view-state/types";

/**
 * Put a tab on a centre, with everything that has to follow.
 *
 * Two methods need this and neither may borrow the other: `showSubscreen` is a
 * person moving inside a screen they are already on, and `open` is a target that
 * names a centre arriving at a tab that is already open. Both are the same three
 * consequences, and a second copy of them is a second answer to "what happens to
 * the rail when the centre changes".
 *
 * **The rail follows.** Two centres of one screen frequently offer disjoint
 * rails — a template library and a template being authored share nothing — so a
 * remembered context is checked against the new rail and reset when it is not
 * there. Leaving it would point the panel at a view the screen no longer offers.
 *
 * **The inspection is cleared.** What was selected belonged to the centre that
 * is no longer showing; carrying it across would open a lens about something the
 * person can no longer see.
 *
 * **`focus` is how a library reaches its editor.** There is no switcher in the
 * shell: you get to a persona by choosing one, and the choosing and the
 * switching are one act. Passing nothing clears it, which is what going back to
 * a library means.
 */
export const landOn = (tab: Tab, subscreen: Subscreen, focus?: string): void => {
  // Widened deliberately: each screen's entry is a literal tuple, so `includes`
  // narrows its argument to that screen's own members and refuses the union this
  // takes — which is the question being asked, not an error.
  const offered: readonly string[] = SUBSCREENS[tab.screen];
  if (!offered.includes(subscreen)) {
    throw new Error(`'${tab.screen}' has no subscreen '${subscreen}'`);
  }

  tab.subscreen = subscreen;
  tab.focus = focus;
  if (tab.contextId === undefined || !offersContext(tab.screen, subscreen, tab.contextId)) {
    tab.contextId = defaultContext(tab.screen, subscreen);
  }
  tab.inspected = "empty";
  tab.selection = undefined;
};
