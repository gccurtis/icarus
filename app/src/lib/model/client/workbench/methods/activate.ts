import type { WorkbenchState } from "$model/client/workbench/definition.svelte";
import { persist } from "$model/client/workbench/methods/shared/persist";
import type { TabId } from "$model/client/workbench/types";

/**
 * Makes a tab the active one.
 *
 * Everything the context rail, the inspector, and the panels show follows from
 * this single assignment — each of those reads the active tab rather than
 * holding a copy, so switching tabs restores all three with nothing else moving.
 */
export const activate = (state: WorkbenchState, id: TabId): void => {
  if (!state.tabs.some((tab) => tab.id === id)) {
    throw new Error(`Cannot activate unknown tab ${id}.`);
  }
  state.activeId = id;
  persist(state);
};
