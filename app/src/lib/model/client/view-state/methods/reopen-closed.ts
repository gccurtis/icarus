import type { ViewStateData } from "$model/client/view-state/definition.svelte";
import type { Tab } from "$model/client/view-state/types";

/**
 * Put back the most recently closed tab, with the state it had.
 *
 * The queue holds whole tabs, so this restores the rail position, the inspection
 * and the panel widths — not just the screen. The id comes back too, which is
 * why a reopen is a restoration rather than a new tab that happens to look alike.
 */
export const reopenClosed = (state: ViewStateData): Tab | undefined => {
  const [tab, ...rest] = state.closed;
  if (!tab) return undefined;

  state.closed = rest;
  state.tabs.push(tab);
  state.activeId = tab.id;
  return tab;
};
