import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import type { TabId } from "$model/client/workbench/types";

/**
 * Makes a tab the active one.
 *
 * Throws for an id that names nothing, rather than leaving `activeId` pointing
 * at a tab that does not exist — which would break the one invariant every
 * reader of `active` depends on.
 *
 * Nothing else happens. Switching tabs does not attach, release, flush, or touch
 * view state: a tab that is not active is still open, and its runtime is still
 * running. That is exactly why the work surface can remount on every switch
 * without costing anything.
 */
export const activate = (state: WorkbenchState, id: TabId): void => {
  if (!state.tabs.some((tab) => tab.id === id)) {
    throw new Error(`Tab ${id} does not exist.`);
  }

  state.activeId = id;
};
