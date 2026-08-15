import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import type { Tab } from "$model/client/workbench/types";

/**
 * The tab `activeId` names.
 *
 * Preserves the never-empty invariant by refusing to paper over its breach: a
 * permanent tab cannot be closed, so an `activeId` naming nothing means the tab
 * list lost a tab it was promised. Returning `undefined` here would push that
 * failure into whichever surface read it next.
 */
export const activeTab = (state: WorkbenchState): Tab => {
  const tab = state.tabs.find((candidate) => candidate.id === state.activeId);
  if (!tab) {
    throw new Error(`Active tab ${state.activeId} is not in the tab list.`);
  }
  return tab;
};
