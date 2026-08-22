import type { ViewStateData } from "$model/client/view-state/definition.svelte";
import { isSingleton, type TabId } from "$model/client/view-state/types";

/** How many closed tabs are worth keeping. Older ones are simply dropped. */
const QUEUE = 10;

/**
 * Close a tab, and remember it.
 *
 * **A singleton throws.** Project Overview is one per project and always open;
 * not being on it *is* closing it, so a caller asking for this has misunderstood
 * something and a silent no-op would hide that.
 *
 * **The whole tab goes on the queue, not its identity.** A reopen then restores
 * the rail position, the inspection and the panel widths rather than just the
 * screen — the thing a person actually lost.
 *
 * **The neighbour to the left becomes active**, which is what every tab strip
 * does, and the singletons at index 0 guarantee there is one.
 */
export const close = (state: ViewStateData, id: TabId): void => {
  const at = state.tabs.findIndex((tab) => tab.id === id);
  if (at < 0) return;

  const tab = state.tabs[at];
  if (isSingleton(tab.screen)) {
    throw new Error(`'${tab.screen}' is one per project and cannot be closed`);
  }

  state.tabs.splice(at, 1);
  state.closed = [tab, ...state.closed].slice(0, QUEUE);
  if (state.activeId === id) state.activeId = state.tabs[Math.max(0, at - 1)].id;
};
