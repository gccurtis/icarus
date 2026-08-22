import type { ViewStateData } from "$model/client/view-state/definition.svelte";
import type { TabId } from "$model/client/view-state/types";

/**
 * Move to a tab.
 *
 * An id naming no tab is ignored rather than thrown, because the one caller that
 * can produce one is a click on a tab being closed in the same frame — a race,
 * not a defect. `activeId` never becomes something no tab answers to.
 */
export const activate = (state: ViewStateData, id: TabId): void => {
  if (state.tabs.some((tab) => tab.id === id)) state.activeId = id;
};
